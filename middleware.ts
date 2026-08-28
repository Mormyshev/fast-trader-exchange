import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/src/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestUrl = new URL(request.url);

  // 1. ЖЕСТКАЯ ФИЛЬТРАЦИЯ (Senior-паттерн):
  // Если запрос идет за данными (Fetch / XHR / API / Next.js Data / Realtime)
  // или за статикой, мы СРАЗУ пропускаем его за 0 миллисекунд, минуя тяжелый getUser() в middleware.
  if (
    request.headers.get("x-nextjs-data") ||
    request.headers.get("accept")?.includes("application/json") ||
    pathname.startsWith("/api") ||
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
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
