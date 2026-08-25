import { NextResponse } from "next/server";

export const STAFF_INACTIVE_ERROR =
  "Включите активный режим, чтобы брать заявки, чаты и выполнять рабочие действия.";

export const STAFF_OPEN_ORDER_STATUSES = [
  "processing",
  "awaiting_payment",
  "paid",
] as const;

export const STAFF_HAS_OPEN_ORDERS_ERROR =
  "Нельзя выключить активный режим, пока у вас есть заявки в работе. Сначала завершите ордер или попросите администратора сменить оператора.";

export function isStaffOnDuty(
  profile: { staff_active?: boolean | null } | null | undefined,
): boolean {
  return profile?.staff_active === true;
}

export function staffInactiveResponse() {
  return NextResponse.json(
    { error: STAFF_INACTIVE_ERROR, code: "STAFF_INACTIVE" },
    { status: 403 },
  );
}

export function staffHasOpenOrdersResponse(count: number) {
  return NextResponse.json(
    {
      error: STAFF_HAS_OPEN_ORDERS_ERROR,
      code: "HAS_OPEN_ORDERS",
      count,
    },
    { status: 409 },
  );
}

export async function countStaffOpenOrders(
  admin: { from: (table: string) => any },
  operatorId: string,
): Promise<number> {
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("operator_id", operatorId)
    .in("status", [...STAFF_OPEN_ORDER_STATUSES]);
  return count ?? 0;
}

export function formatOpenOrdersCount(count: number): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return `${count} заявок`;
  if (n1 === 1) return `${count} заявка`;
  if (n1 >= 2 && n1 <= 4) return `${count} заявки`;
  return `${count} заявок`;
}
