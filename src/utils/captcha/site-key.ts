/** Official Google reCAPTCHA v2 test keys — always pass. Used when real keys are not set. */
const FALLBACK_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_uXRCLq8";

export function getRecaptchaSiteKey() {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() || FALLBACK_SITE_KEY;
}
