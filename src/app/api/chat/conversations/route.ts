import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import {
  filterClientConversationRows,
  requireClient,
  requireStaff,
} from "@/src/utils/chat/auth";
import { getOrCreateClientConversation } from "@/src/utils/chat/client-conversation";
import { broadcastChatConversation } from "@/src/utils/supabase/broadcast-support";
import { enrichConversations } from "@/src/utils/chat/enrich-conversation";
import { hideInternalStaffNicks } from "@/src/utils/chat/staff-chat";

export async function GET() {
  try {
    const staff = await requireStaff();
    if (staff) {
      const { data, error } = await withTimeout(
        staff.admin
          .from("chat_conversations")
          .select("*")
          .eq("status", "open")
          .order("updated_at", { ascending: false }),
        8000,
        { data: null, error: { message: "Database timeout" } } as any,
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }

      const clientRows = await filterClientConversationRows(
        staff.admin,
        (data ?? []) as Record<string, unknown>[],
      );
      const conversations = await enrichConversations(staff.admin, clientRows);
      return NextResponse.json({ conversations });
    }

    const actor = await requireClient();
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const conversationResult = await getOrCreateClientConversation(
      actor.admin,
      actor.user.id,
    );
    if (!conversationResult.ok) {
      return NextResponse.json(
        { error: conversationResult.error },
        { status: 503 },
      );
    }

    const [conversation] = await enrichConversations(actor.admin, [
      conversationResult.row,
    ]);
    if (!conversation) {
      return NextResponse.json(
        { error: "Не удалось открыть чат" },
        { status: 503 },
      );
    }
    if (conversationResult.created) {
      void broadcastChatConversation({ conversation });
    }
    return NextResponse.json({
      conversation: hideInternalStaffNicks(conversation),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
