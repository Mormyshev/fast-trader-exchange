import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { requireStaff } from "@/src/utils/chat/auth";
import {
  canAccessStaffConversation,
  isStaffChatTableMissing,
  loadStaffConversation,
} from "@/src/utils/chat/staff-internal";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const staff = await requireStaff();
    if (!staff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: row, error } = await loadStaffConversation(staff.admin, id);
    if (error) {
      if (isStaffChatTableMissing(error.message)) {
        return NextResponse.json(
          {
            error:
              "Таблица внутреннего чата ещё не создана. Выполните supabase/add_staff_chat.sql",
            code: "STAFF_CHAT_TABLE_MISSING",
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (!row || !canAccessStaffConversation(row, staff.user.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { error: upsertError } = await withTimeout(
      staff.admin.from("staff_conversation_reads").upsert(
        {
          conversation_id: id,
          profile_id: staff.user.id,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "conversation_id,profile_id" },
      ),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 503 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
