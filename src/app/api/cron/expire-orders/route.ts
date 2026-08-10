import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { cancelExpiredOrders } from "@/src/utils/orders/expire-orders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  void request.headers.get("user-agent");

  try {
    const admin = createAdminClient();
    const result = await cancelExpiredOrders(admin);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: message }, { status: 503 });
  }
}
