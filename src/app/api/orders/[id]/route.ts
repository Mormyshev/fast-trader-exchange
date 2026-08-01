import { NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";

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
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    return {
      user,
      admin,
      role: profile?.role || "user",
      isStaff: profile?.role === "operator" || profile?.role === "admin",
    };
  } catch {
    return null;
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const actor = await getActor();

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: order, error } = await actor.admin
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (order.user_id !== actor.user.id && !actor.isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ order });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const actor = await getActor();

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { data: order, error: loadError } = await actor.admin
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = order.user_id === actor.user.id;

  if (!isOwner && !actor.isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};

  if (actor.isStaff) {
    if (typeof body.payment_details === "string") {
      patch.payment_details = body.payment_details;
    }
    if (typeof body.status === "string") {
      patch.status = body.status;
    }
    if (typeof body.operator_id === "string" || body.operator_id === null) {
      // claim: не перезаписываем, если заявку уже взял другой оператор
      if (
        typeof body.operator_id === "string" &&
        order.operator_id &&
        order.operator_id !== body.operator_id
      ) {
        return NextResponse.json(
          { error: "Эту заявку уже забрал другой оператор" },
          { status: 409 },
        );
      }
      patch.operator_id = body.operator_id;
    }
  }

  if (isOwner) {
    if (typeof body.receipt_url === "string") {
      patch.receipt_url = body.receipt_url;
    }
    if (body.status === "paid" && order.status === "awaiting_payment") {
      patch.status = "paid";
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await actor.admin
    .from("orders")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ order: updated });
}
