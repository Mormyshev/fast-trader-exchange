/** Cloudflare test key — always passes. Used only when no real site key is set in development. */
const DEV_SITE_KEY = "1x00000000000000000000AA";

export function getTurnstileSiteKey() {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (key) return key;
  if (process.env.NODE_ENV !== "production") return DEV_SITE_KEY;
  return "";
}
