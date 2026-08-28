import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { sessionHasRecoveryAmr } from "@/src/utils/supabase/recovery-session";

function safeNextPath(next: string | null, fallback: string) {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  ) {
    return fallback;
  }
  return next;
}

function requestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    new URL(request.url).protocol.replace(":", "");
  if (forwardedHost) return `${proto}://${forwardedHost}`;
  return new URL(request.url).origin;
}

export async function handleAuthCallback(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const origin = requestOrigin(request);
  const fallbackNext =
    type === "recovery" ? "/auth/reset-password" : "/user/orders";
  let next = safeNextPath(requestUrl.searchParams.get("next"), fallbackNext);

  const cookiesToApply: Array<{
    name: string;
    value: string;
    options: CookieOptions;
  }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToApply.push(...cookiesToSet);
        },
      },
    },
  );

  let authenticated = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authenticated = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    authenticated = !error;
  }

  if (!authenticated) {
    const response = applyCookies(
      NextResponse.redirect(new URL("/auth/reset-password?error=invalid", origin)),
      cookiesToApply,
    );
    response.cookies.set("fte_password_recovery", "", {
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (type === "recovery" || sessionHasRecoveryAmr(session?.access_token)) {
    next = "/auth/reset-password";
  } else if (request.cookies.get("fte_password_recovery")?.value === "1") {
    next = "/auth/reset-password";
  }

  const response = applyCookies(
    NextResponse.redirect(new URL(next, origin)),
    cookiesToApply,
  );
  response.cookies.set("fte_password_recovery", "", {
    path: "/",
    maxAge: 0,
  });
  return response;
}

function applyCookies(
  response: NextResponse,
  cookiesToApply: Array<{
    name: string;
    value: string;
    options: CookieOptions;
  }>,
) {
  cookiesToApply.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
