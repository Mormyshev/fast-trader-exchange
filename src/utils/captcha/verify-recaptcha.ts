const SITEVERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

/** Official Google reCAPTCHA v2 test secret — always passes. */
const FALLBACK_SECRET_KEY = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNLuza6t4JOeif";

function getSecret() {
  return process.env.RECAPTCHA_SECRET_KEY?.trim() || FALLBACK_SECRET_KEY;
}

export async function verifyRecaptchaToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<boolean> {
  const secret = getSecret();
  if (!token?.trim()) return false;

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token.trim());
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
