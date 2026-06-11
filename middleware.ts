import { type NextRequest } from "next/server";
import { updateSession } from "@/src/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * Перехватываем все маршруты, кроме статики:
         * - _next/static (статические файлы)
         * - _next/image (оптимизированные изображения)
         * - favicon.ico, sitemap.xml, robots.txt
         * - изображения (svg, png, jpg, jpeg, gif, webp)
         */
        "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
