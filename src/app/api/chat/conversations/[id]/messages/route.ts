import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import {
  assertClientConversation,
  requireClient,
  requireStaff,
} from "@/src/utils/chat/auth";
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

type RouteContext = { params: Promise<{ id: string }> };

async function loadConversation(admin: any, id: string) {
  return withTimeout(
    admin.from("chat_conversations").select("*").eq("id", id).maybeSingle(),
    8000,
    { data: null, error: { message: "Database timeout" } } as any,
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const staff = await requireStaff();
    const client = staff ? null : await requireClient();
    const actor = staff ?? client;
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: row, error: convError } = await loadConversation(
      actor.admin,
      id,
    );
    if (convError) {
      return NextResponse.json({ error: convError.message }, { status: 503 });
    }
    if (!row) {
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

    const conversation = await enrichConversation(actor.admin, row);

    const { data: messages, error } = await withTimeout(
      actor.admin
        .from("chat_messages")
        .select(
          "id, created_at, conversation_id, sender_id, body, attachment_url, attachment_name, attachment_type",
        )
        .eq("conversation_id", id)
        .order("created_at", { ascending: true }),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json({ conversation, messages: messages ?? [] });
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
    const client = staff ? null : await requireClient();
    const actor = staff ?? client;
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (staff) {
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

    if (!staff && row.user_id !== actor.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: message, error } = await withTimeout(
      actor.admin
        .from("chat_messages")
        .insert({
          conversation_id: id,
          sender_id: actor.user.id,
          body: text,
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
        { error: error?.message ?? "Failed to send" },
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
