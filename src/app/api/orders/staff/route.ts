import { NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import { cancelExpiredOrders } from "@/src/utils/orders/expire-orders";

const IN_PROGRESS = ["processing", "awaiting_payment", "paid"] as const;

const ORDER_FIELDS =
  "id, created_at, status, user_id, operator_id, currency_from, currency_to, amount_from, amount_to, wallet_from, wallet_to, tx_hash, payment_details, receipt_url";

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

    await cancelExpiredOrders(admin);

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
          .in("status", [...IN_PROGRESS])
          .eq("operator_id", user.id)
          .order("created_at", { ascending: false }),
        admin
          .from("orders")
          .select(ORDER_FIELDS)
          .eq("status", "completed")
          .eq("operator_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        admin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .eq("operator_id", user.id),
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

    return NextResponse.json({
      pending: pendingRes.data ?? [],
      mine: mineRes.data ?? [],
      completed: completedRes.data ?? [],
      completedCount: completedCountRes.count ?? 0,
      cancelled: cancelledRes.data ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
