export function getRecaptchaSiteKey() {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ?? "";
}

/** На сервере и в браузере капча нужна только в production-сборке. */
export function isRecaptchaEnabled() {
  return process.env.NODE_ENV === "production";
}
