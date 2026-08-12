import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { requireStaff } from "@/src/utils/chat/auth";
import { validateOperatorPseudonym } from "@/src/utils/validation";

export async function GET() {
  try {
    const staff = await requireStaff();
    if (!staff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await withTimeout(
      staff.admin
        .from("profiles")
        .select("id, email, role, operator_pseudonym")
        .eq("id", staff.user.id)
        .maybeSingle(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json({ profile: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const staff = await requireStaff();
    if (!staff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const pseudonymRaw =
      body && typeof body.operator_pseudonym === "string"
        ? body.operator_pseudonym
        : "";

    const pseudonymCheck = validateOperatorPseudonym(pseudonymRaw);
    if (!pseudonymCheck.ok) {
      return NextResponse.json({ error: pseudonymCheck.error }, { status: 400 });
    }

    const pseudonym = pseudonymCheck.value;

    const { data, error } = await withTimeout(
      staff.admin
        .from("profiles")
        .update({
          operator_pseudonym: pseudonym,
          updated_at: new Date().toISOString(),
        })
        .eq("id", staff.user.id)
        .select("id, email, role, operator_pseudonym")
        .single(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json({ profile: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
