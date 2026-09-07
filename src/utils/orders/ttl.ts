import {
  paymentIssuedAtFromDetails,
  ttlStartedAtFromDetails,
} from "@/src/utils/orders/payment-details";

/** Lifetime for unfinished orders (pending → awaiting_payment). */
export const ORDER_TTL_MS = 15 * 60 * 1000;

export const ORDER_TTL_STATUSES = [
  "pending",
  "processing",
  "awaiting_payment",
] as const;

export type OrderTtlStatus = (typeof ORDER_TTL_STATUSES)[number];

export type OrderTtlSource = {
  created_at: string;
  status?: string;
  payment_issued_at?: string | null;
  payment_details?: string | null;
  updated_at?: string | null;
};

function laterIso(a: string, b: string | null | undefined): string {
  if (!b) return a;
  const aMs = new Date(a).getTime();
  const bMs = new Date(b).getTime();
  if (!Number.isFinite(bMs)) return a;
  if (!Number.isFinite(aMs) || bMs > aMs) return b;
  return a;
}

function latestFreshRestart(order: OrderTtlSource): string | null {
  const stamps = [
    ttlStartedAtFromDetails(order.payment_details),
    paymentIssuedAtFromDetails(order.payment_details),
    order.payment_issued_at,
  ].filter((value): value is string => Boolean(value));

  let latest: string | null = null;
  for (const stamp of stamps) {
    latest = latest ? laterIso(latest, stamp) : stamp;
  }
  if (latest && !isOrderExpiredByTtl(latest)) return latest;
  return null;
}

/** After requisites are issued, payment window starts from that moment. */
export function orderTtlStartedAt(order: OrderTtlSource): string {
  if (order.status === "awaiting_payment") {
    if (order.payment_issued_at) return order.payment_issued_at;
    const fromDetails = paymentIssuedAtFromDetails(order.payment_details);
    if (fromDetails) return fromDetails;
    if (order.updated_at) return order.updated_at;
  }
  if (order.status === "processing") {
    const restarted = latestFreshRestart(order);
    if (restarted) return restarted;
  }
  return order.created_at;
}

export function isPaymentIssuedColumnMissing(
  error: { message?: string } | null | undefined,
): boolean {
  const message = error?.message ?? "";
  return (
    /payment_issued_at/i.test(message) &&
    (/does not exist/i.test(message) || /schema cache/i.test(message))
  );
}

export function stripPaymentIssuedField(fields: string): string {
  return fields
    .replace(/,\s*payment_issued_at\b/g, "")
    .replace(/\bpayment_issued_at\s*,\s*/g, "");
}

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
