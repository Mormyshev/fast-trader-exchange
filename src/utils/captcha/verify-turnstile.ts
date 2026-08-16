const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare test secret — always passes. Development only. */
const DEV_SECRET_KEY = "1x0000000000000000000000000000000AA";

function getSecret() {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return DEV_SECRET_KEY;
  return "";
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<boolean> {
  const secret = getSecret();
  if (!secret || !token?.trim()) return false;

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
