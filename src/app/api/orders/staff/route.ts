import { NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";

const IN_PROGRESS = ["processing", "awaiting_payment", "paid"] as const;

const ORDER_FIELDS =
  "id, created_at, status, user_id, operator_id, currency_from, currency_to, amount_from, amount_to, wallet_from, wallet_to, tx_hash, payment_details, receipt_url";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const [pendingRes, mineRes, completedRes, completedCountRes] =
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
    ]);

  const firstError =
    pendingRes.error ||
    mineRes.error ||
    completedRes.error ||
    completedCountRes.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  return NextResponse.json({
    pending: pendingRes.data ?? [],
    mine: mineRes.data ?? [],
    completed: completedRes.data ?? [],
    completedCount: completedCountRes.count ?? 0,
  });
}
