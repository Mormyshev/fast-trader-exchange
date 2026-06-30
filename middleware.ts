import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/src/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  // 2. Вызываем проверку сессии ТОЛЬКО при реальной перезагрузке или переходе на страницу в браузере
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Перехватываем только страницы. Полностью исключаем файлы, картинки и статику.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
