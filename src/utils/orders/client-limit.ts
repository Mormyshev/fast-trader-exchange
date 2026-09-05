export const CLIENT_OPEN_ORDER_LIMIT = 3;

export const CLIENT_OPEN_ORDER_STATUSES = [
  "pending",
  "processing",
  "awaiting_payment",
  "paid",
] as const;

export const CLIENT_OPEN_ORDER_LIMIT_ERROR =
  "Одновременно можно иметь не больше 3 активных заявок. Дождитесь завершения текущих или отмените лишние.";

export async function countClientOpenOrders(
  admin: { from: (table: string) => any },
  userId: string,
): Promise<number> {
  const { count, error } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", [...CLIENT_OPEN_ORDER_STATUSES]);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
