import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { requireStaff } from "@/src/utils/chat/auth";
import { formatClock } from "@/src/utils/staff/schedule";

type ShiftRow = {
  operator_id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
};

function mapShift(row: {
  operator_id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
}): ShiftRow {
  return {
    operator_id: row.operator_id,
    weekday: Number(row.weekday),
    starts_at: formatClock(String(row.starts_at)),
    ends_at: formatClock(String(row.ends_at)),
  };
}

export async function GET() {
  try {
    const staff = await requireStaff();
    if (!staff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [operatorsRes, shiftsRes] = await Promise.all([
      withTimeout(
        staff.admin
          .from("profiles")
          .select("id, email, role, operator_pseudonym, staff_active")
          .eq("role", "operator"),
        8000,
        { data: null, error: { message: "Database timeout" } } as any,
      ),
      withTimeout(
        staff.admin
          .from("staff_schedule")
          .select("operator_id, weekday, starts_at, ends_at"),
        8000,
        { data: null, error: { message: "Database timeout" } } as any,
      ),
    ]);

    if (operatorsRes.error) {
      return NextResponse.json(
        { error: operatorsRes.error.message },
        { status: 503 },
      );
    }
    if (shiftsRes.error) {
      const missing =
        /staff_schedule/i.test(shiftsRes.error.message) ||
        /schema cache/i.test(shiftsRes.error.message) ||
        /does not exist/i.test(shiftsRes.error.message);
      if (missing) {
        return NextResponse.json(
          {
            error:
              "Таблица графика ещё не создана. Выполните supabase/add_staff_schedule.sql",
            code: "SCHEDULE_TABLE_MISSING",
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: shiftsRes.error.message },
        { status: 503 },
      );
    }

    const operators = (
      (operatorsRes.data ?? []) as Array<{
        id: string;
        email: string;
        role: string;
        operator_pseudonym: string | null;
        staff_active: boolean | null;
      }>
    )
      .map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role as "operator",
        operator_pseudonym: row.operator_pseudonym?.trim() || null,
        staff_active: row.staff_active === true,
      }))
      .sort((a, b) => {
        const nameA = (a.operator_pseudonym || a.email).toLocaleLowerCase("ru");
        const nameB = (b.operator_pseudonym || b.email).toLocaleLowerCase("ru");
        return nameA.localeCompare(nameB, "ru");
      });

    const operatorIds = new Set(operators.map((row) => row.id));
    const shifts = ((shiftsRes.data ?? []) as ShiftRow[])
      .filter((row) => operatorIds.has(row.operator_id))
      .map(mapShift);

    return NextResponse.json({ operators, shifts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
