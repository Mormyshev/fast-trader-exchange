import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { requireStaff } from "@/src/utils/chat/auth";
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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    const { data: messages, error: messagesError } = await withTimeout(
      staff.admin
        .from("staff_messages")
        .select(MESSAGE_SELECT)
        .eq("conversation_id", id)
        .order("created_at", { ascending: true }),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );
    if (messagesError) {
      return NextResponse.json({ error: messagesError.message }, { status: 503 });
    }

    const conversation = await enrichConversation(
      staff.admin,
      row,
      staff.user.id,
    );
    const withSenders = await attachSendersToMessages(
      staff.admin,
      messages ?? [],
    );

    return NextResponse.json({ conversation, messages: withSenders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const text =
      body && typeof body.body === "string" ? body.body.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });
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

    const { data: message, error: insertError } = await withTimeout(
      staff.admin
        .from("staff_messages")
        .insert({
          conversation_id: id,
          sender_id: staff.user.id,
          body: text,
        })
        .select(MESSAGE_SELECT)
        .single(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );
    if (insertError || !message) {
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to send" },
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
