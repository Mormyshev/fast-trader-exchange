import { type NextRequest } from "next/server";
import { updateSession } from "@/src/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Перехватываем все маршруты, КРОМЕ:
     * - _next/static (статические файлы)
     * - _next/image (оптимизированные изображения)
     * - favicon.ico, sitemap.xml, robots.txt
     * - изображений (svg, png, jpg, jpeg, gif, webp)
     * - Любых запросов к API и базе данных (исключаем из middleware, чтобы избежать deadlock)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
// export async function middleware(request: NextRequest) {
//   // Временно отключаем проверку сессии для теста
//   return NextResponse.next();
// }
