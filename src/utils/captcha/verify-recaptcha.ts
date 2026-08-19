const SITEVERIFY_URL = "https://www.recaptcha.net/recaptcha/api/siteverify";
const MIN_SCORE = 0.3;

function getSecret() {
  return process.env.RECAPTCHA_SECRET_KEY?.trim() ?? "";
}

const ERROR_TEXT: Record<string, string> = {
  "missing-input-secret": "Секретный ключ капчи не задан. Перезапустите сервер после правки .env.local.",
  "invalid-input-secret": "Секретный ключ капчи неверный. Проверьте RECAPTCHA_SECRET_KEY.",
  "missing-input-response": "Токен капчи не получен. Обновите страницу.",
  "invalid-input-response": "Токен капчи устарел. Попробуйте войти ещё раз.",
  "timeout-or-duplicate": "Токен капчи уже использован. Попробуйте ещё раз.",
  "bad-request": "Google отклонил запрос капчи.",
};

export async function verifyRecaptchaToken(
  token: string | null | undefined,
  expectedAction = "login",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = getSecret();
  if (!secret) {
    return {
      ok: false,
      error:
        "Секретный ключ капчи не загружен. Перезапустите npm run dev после сохранения .env.local.",
    };
  }
  if (!token?.trim()) {
    return { ok: false, error: "Не удалось получить токен капчи." };
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
      score?: number;
      action?: string;
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

    if (typeof json.score === "number" && json.score < MIN_SCORE) {
      console.warn("[recaptcha] low score", json.score);
      return { ok: false, error: "Подтвердите, что вы не робот" };
    }

    if (json.action && json.action !== expectedAction) {
      console.warn("[recaptcha] action mismatch", json.action, expectedAction);
      return { ok: false, error: "Подтвердите, что вы не робот" };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось связаться с Google reCAPTCHA." };
  }
}
