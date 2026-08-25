import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import { cancelExpiredOrders } from "@/src/utils/orders/expire-orders";
import {
  isOrderNumberColumnMissing,
  stripOrderNumberField,
} from "@/src/utils/orders/public-number";

const IN_PROGRESS_STATUSES = [
  "processing",
  "awaiting_payment",
  "paid",
] as const;

const SCOPES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
  "all",
  "active",
] as const;
type Scope = (typeof SCOPES)[number];

function parseScope(raw: string | null): Scope {
  if (raw && (SCOPES as readonly string[]).includes(raw)) {
    return raw as Scope;
  }
  return "pending";
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getUserFast(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scope = parseScope(request.nextUrl.searchParams.get("scope"));
    const admin = createAdminClient();

    await cancelExpiredOrders(admin);

    const fieldsWithNumber =
      "id, created_at, status, currency_from, currency_to, amount_from, amount_to, wallet_to, payment_details, receipt_url, operator_receipt_url, order_number";

    const buildQuery = (fields: string) => {
      let query = admin
        .from("orders")
        .select(fields)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (scope === "pending") {
        query = query.eq("status", "pending");
      } else if (scope === "in_progress" || scope === "active") {
        query =
          scope === "active"
            ? query.in("status", ["pending", ...IN_PROGRESS_STATUSES])
            : query.in("status", [...IN_PROGRESS_STATUSES]);
      } else if (scope === "completed") {
        query = query.eq("status", "completed");
      } else if (scope === "cancelled") {
        query = query.eq("status", "cancelled");
      }

      return query;
    };

    let { data, error } = await buildQuery(fieldsWithNumber);
    if (error && isOrderNumberColumnMissing(error)) {
      ({ data, error } = await buildQuery(stripOrderNumberField(fieldsWithNumber)));
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: data ?? [], scope });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
