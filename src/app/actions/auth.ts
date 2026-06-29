"use server";

import { createClient } from "@/src/utils/supabase/server";

export async function loginAndGetRoute(email: string, password: string) {
  const supabase = await createClient();

  // 1. Авторизуем на сервере
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError) {
    if (authError.message.includes("Invalid login credentials")) {
      return { error: "Неверный логин или пароль" };
    }
    return { error: authError.message };
  }

  // 2. Сразу же запрашиваем роль на сервере в рамках одного процесса
  try {
    const userId = authData.user?.id;
    if (!userId) return { route: "/user/dashboard" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profile?.role === "operator" || profile?.role === "admin") {
      return { route: "/operator/dashboard" };
    }
  } catch (err) {
    console.error("Server Action Role Error:", err);
  }

  return { route: "/user/dashboard" };
}
