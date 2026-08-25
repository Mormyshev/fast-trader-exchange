import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { requireStaff } from "@/src/utils/chat/auth";
import { broadcastChatConversation } from "@/src/utils/supabase/broadcast-support";
import { enrichConversation } from "@/src/utils/chat/enrich-conversation";
import {
  claimConversation,
  getStaffPseudonym,
  STAFF_PSEUDONYM_REQUIRED,
  takeoverConversation,
} from "@/src/utils/chat/staff-chat";
import { isStaffOnDuty, staffInactiveResponse } from "@/src/utils/staff/duty";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const staff = await requireStaff();
    if (!staff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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

    const { id } = await context.params;

    const { data: existing, error: existingError } = await withTimeout(
      staff.admin
        .from("chat_conversations")
        .select("operator_id")
        .eq("id", id)
        .maybeSingle(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 503 });
    }

    const access = existing?.operator_id
      ? await takeoverConversation(staff.admin, id, staff.user.id, pseudonym)
      : await claimConversation(staff.admin, id, staff.user.id, pseudonym);

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { data: row, error } = await withTimeout(
      staff.admin.from("chat_conversations").select("*").eq("id", id).maybeSingle(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const conversation = await enrichConversation(staff.admin, row);
    void broadcastChatConversation({ conversation });

    return NextResponse.json({ conversation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
