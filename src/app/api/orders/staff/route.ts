import { NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import { cancelExpiredOrders } from "@/src/utils/orders/expire-orders";
import { attachClientsToOrders } from "@/src/utils/orders/attach-client";
import { STAFF_OPEN_ORDER_STATUSES } from "@/src/utils/staff/duty";
import { canReassignOrders } from "@/src/utils/staff/permissions";
import {
  isOrderNumberColumnMissing,
  stripOrderNumberField,
} from "@/src/utils/orders/public-number";

const ORDER_FIELDS =
  "id, created_at, status, user_id, operator_id, operator_pseudonym_snapshot, order_number, currency_from, currency_to, amount_from, amount_to, wallet_from, wallet_to, tx_hash, payment_details, receipt_url, operator_receipt_url";

type AdminClient = ReturnType<typeof createAdminClient>;

async function loadStaffOrders(
  admin: AdminClient,
  userId: string,
  isAdmin: boolean,
  includeTeamQueue: boolean,
  fields: string,
) {
  const completedQuery = admin
    .from("orders")
    .select(fields)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(50);

  const completedCountQuery = admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");

  const cancelledBase = admin
    .from("orders")
    .select(fields)
    .eq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(100);

  const [pendingRes, mineRes, completedRes, completedCountRes, cancelledRes] =
    await Promise.all([
      admin
        .from("orders")
        .select(fields)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      admin
        .from("orders")
        .select(fields)
        .in("status", [...STAFF_OPEN_ORDER_STATUSES])
        .eq("operator_id", userId)
        .order("created_at", { ascending: false }),
      isAdmin ? completedQuery : completedQuery.eq("operator_id", userId),
      isAdmin
        ? completedCountQuery
        : completedCountQuery.eq("operator_id", userId),
      isAdmin
        ? cancelledBase
        : cancelledBase.or(`operator_id.eq.${userId},operator_id.is.null`),
    ]);

  const firstError =
    pendingRes.error ||
    mineRes.error ||
    completedRes.error ||
    completedCountRes.error ||
    cancelledRes.error;

  if (firstError) {
    return { error: firstError };
  }

  let teamRows: typeof mineRes.data = [];
  if (includeTeamQueue) {
    const teamRes = await admin
      .from("orders")
      .select(fields)
      .in("status", [...STAFF_OPEN_ORDER_STATUSES])
      .not("operator_id", "is", null)
      .order("created_at", { ascending: false });
    if (teamRes.error) {
      return { error: teamRes.error };
    }
    teamRows = teamRes.data ?? [];
  }

  return {
    error: null,
    pendingRes,
    mineRes,
    completedRes,
    completedCountRes,
    cancelledRes,
    teamRows,
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getUserFast(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role, is_senior_operator")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "operator" && profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isAdmin = profile.role === "admin";
    const includeTeamQueue = canReassignOrders(profile);

    await cancelExpiredOrders(admin);

    let bundle = await loadStaffOrders(
      admin,
      user.id,
      isAdmin,
      includeTeamQueue,
      ORDER_FIELDS,
    );
    if (bundle.error && isOrderNumberColumnMissing(bundle.error)) {
      bundle = await loadStaffOrders(
        admin,
        user.id,
        isAdmin,
        includeTeamQueue,
        stripOrderNumberField(ORDER_FIELDS),
      );
    }

    if (bundle.error || !("pendingRes" in bundle)) {
      return NextResponse.json(
        { error: bundle.error?.message ?? "Failed to load orders" },
        { status: 500 },
      );
    }

    const asOrderRows = (rows: unknown): Record<string, unknown>[] =>
      Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];

    const [pending, mine, completed, cancelled, teamInProgress] =
      await Promise.all([
        attachClientsToOrders(admin, asOrderRows(bundle.pendingRes.data)),
        attachClientsToOrders(admin, asOrderRows(bundle.mineRes.data)),
        attachClientsToOrders(admin, asOrderRows(bundle.completedRes.data)),
        attachClientsToOrders(admin, asOrderRows(bundle.cancelledRes.data)),
        includeTeamQueue
          ? attachClientsToOrders(admin, asOrderRows(bundle.teamRows))
          : Promise.resolve([]),
      ]);

    return NextResponse.json({
      pending,
      mine,
      completed,
      completedCount: bundle.completedCountRes.count ?? 0,
      cancelled,
      ...(includeTeamQueue ? { teamInProgress } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
