export function getRecaptchaSiteKey() {
  const key = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
  if (!key) {
    throw new Error("NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set");
  }
  return key;
}
