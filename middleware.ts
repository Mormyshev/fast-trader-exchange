import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/src/utils/supabase/middleware";

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function isAllowedApiOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite === "same-origin") return true;

  const origin = request.headers.get("origin")?.trim();
  const referer = request.headers.get("referer")?.trim();
  const candidate = origin || referer;
  if (!candidate) return false;
  try {
    const originHost = new URL(candidate).host;
    const requestHost = request.headers.get("host");
    if (requestHost && originHost === requestHost) return true;
    const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (site && new URL(site).host === originHost) return true;
  } catch {
    return false;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestUrl = new URL(request.url);

  if (pathname.startsWith("/api")) {
    if (
      MUTATING.has(request.method) &&
      !pathname.startsWith("/api/cron/") &&
      !isAllowedApiOrigin(request)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (
    request.headers.get("x-nextjs-data") ||
    request.headers.get("accept")?.includes("application/json") ||
    pathname.includes("_next")
  ) {
    return NextResponse.next();
  }

  const isAuthExchangePath =
    pathname === "/auth/callback" || pathname === "/auth/confirm";

  if (isAuthExchangePath) {
    return NextResponse.next({ request });
  }

  // Письмо Supabase часто открывает Site URL (главную) с ?code= или ?token_hash=.
  // Перехватываем это до рендера сайта и отдаём на серверный обмен сессии.
  if (requestUrl.searchParams.has("code") || requestUrl.searchParams.has("token_hash")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    if (
      !url.searchParams.get("next") &&
      (pathname.startsWith("/auth/reset-password") ||
        requestUrl.searchParams.get("type") === "recovery" ||
        request.cookies.get("fte_password_recovery")?.value === "1")
    ) {
      url.searchParams.set("next", "/auth/reset-password");
    }
    return NextResponse.redirect(url);
  }

  // 2. Вызываем проверку сессии ТОЛЬКО при реальной перезагрузке или переходе на страницу в браузере
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Перехватываем страницы, включая корень `/`.
     * Отдельное правило для `/` нужно: общий pattern его не матчит,
     * а письмо сброса пароля часто открывает Site URL с ?code=.
     */
    "/",
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
