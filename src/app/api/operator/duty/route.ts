import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { requireStaff } from "@/src/utils/chat/auth";
import {
  countStaffOpenOrders,
  isStaffOnDuty,
  staffHasOpenOrdersResponse,
} from "@/src/utils/staff/duty";

export async function GET() {
  try {
    const staff = await requireStaff();
    if (!staff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const openOrdersCount = await countStaffOpenOrders(
      staff.admin,
      staff.user.id,
    );

    return NextResponse.json({
      staff_active: isStaffOnDuty(staff.profile),
      open_orders_count: openOrdersCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const staff = await requireStaff();
    if (!staff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.staff_active !== "boolean") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    if (!body.staff_active) {
      const openOrdersCount = await countStaffOpenOrders(
        staff.admin,
        staff.user.id,
      );
      if (openOrdersCount > 0) {
        return staffHasOpenOrdersResponse(openOrdersCount);
      }
    }

    const { data, error } = await withTimeout(
      staff.admin
        .from("profiles")
        .update({
          staff_active: body.staff_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", staff.user.id)
        .select("staff_active")
        .single(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    const openOrdersCount = body.staff_active
      ? await countStaffOpenOrders(staff.admin, staff.user.id)
      : 0;

    return NextResponse.json({
      staff_active: isStaffOnDuty(data),
      open_orders_count: openOrdersCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
