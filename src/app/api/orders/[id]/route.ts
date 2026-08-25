import { NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import {
  broadcastOrderEvent,
  ORDER_UPDATED_EVENT,
} from "@/src/utils/supabase/broadcast";
import { isRubPayout } from "@/src/utils/exchange-currencies";
import { expireOrderIfNeeded } from "@/src/utils/orders/expire-orders";
import {
  fetchOperatorPseudonym,
  stripOrderInternalFields,
} from "@/src/utils/orders/operator-snapshot";
import { attachClientToOrder } from "@/src/utils/orders/attach-client";
import {
  isStaffOnDuty,
  staffInactiveResponse,
  STAFF_OPEN_ORDER_STATUSES,
} from "@/src/utils/staff/duty";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getActor() {
  try {
    const supabase = await createClient();
    const user = await getUserFast(supabase);

    if (!user) return null;

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role, staff_active")
      .eq("id", user.id)
      .maybeSingle();

    return {
      user,
      admin,
      role: profile?.role || "user",
      isStaff: profile?.role === "operator" || profile?.role === "admin",
      staffActive: isStaffOnDuty(profile),
    };
  } catch {
    return null;
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const actor = await getActor();

    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: order, error } = await withTimeout(
      actor.admin.from("orders").select("*").eq("id", id).maybeSingle(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (order.user_id !== actor.user.id && !actor.isStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const fresh = await expireOrderIfNeeded(actor.admin, order);
    const payload = actor.isStaff
      ? await attachClientToOrder(actor.admin, fresh)
      : stripOrderInternalFields(fresh as Record<string, unknown>);
    return NextResponse.json({ order: payload });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const actor = await getActor();

    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { data: order, error: loadError } = await withTimeout(
      actor.admin.from("orders").select("*").eq("id", id).maybeSingle(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 503 });
    }

    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const current = await expireOrderIfNeeded(actor.admin, order);
    if (current.status === "cancelled" && order.status !== "cancelled") {
      return NextResponse.json(
        { error: "Заявка отменена: истекло время жизни", order: current },
        { status: 409 },
      );
    }

    const isOwner = current.user_id === actor.user.id;

    if (!isOwner && !actor.isStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (actor.isStaff && !actor.staffActive) {
      const tryingStaffWork =
        body.operator_id !== undefined ||
        typeof body.payment_details === "string" ||
        typeof body.operator_receipt_url === "string" ||
        (typeof body.status === "string" &&
          body.status !== "paid" &&
          body.status !== "cancelled");
      if (!isOwner || tryingStaffWork) {
        return staffInactiveResponse();
      }
    }

    if (
      actor.isStaff &&
      actor.role !== "admin" &&
      current.operator_id &&
      current.operator_id !== actor.user.id
    ) {
      const touchingProcess =
        typeof body.payment_details === "string" ||
        typeof body.operator_receipt_url === "string" ||
        typeof body.status === "string";
      if (touchingProcess) {
        return NextResponse.json(
          { error: "Эту заявку ведёт другой оператор" },
          { status: 403 },
        );
      }
    }

    const patch: Record<string, unknown> = {};

    if (actor.isStaff) {
      if (typeof body.payment_details === "string") {
        patch.payment_details = body.payment_details;
      }
      if (typeof body.status === "string") {
        if (
          body.status === "completed" &&
          isRubPayout(current.currency_to as string) &&
          !(current as { operator_receipt_url?: string | null })
            .operator_receipt_url &&
          !(typeof body.operator_receipt_url === "string" && body.operator_receipt_url)
        ) {
          return NextResponse.json(
            {
              error:
                "Перед завершением прикрепите PDF-чек выплаты рублей клиенту",
            },
            { status: 400 },
          );
        }
        patch.status = body.status;
      }
      if (typeof body.operator_receipt_url === "string") {
        patch.operator_receipt_url = body.operator_receipt_url;
      }
      if (typeof body.operator_id === "string" || body.operator_id === null) {
        if (typeof body.operator_id === "string") {
          const isReassign =
            !!current.operator_id && current.operator_id !== body.operator_id;

          if (isReassign && actor.role !== "admin") {
            return NextResponse.json(
              { error: "Эту заявку уже забрал другой оператор" },
              { status: 409 },
            );
          }

          if (
            isReassign &&
            !(STAFF_OPEN_ORDER_STATUSES as readonly string[]).includes(
              current.status,
            )
          ) {
            return NextResponse.json(
              { error: "Сменить оператора можно только у заявки в работе" },
              { status: 400 },
            );
          }

          const { data: target, error: targetError } = await actor.admin
            .from("profiles")
            .select("id, role, staff_active")
            .eq("id", body.operator_id)
            .maybeSingle();

          if (targetError) {
            return NextResponse.json(
              { error: targetError.message },
              { status: 503 },
            );
          }

          if (
            !target ||
            (target.role !== "operator" && target.role !== "admin")
          ) {
            return NextResponse.json(
              { error: "Можно назначить только оператора или администратора" },
              { status: 400 },
            );
          }

          if (!isStaffOnDuty(target)) {
            return NextResponse.json(
              { error: "Можно назначить только активного оператора." },
              { status: 409 },
            );
          }

          const hadSnapshot = Boolean(
            (current as { operator_pseudonym_snapshot?: string | null })
              .operator_pseudonym_snapshot,
          );
          if (isReassign || !hadSnapshot) {
            const pseudonym = await fetchOperatorPseudonym(
              actor.admin,
              body.operator_id,
            );
            if (pseudonym) {
              patch.operator_pseudonym_snapshot = pseudonym;
            } else if (isReassign) {
              patch.operator_pseudonym_snapshot = null;
            }
          }
        }

        patch.operator_id = body.operator_id;
      }
    }

    if (isOwner) {
      if (typeof body.receipt_url === "string") {
        patch.receipt_url = body.receipt_url;
      }
      if (body.status === "paid" && current.status === "awaiting_payment") {
        patch.status = "paid";
      }
      if (body.status === "cancelled") {
        const cancellable = ["pending", "processing", "awaiting_payment"];
        if (!cancellable.includes(current.status)) {
          return NextResponse.json(
            { error: "Эту заявку уже нельзя отменить" },
            { status: 400 },
          );
        }
        patch.status = "cancelled";
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data: updated, error: updateError } = await withTimeout(
      actor.admin
        .from("orders")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 503 });
    }

    if (updated) {
      void attachClientToOrder(actor.admin, updated).then((withClient) => {
        void broadcastOrderEvent(
          ORDER_UPDATED_EVENT,
          withClient as Record<string, unknown>,
        );
      });
    }

    const payload = actor.isStaff
      ? updated
        ? await attachClientToOrder(actor.admin, updated)
        : updated
      : updated
        ? stripOrderInternalFields(updated as Record<string, unknown>)
        : updated;

    return NextResponse.json({ order: payload });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
