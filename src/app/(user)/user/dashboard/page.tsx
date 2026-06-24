import { createClient } from "@/src/utils/supabase/server";
import { redirect } from "next/navigation";

// Импортируем созданные варианты панелей
import ClientDashboard from "./components/ClientDashboard";
import OperatorDashboard from "./components/OperatorDashboard";
import AdminDashboard from "./components/AdminDashboard";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Получаем сессию на сервере (это быстро и безопасно)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Если сессии нет — жесткий редирект на главную
  if (error || !user) {
    redirect("/?auth=required");
  }

  // Запрашиваем роль из таблицы 'profiles'
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const currentRole = profile?.role || "user"; // Если роли нет, по умолчанию 'user' (клиент)

  return (
    <div className="min-h-screen bg-zinc-50/50">
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        {/* Рендеринг интерфейса на основе роли из базы данных Supabase */}
        {currentRole === "admin" && <AdminDashboard />}

        {currentRole === "operator" && <OperatorDashboard />}

        {currentRole === "user" && (
          <ClientDashboard userEmail={user.email || "Пользователь"} />
        )}
      </div>
    </div>
  );
}
