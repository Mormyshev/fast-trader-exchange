import { createClient } from "@/src/utils/supabase/server";
import { redirect } from "next/navigation";
import StaffLayoutClient from "./StaffLayoutClient";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // 1. Проверяем сессию на сервере (без запроса в БД, за 1 мс)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/");
  }

  // 2. Получаем роль напрямую из базы данных на сервере
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "user";

  // Жесткий барьер безопасности на сервере
  if (role !== "operator" && role !== "admin") {
    redirect("/user/dashboard");
  }

  // Передаем роль в ваш клиентский интерфейс
  return <StaffLayoutClient role={role}>{children}</StaffLayoutClient>;
}
