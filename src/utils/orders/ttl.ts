/** Lifetime for unfinished orders (pending → awaiting_payment). */
export const ORDER_TTL_MS = 15 * 60 * 1000;

export const ORDER_TTL_STATUSES = [
  "pending",
  "processing",
  "awaiting_payment",
] as const;

export type OrderTtlStatus = (typeof ORDER_TTL_STATUSES)[number];

export function orderExpiresAt(createdAt: string | Date): number {
  const t =
    typeof createdAt === "string"
      ? new Date(createdAt).getTime()
      : createdAt.getTime();
  return t + ORDER_TTL_MS;
}

export function isOrderExpiredByTtl(
  createdAt: string | Date,
  now = Date.now(),
): boolean {
  return now >= orderExpiresAt(createdAt);
}

export function formatOrderTimeLeft(
  createdAt: string | Date,
  now = Date.now(),
): string {
  const diff = orderExpiresAt(createdAt) - now;
  if (diff <= 0) return "00:00";
  const minutes = Math.floor(diff / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
