import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { requireAdmin } from "@/src/utils/chat/auth";
import {
  validateEmail,
  validatePassword,
} from "@/src/utils/validation";
import { countStaffOpenOrders } from "@/src/utils/staff/duty";
import {
  isPseudonymTaken,
  OPERATOR_PROFILE_FIELDS,
  parseAssignedPseudonym,
} from "@/src/utils/staff/operators-admin";
import { isChatNickTaken, parseChatNick } from "@/src/utils/staff/chat-nicks";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function loadTarget(
  admin: { from: (table: string) => any },
  id: string,
) {
  const { data, error } = await withTimeout(
    admin
      .from("profiles")
      .select(OPERATOR_PROFILE_FIELDS)
      .eq("id", id)
      .maybeSingle(),
    8000,
    { data: null, error: { message: "Database timeout" } } as any,
  );
  return { data, error };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireAdmin();
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const { data: current, error: loadError } = await loadTarget(
      actor.admin,
      id,
    );
    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 503 });
    }
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (current.role !== "operator" && current.role !== "admin") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const isSelf = current.id === actor.user.id;
    const isOperator = current.role === "operator";
    const canEditAccount = isOperator;

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    const authPatch: {
      email?: string;
      password?: string;
      email_confirm?: boolean;
    } = {};

    if (body.operator_pseudonym !== undefined) {
      const pseudonymCheck = parseAssignedPseudonym(
        body.operator_pseudonym,
        current.operator_pseudonym,
      );
      if (!pseudonymCheck.ok) {
        return NextResponse.json(
          { error: pseudonymCheck.error },
          { status: 400 },
        );
      }
      if (
        await isPseudonymTaken(actor.admin, pseudonymCheck.value, current.id)
      ) {
        return NextResponse.json(
          { error: "Этот ник уже занят" },
          { status: 409 },
        );
      }
      patch.operator_pseudonym = pseudonymCheck.value;
    }

    if (body.chat_pseudonym !== undefined) {
      const chatNickCheck = parseChatNick(
        body.chat_pseudonym,
        current.chat_pseudonym,
      );
      if (!chatNickCheck.ok) {
        return NextResponse.json(
          { error: chatNickCheck.error },
          { status: 400 },
        );
      }
      if (await isChatNickTaken(actor.admin, chatNickCheck.value, current.id)) {
        return NextResponse.json(
          { error: "Этот ник для чата уже занят" },
          { status: 409 },
        );
      }
      patch.chat_pseudonym = chatNickCheck.value;
    }

    if (body.email !== undefined) {
      if (!canEditAccount) {
        return NextResponse.json(
          { error: "E-mail администратора здесь менять нельзя" },
          { status: 403 },
        );
      }
      const emailCheck = validateEmail(
        typeof body.email === "string" ? body.email : "",
      );
      if (!emailCheck.ok) {
        return NextResponse.json({ error: emailCheck.error }, { status: 400 });
      }
      patch.email = emailCheck.value;
      authPatch.email = emailCheck.value;
      authPatch.email_confirm = true;
    }

    if (body.password !== undefined && body.password !== "") {
      if (!canEditAccount) {
        return NextResponse.json(
          { error: "Пароль администратора здесь менять нельзя" },
          { status: 403 },
        );
      }
      const passwordCheck = validatePassword(
        typeof body.password === "string" ? body.password : "",
      );
      if (!passwordCheck.ok) {
        return NextResponse.json(
          { error: passwordCheck.error },
          { status: 400 },
        );
      }
      authPatch.password = passwordCheck.value;
    }

    if (isOperator && body.is_senior_operator !== undefined) {
      patch.is_senior_operator = body.is_senior_operator === true;
    }

    if (Object.keys(authPatch).length > 0) {
      const authResult = await actor.admin.auth.admin.updateUserById(
        current.id,
        authPatch,
      );
      if (authResult.error) {
        const message = authResult.error.message;
        if (/already/i.test(message) || /registered/i.test(message)) {
          return NextResponse.json(
            { error: "Пользователь с таким e-mail уже есть" },
            { status: 409 },
          );
        }
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    if (Object.keys(patch).length === 1 && !authPatch.password) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await withTimeout(
      actor.admin
        .from("profiles")
        .update(patch)
        .eq("id", current.id)
        .select(OPERATOR_PROFILE_FIELDS)
        .single(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json({ operator: data, self: isSelf });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const actor = await requireAdmin();
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    if (id === actor.user.id) {
      return NextResponse.json(
        { error: "Нельзя удалить собственный аккаунт" },
        { status: 400 },
      );
    }

    const { data: current, error: loadError } = await loadTarget(
      actor.admin,
      id,
    );
    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 503 });
    }
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (current.role !== "operator") {
      return NextResponse.json(
        { error: "Удалять можно только операторов" },
        { status: 400 },
      );
    }

    const openOrders = await countStaffOpenOrders(actor.admin, current.id);
    if (openOrders > 0) {
      return NextResponse.json(
        {
          error:
            "У оператора есть заявки в работе. Сначала завершите их или переназначьте оператора.",
          count: openOrders,
        },
        { status: 409 },
      );
    }

    await actor.admin
      .from("chat_conversations")
      .update({ operator_id: null, updated_at: new Date().toISOString() })
      .eq("operator_id", current.id);

    const lockPassword = `${randomBytes(18).toString("base64url")}Aa1!`;
    await actor.admin.auth.admin.updateUserById(current.id, {
      password: lockPassword,
    });

    const { error } = await withTimeout(
      actor.admin
        .from("profiles")
        .update({
          role: "user",
          operator_pseudonym: null,
          chat_pseudonym: null,
          staff_active: false,
          is_senior_operator: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    try {
      await actor.admin.auth.admin.updateUserById(current.id, {
        ban_duration: "876000h",
      });
    } catch {
      // demote + password lock is enough if ban is unavailable
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
