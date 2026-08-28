"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/src/utils/supabase/server";
import { verifyRecaptchaToken } from "@/src/utils/captcha/verify-recaptcha";
import { validateEmail } from "@/src/utils/validation";

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

async function getRequestOrigin() {
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headerList.get("host");
  const proto =
    headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export async function requestPasswordReset(
  email: string,
  captchaToken: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fromCabinet = Boolean(user?.email);
  let targetEmail = user?.email ?? "";

  if (!targetEmail) {
    const captcha = await verifyRecaptchaToken(captchaToken);
    if (!captcha.ok) {
      return { error: captcha.error };
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      return { error: emailCheck.error };
    }
    targetEmail = emailCheck.value;
  }

  const origin = await getRequestOrigin();
  const cookieStore = await cookies();
  cookieStore.set("fte_password_recovery", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  if (error) {
    if (/rate/i.test(error.message)) {
      return { error: "Слишком много попыток. Подождите немного и повторите." };
    }
    console.error("Password reset email error:", error.message);
  }

  return {
    ok: true as const,
    message: fromCabinet
      ? "Письмо отправлено. Перейдите по ссылке из почты, чтобы задать новый пароль."
      : "Если аккаунт с этой почтой есть, мы отправили ссылку для смены пароля.",
  };
}
