import { NextResponse, type NextRequest } from "next/server";

export function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization")?.trim();
  const header = request.headers.get("x-cron-secret")?.trim();
  return auth === `Bearer ${secret}` || header === secret;
}

export function cronUnauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
