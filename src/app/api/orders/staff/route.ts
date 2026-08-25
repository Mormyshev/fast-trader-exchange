import { NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import { cancelExpiredOrders } from "@/src/utils/orders/expire-orders";
import { attachClientsToOrders } from "@/src/utils/orders/attach-client";
import { STAFF_OPEN_ORDER_STATUSES } from "@/src/utils/staff/duty";

const ORDER_FIELDS =
  "id, created_at, status, user_id, operator_id, operator_pseudonym_snapshot, currency_from, currency_to, amount_from, amount_to, wallet_from, wallet_to, tx_hash, payment_details, receipt_url, operator_receipt_url";

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
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "operator" && profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isAdmin = profile.role === "admin";

    await cancelExpiredOrders(admin);

    const completedQuery = admin
      .from("orders")
      .select(ORDER_FIELDS)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(50);

    const completedCountQuery = admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed");

    const [pendingRes, mineRes, completedRes, completedCountRes, cancelledRes] =
      await Promise.all([
        admin
          .from("orders")
          .select(ORDER_FIELDS)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        admin
          .from("orders")
          .select(ORDER_FIELDS)
          .in("status", [...STAFF_OPEN_ORDER_STATUSES])
          .eq("operator_id", user.id)
          .order("created_at", { ascending: false }),
        isAdmin
          ? completedQuery
          : completedQuery.eq("operator_id", user.id),
        isAdmin
          ? completedCountQuery
          : completedCountQuery.eq("operator_id", user.id),
        admin
          .from("orders")
          .select(ORDER_FIELDS)
          .eq("status", "cancelled")
          .or(`operator_id.eq.${user.id},operator_id.is.null`)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

    const firstError =
      pendingRes.error ||
      mineRes.error ||
      completedRes.error ||
      completedCountRes.error ||
      cancelledRes.error;

    if (firstError) {
      return NextResponse.json({ error: firstError.message }, { status: 500 });
    }

    let teamRows: typeof mineRes.data = [];
    if (isAdmin) {
      const teamRes = await admin
        .from("orders")
        .select(ORDER_FIELDS)
        .in("status", [...STAFF_OPEN_ORDER_STATUSES])
        .not("operator_id", "is", null)
        .order("created_at", { ascending: false });
      if (teamRes.error) {
        return NextResponse.json({ error: teamRes.error.message }, { status: 500 });
      }
      teamRows = teamRes.data ?? [];
    }

    const [pending, mine, completed, cancelled, teamInProgress] = await Promise.all([
      attachClientsToOrders(admin, pendingRes.data ?? []),
      attachClientsToOrders(admin, mineRes.data ?? []),
      attachClientsToOrders(admin, completedRes.data ?? []),
      attachClientsToOrders(admin, cancelledRes.data ?? []),
      isAdmin ? attachClientsToOrders(admin, teamRows ?? []) : Promise.resolve([]),
    ]);

    return NextResponse.json({
      pending,
      mine,
      completed,
      completedCount: completedCountRes.count ?? 0,
      cancelled,
      ...(isAdmin ? { teamInProgress } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
