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

export function orderRemainingMs(
  createdAt: string | Date,
  now = Date.now(),
): number {
  return Math.max(0, orderExpiresAt(createdAt) - now);
}

export function formatOrderTimeLeft(
  createdAt: string | Date,
  now = Date.now(),
): string {
  const diff = orderRemainingMs(createdAt, now);
  if (diff <= 0) return "00:00";
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** 1 = полный срок, 0 = время вышло. */
export function orderTtlProgress(
  createdAt: string | Date,
  now = Date.now(),
): number {
  const remaining = orderExpiresAt(createdAt) - now;
  return Math.min(1, Math.max(0, remaining / ORDER_TTL_MS));
}
