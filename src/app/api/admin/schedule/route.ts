import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { requireAdmin } from "@/src/utils/chat/auth";
import { parseClock, WEEKDAYS } from "@/src/utils/staff/schedule";

function parseWeekdays(raw: unknown): number[] | null {
  if (typeof raw === "number" && WEEKDAYS.some((day) => day.id === raw)) {
    return [raw];
  }
  if (!Array.isArray(raw)) return null;
  const ids = raw
    .map((value) => Number(value))
    .filter((value) => WEEKDAYS.some((day) => day.id === value));
  return ids.length ? [...new Set(ids)] : null;
}

export async function PUT(request: Request) {
  try {
    const actor = await requireAdmin();
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.operator_id !== "string") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const weekdays = parseWeekdays(body.weekdays ?? body.weekday);
    if (!weekdays) {
      return NextResponse.json({ error: "Укажите день недели" }, { status: 400 });
    }

    const { data: target, error: targetError } = await withTimeout(
      actor.admin
        .from("profiles")
        .select("id, role")
        .eq("id", body.operator_id)
        .maybeSingle(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (targetError) {
      return NextResponse.json({ error: targetError.message }, { status: 503 });
    }
    if (!target || target.role !== "operator") {
      return NextResponse.json(
        { error: "График можно задать только оператору" },
        { status: 400 },
      );
    }

    const off = body.off === true;
    const startsAt = off ? null : parseClock(body.starts_at);
    const endsAt = off ? null : parseClock(body.ends_at);

    if (!off && (!startsAt || !endsAt)) {
      return NextResponse.json(
        { error: "Укажите время начала и конца смены" },
        { status: 400 },
      );
    }
    if (!off && startsAt === endsAt) {
      return NextResponse.json(
        { error: "Начало и конец смены не должны совпадать" },
        { status: 400 },
      );
    }

    if (off) {
      const { error } = await actor.admin
        .from("staff_schedule")
        .delete()
        .eq("operator_id", body.operator_id)
        .in("weekday", weekdays);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }
      return NextResponse.json({ ok: true });
    }

    const now = new Date().toISOString();
    const rows = weekdays.map((weekday) => ({
      operator_id: body.operator_id,
      weekday,
      starts_at: startsAt,
      ends_at: endsAt,
      updated_at: now,
    }));

    const { error } = await actor.admin
      .from("staff_schedule")
      .upsert(rows, { onConflict: "operator_id,weekday" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
