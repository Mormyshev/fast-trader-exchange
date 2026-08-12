import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import {
  filterClientConversationRows,
  requireClient,
  requireStaff,
} from "@/src/utils/chat/auth";
import { broadcastChatConversation } from "@/src/utils/supabase/broadcast-support";
import { enrichConversations } from "@/src/utils/chat/enrich-conversation";

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

    let { data: row, error } = await withTimeout(
      actor.admin
        .from("chat_conversations")
        .select("*")
        .eq("user_id", actor.user.id)
        .eq("status", "open")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (!row) {
      const created = await withTimeout(
        actor.admin
          .from("chat_conversations")
          .insert({ user_id: actor.user.id, status: "open" })
          .select("*")
          .single(),
        8000,
        { data: null, error: { message: "Database timeout" } } as any,
      );

      if (created.error || !created.data) {
        return NextResponse.json(
          { error: created.error?.message ?? "Failed to create conversation" },
          { status: 503 },
        );
      }

      row = created.data;
      const [conversation] = await enrichConversations(actor.admin, [row]);
      void broadcastChatConversation({ conversation });
      return NextResponse.json({ conversation });
    }

    const [conversation] = await enrichConversations(actor.admin, [row]);
    return NextResponse.json({ conversation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
