import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 1. Сначала синхронно обновляем куки в объекте запроса
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          // 2. Создаем ОДИН новый объект ответа (а не внутри цикла!)
          supabaseResponse = NextResponse.next({ request });

          // 3. Записываем все куки в итоговый ответ сервера
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Важно: этот вызов обновляет просроченный токен (раз в час)
  await supabase.auth.getUser();

  return supabaseResponse;
}
