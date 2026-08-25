import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import {
  assertClientConversation,
  requireClient,
  requireStaff,
} from "@/src/utils/chat/auth";
import {
  ALLOWED_CHAT_ATTACHMENT_TYPES,
  MAX_CHAT_ATTACHMENT_BYTES,
} from "@/src/utils/chat/types";
import {
  broadcastChatConversation,
  broadcastChatMessage,
} from "@/src/utils/supabase/broadcast-support";
import { enrichConversation } from "@/src/utils/chat/enrich-conversation";
import {
  ensureStaffCanReply,
  getStaffPseudonym,
  STAFF_PSEUDONYM_REQUIRED,
} from "@/src/utils/chat/staff-chat";
import { isStaffOnDuty, staffInactiveResponse } from "@/src/utils/staff/duty";

type RouteContext = { params: Promise<{ id: string }> };

async function loadConversation(admin: any, id: string) {
  return withTimeout(
    admin.from("chat_conversations").select("*").eq("id", id).maybeSingle(),
    8000,
    { data: null, error: { message: "Database timeout" } } as any,
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
    const client = staff ? null : await requireClient();
    const actor = staff ?? client;
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (staff) {
      if (!isStaffOnDuty(staff.profile)) {
        return staffInactiveResponse();
      }

      const pseudonym = getStaffPseudonym(staff.profile);
      if (!pseudonym) {
        return NextResponse.json(
          { error: STAFF_PSEUDONYM_REQUIRED },
          { status: 403 },
        );
      }

      const access = await ensureStaffCanReply(
        staff.admin,
        id,
        staff.user.id,
        pseudonym,
      );
      if (!access.ok) {
        return NextResponse.json(
          { error: access.error },
          { status: access.status },
        );
      }
    }

    const { data: row, error: convError } = await loadConversation(
      actor.admin,
      id,
    );

    if (convError) {
      return NextResponse.json({ error: convError.message }, { status: 503 });
    }
    if (!row || row.status !== "open") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (staff) {
      const clientCheck = await assertClientConversation(
        actor.admin,
        String(row.user_id),
      );
      if (!clientCheck.ok) {
        return NextResponse.json(
          { error: clientCheck.error },
          { status: clientCheck.status },
        );
      }
    } else if (row.user_id !== actor.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ext = file.name.split(".").pop() || "bin";
    const path = `${id}/${Date.now()}-${actor.user.id}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await actor.admin.storage
      .from("chat-attachments")
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 503 });
    }

    const { data: publicUrlData } = actor.admin.storage
      .from("chat-attachments")
      .getPublicUrl(path);

    const { data: message, error } = await withTimeout(
      actor.admin
        .from("chat_messages")
        .insert({
          conversation_id: id,
          sender_id: actor.user.id,
          body: caption || null,
          attachment_url: publicUrlData.publicUrl,
          attachment_name: file.name,
          attachment_type: file.type,
        })
        .select(
          "id, created_at, conversation_id, sender_id, body, attachment_url, attachment_name, attachment_type",
        )
        .single(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error || !message) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to save message" },
        { status: 503 },
      );
    }

    await withTimeout(
      actor.admin
        .from("chat_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id),
      5000,
      { data: null, error: null } as any,
    );

    if (staff) {
      const updatedRow = await loadConversation(actor.admin, id);
      if (updatedRow.data) {
        const conversation = await enrichConversation(
          actor.admin,
          updatedRow.data,
        );
        void broadcastChatConversation({ conversation });
      }
    }

    void broadcastChatMessage({ message, conversationId: id });
    return NextResponse.json({ message });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
