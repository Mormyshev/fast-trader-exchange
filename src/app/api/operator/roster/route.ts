import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { requireStaff } from "@/src/utils/chat/auth";
import { isStaffOnDuty } from "@/src/utils/staff/duty";

export async function GET() {
  try {
    const staff = await requireStaff();
    if (!staff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await withTimeout(
      staff.admin
        .from("profiles")
        .select("id, role, operator_pseudonym, staff_active, is_senior_operator")
        .in("role", ["operator", "admin"]),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    const operators = ((data ?? []) as Array<{
      id: string;
      role: string;
      operator_pseudonym: string | null;
      staff_active: boolean | null;
      is_senior_operator: boolean | null;
    }>)
      .filter((row) => row.role === "operator" || row.role === "admin")
      .map((row) => ({
        id: row.id,
        role: row.role as "operator" | "admin",
        operator_pseudonym: row.operator_pseudonym?.trim() || null,
        staff_active: isStaffOnDuty(row),
        is_senior_operator: row.is_senior_operator === true,
      }))
      .sort((a, b) => {
        if (a.staff_active !== b.staff_active) return a.staff_active ? -1 : 1;
        if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
        if (a.is_senior_operator !== b.is_senior_operator) {
          return a.is_senior_operator ? -1 : 1;
        }
        const nameA = (a.operator_pseudonym || "").toLocaleLowerCase("ru");
        const nameB = (b.operator_pseudonym || "").toLocaleLowerCase("ru");
        return nameA.localeCompare(nameB, "ru");
      });

    return NextResponse.json({ operators });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
