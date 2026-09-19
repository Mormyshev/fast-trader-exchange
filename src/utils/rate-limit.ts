import { NextResponse } from "next/server";

type RateBucket = { count: number; resetAt: number };

const buckets = new Map<string, RateBucket>();

function prune(now: number) {
  if (buckets.size < 2000) return;
  for (const [key, value] of buckets) {
    if (value.resetAt <= now) buckets.delete(key);
  }
}

export function getIpFromHeaders(headers?: Headers | null): string {
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const real = headers?.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

export function getRequestIp(request?: Request | null): string {
  return getIpFromHeaders(request?.headers ?? null);
}

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  prune(now);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function rateLimitExceededResponse() {
  return {
    error: "Слишком много попыток. Подождите немного и повторите.",
  };
}

export function rateLimitJsonResponse() {
  return NextResponse.json(rateLimitExceededResponse(), { status: 429 });
}
