import { isRecaptchaEnabled } from "@/src/utils/captcha/site-key";

const SITEVERIFY_URL = "https://www.recaptcha.net/recaptcha/api/siteverify";

function getSecret() {
  return process.env.RECAPTCHA_SECRET_KEY?.trim() ?? "";
}

const ERROR_TEXT: Record<string, string> = {
  "missing-input-secret":
    "Секретный ключ капчи не задан. Перезапустите сервер после правки .env.local.",
  "invalid-input-secret":
    "Секретный ключ капчи неверный. Проверьте RECAPTCHA_SECRET_KEY.",
  "missing-input-response": "Токен капчи не получен. Обновите страницу.",
  "invalid-input-response":
    "Токен капчи устарел. Отметьте капчу ещё раз.",
  "timeout-or-duplicate":
    "Токен капчи уже использован. Отметьте капчу ещё раз.",
  "bad-request": "Google отклонил запрос капчи.",
};

export async function verifyRecaptchaToken(
  token: string | null | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isRecaptchaEnabled()) {
    return { ok: true };
  }

  const secret = getSecret();
  if (!secret) {
    return {
      ok: false,
      error:
        "Секретный ключ капчи не загружен. Перезапустите сервер после сохранения ключей.",
    };
  }
  if (!token?.trim()) {
    return { ok: false, error: "Подтвердите, что вы не робот." };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token.trim());

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    const json = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (!json.success) {
      const code = json["error-codes"]?.[0] ?? "";
      console.warn("[recaptcha]", json["error-codes"]);
      return {
        ok: false,
        error: ERROR_TEXT[code] ?? "Подтвердите, что вы не робот",
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось связаться с Google reCAPTCHA." };
  }
}
