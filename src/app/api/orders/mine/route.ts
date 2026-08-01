import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";

const ACTIVE_STATUSES = [
  "pending",
  "processing",
  "awaiting_payment",
  "paid",
] as const;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = request.nextUrl.searchParams.get("scope") === "all" ? "all" : "active";
  const admin = createAdminClient();

  let query = admin
    .from("orders")
    .select(
      "id, created_at, status, currency_from, currency_to, amount_from, amount_to, wallet_to, payment_details, receipt_url",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (scope === "active") {
    query = query.in("status", [...ACTIVE_STATUSES]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data ?? [], scope });
}
