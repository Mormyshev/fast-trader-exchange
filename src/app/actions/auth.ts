"use server";

import { createClient } from "@/src/utils/supabase/server";
import { verifyRecaptchaToken } from "@/src/utils/captcha/verify-recaptcha";

export async function loginAndGetRoute(
  email: string,
  password: string,
  captchaToken: string,
) {
  const captcha = await verifyRecaptchaToken(captchaToken);
  if (!captcha.ok) {
    return { error: captcha.error };
  }

  const supabase = await createClient();

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
    if (!userId) return { route: "/user/orders" };

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

  return { route: "/user/orders" };
}
