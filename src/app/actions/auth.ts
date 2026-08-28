"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/src/utils/supabase/server";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
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

async function getAuthRedirectOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  return getRequestOrigin();
}

export async function requestPasswordReset(
  email: string,
  captchaToken: string,
) {
  const supabase = await createClient();

  let fromCabinet = false;
  let targetEmail = "";

  if (email.trim()) {
    const captcha = await verifyRecaptchaToken(captchaToken);
    if (!captcha.ok) {
      return { error: captcha.error };
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      return { error: emailCheck.error };
    }
    targetEmail = emailCheck.value;
  } else {
    const user = await getUserFast(supabase, 4000);
    if (!user?.email) {
      return { error: "Укажите email" };
    }
    targetEmail = user.email;
    fromCabinet = true;
  }

  const origin = await getAuthRedirectOrigin();
  const reset = await withTimeout(
    supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${origin}/auth/reset-password`,
    }),
    12000,
    {
      data: {},
      error: { message: "timeout" },
    } as unknown as Awaited<ReturnType<typeof supabase.auth.resetPasswordForEmail>>,
  );

  if (reset.error) {
    const message = reset.error.message || "";
    if (/rate/i.test(message)) {
      return {
        error:
          "Слишком много попыток. Подождите около часа и запросите письмо ещё раз.",
      };
    }
    if (/timeout/i.test(message)) {
      return {
        error: "Сервер авторизации не ответил. Попробуйте ещё раз через минуту.",
      };
    }
    console.error("Password reset email error:", message);
    return { error: "Не удалось отправить письмо. Попробуйте позже." };
  }

  const cookieStore = await cookies();
  cookieStore.set("fte_password_recovery", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });

  return {
    ok: true as const,
    message: fromCabinet
      ? "Письмо отправлено. Перейдите по ссылке из почты, чтобы задать новый пароль."
      : "Если аккаунт с этой почтой есть, мы отправили ссылку для смены пароля.",
  };
}
