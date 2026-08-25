import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { requireAdmin } from "@/src/utils/chat/auth";
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from "@/src/utils/validation";
import {
  isPseudonymTaken,
  OPERATOR_PROFILE_FIELDS,
  parseAssignedPseudonym,
} from "@/src/utils/staff/operators-admin";

export async function GET() {
  try {
    const actor = await requireAdmin();
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await withTimeout(
      actor.admin
        .from("profiles")
        .select(OPERATOR_PROFILE_FIELDS)
        .in("role", ["operator", "admin"]),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    const operators = ((data ?? []) as Array<{
      id: string;
      email: string;
      role: string;
      operator_pseudonym: string | null;
      staff_active: boolean | null;
      updated_at: string | null;
    }>).sort((a, b) => {
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      const nameA = (a.operator_pseudonym || a.email || "").toLocaleLowerCase("ru");
      const nameB = (b.operator_pseudonym || b.email || "").toLocaleLowerCase("ru");
      return nameA.localeCompare(nameB, "ru");
    });

    return NextResponse.json({ operators });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const emailCheck = validateEmail(
      body && typeof body.email === "string" ? body.email : "",
    );
    if (!emailCheck.ok) {
      return NextResponse.json({ error: emailCheck.error }, { status: 400 });
    }

    const passwordCheck = validatePassword(
      body && typeof body.password === "string" ? body.password : "",
    );
    if (!passwordCheck.ok) {
      return NextResponse.json({ error: passwordCheck.error }, { status: 400 });
    }

    const confirmCheck = validatePasswordConfirm(
      passwordCheck.value,
      body && typeof body.password_confirm === "string"
        ? body.password_confirm
        : "",
    );
    if (!confirmCheck.ok) {
      return NextResponse.json({ error: confirmCheck.error }, { status: 400 });
    }

    const pseudonymCheck = parseAssignedPseudonym(body?.operator_pseudonym);
    if (!pseudonymCheck.ok) {
      return NextResponse.json({ error: pseudonymCheck.error }, { status: 400 });
    }
    if (await isPseudonymTaken(actor.admin, pseudonymCheck.value)) {
      return NextResponse.json(
        { error: "Этот псевдоним уже занят" },
        { status: 409 },
      );
    }

    const created = await actor.admin.auth.admin.createUser({
      email: emailCheck.value,
      password: passwordCheck.value,
      email_confirm: true,
    });

    if (created.error || !created.data.user) {
      const message = created.error?.message || "Не удалось создать оператора";
      if (/already/i.test(message) || /registered/i.test(message)) {
        return NextResponse.json(
          { error: "Пользователь с таким e-mail уже есть" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const userId = created.data.user.id;
    const now = new Date().toISOString();
    const { data, error } = await withTimeout(
      actor.admin
        .from("profiles")
        .upsert(
          {
            id: userId,
            email: emailCheck.value,
            role: "operator",
            operator_pseudonym: pseudonymCheck.value,
            staff_active: false,
            updated_at: now,
          },
          { onConflict: "id" },
        )
        .select(OPERATOR_PROFILE_FIELDS)
        .single(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      await actor.admin.auth.admin.deleteUser(userId).catch(() => {});
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json({ operator: data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
