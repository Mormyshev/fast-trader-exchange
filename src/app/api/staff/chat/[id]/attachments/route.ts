import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { requireStaff } from "@/src/utils/chat/auth";
import {
  ALLOWED_CHAT_ATTACHMENT_TYPES,
  MAX_CHAT_ATTACHMENT_BYTES,
} from "@/src/utils/chat/types";
import {
  attachSendersToMessages,
  buildStaffConversation,
  canAccessStaffConversation,
  isStaffChatTableMissing,
  listStaffProfiles,
  loadLatestStaffMessages,
  loadStaffConversation,
  loadStaffReads,
  MESSAGE_SELECT,
  staffProfilesMap,
} from "@/src/utils/chat/staff-internal";
import {
  broadcastStaffChatConversation,
  broadcastStaffChatMessage,
} from "@/src/utils/supabase/broadcast-staff-chat";

type RouteContext = { params: Promise<{ id: string }> };

function tableMissingResponse() {
  return NextResponse.json(
    {
      error:
        "Таблица внутреннего чата ещё не создана. Выполните supabase/add_staff_chat.sql",
      code: "STAFF_CHAT_TABLE_MISSING",
    },
    { status: 503 },
  );
}

async function enrichConversation(admin: any, row: any, userId: string) {
  const profilesRes = await listStaffProfiles(admin);
  const profiles = staffProfilesMap(profilesRes.data ?? []);
  const [latest, reads] = await Promise.all([
    loadLatestStaffMessages(admin, [row.id]),
    loadStaffReads(admin, userId, [row.id]),
  ]);
  return buildStaffConversation(
    row,
    userId,
    profiles,
    latest.get(row.id) ?? null,
    reads.get(row.id) ?? null,
  );
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    const caption =
      typeof form.get("body") === "string" ? String(form.get("body")).trim() : "";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }
    if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: "Файл слишком большой (макс. 10 МБ)" },
        { status: 400 },
      );
    }
    if (!ALLOWED_CHAT_ATTACHMENT_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Неподдерживаемый тип файла" },
        { status: 400 },
      );
    }

    const staff = await requireStaff();
    if (!staff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: row, error } = await loadStaffConversation(staff.admin, id);
    if (error) {
      if (isStaffChatTableMissing(error.message)) return tableMissingResponse();
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (!row || !canAccessStaffConversation(row, staff.user.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ext = file.name.split(".").pop() || "bin";
    const path = `staff/${id}/${Date.now()}-${staff.user.id}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await staff.admin.storage
      .from("chat-attachments")
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 503 });
    }

    const { data: publicUrlData } = staff.admin.storage
      .from("chat-attachments")
      .getPublicUrl(path);

    const { data: message, error: insertError } = await withTimeout(
      staff.admin
        .from("staff_messages")
        .insert({
          conversation_id: id,
          sender_id: staff.user.id,
          body: caption || null,
          attachment_url: publicUrlData.publicUrl,
          attachment_name: file.name,
          attachment_type: file.type,
        })
        .select(MESSAGE_SELECT)
        .single(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );
    if (insertError || !message) {
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to save message" },
        { status: 503 },
      );
    }

    await withTimeout(
      staff.admin
        .from("staff_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id),
      5000,
      { data: null, error: null } as any,
    );

    const [withSender] = await attachSendersToMessages(staff.admin, [message]);
    const updated = await loadStaffConversation(staff.admin, id);
    if (updated.data) {
      const conversation = await enrichConversation(
        staff.admin,
        updated.data,
        staff.user.id,
      );
      void broadcastStaffChatConversation({ conversation });
    }
    void broadcastStaffChatMessage({ message: withSender, conversationId: id });
    return NextResponse.json({ message: withSender });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
