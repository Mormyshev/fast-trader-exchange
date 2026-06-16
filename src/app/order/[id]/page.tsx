import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import OrderStatusClient from "./OrderStatusClient";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderPage({ params }: OrderPageProps) {
  // Получаем id из параметров URL
  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  // Делаем первичный запрос заявки на сервере
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  // Если заявка не найдена или произошла ошибка, отдаем 404 страницу
  if (error || !order) {
    notFound();
  }

  return (
    <main className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 mb-32 mt-8 antialiased">
      {/* Передаем полученную заявку в клиентский Realtime-компонент */}
      <OrderStatusClient initialOrder={order} />
    </main>
  );
}
