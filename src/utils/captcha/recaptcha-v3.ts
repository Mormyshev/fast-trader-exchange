"use client";

import { getRecaptchaSiteKey, isRecaptchaEnabled } from "@/src/utils/captcha/site-key";

type GrecaptchaV3 = {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: GrecaptchaV3;
  }
}

let scriptPromise: Promise<GrecaptchaV3> | null = null;

function scriptSrc(siteKey: string) {
  return `https://www.recaptcha.net/recaptcha/api.js?render=${encodeURIComponent(siteKey)}&hl=ru`;
}

export function preloadRecaptcha(): Promise<GrecaptchaV3> {
  if (!isRecaptchaEnabled()) {
    return Promise.reject(new Error("reCAPTCHA is disabled"));
  }

  if (typeof window === "undefined") {
    return Promise.reject(new Error("reCAPTCHA is client-only"));
  }

  const siteKey = getRecaptchaSiteKey();
  if (window.grecaptcha?.execute) return Promise.resolve(window.grecaptcha);
  if (scriptPromise) return scriptPromise;

  const src = scriptSrc(siteKey);
  scriptPromise = new Promise<GrecaptchaV3>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    const onReady = () => {
      const api = window.grecaptcha;
      if (!api?.ready || !api.execute) {
        reject(new Error("reCAPTCHA failed to initialize"));
        return;
      }
      api.ready(() => resolve(api));
    };

    if (existing) {
      if (window.grecaptcha?.execute) {
        onReady();
        return;
      }
      existing.addEventListener("load", onReady, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Не удалось загрузить капчу")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = onReady;
    script.onerror = () => reject(new Error("Не удалось загрузить капчу"));
    document.head.appendChild(script);
  });

  void scriptPromise.catch(() => {
    scriptPromise = null;
  });

  return scriptPromise;
}

export async function executeRecaptcha(action: string): Promise<string> {
  if (!isRecaptchaEnabled()) {
    return "";
  }

  const siteKey = getRecaptchaSiteKey();
  const api = await preloadRecaptcha();

  return new Promise((resolve, reject) => {
    api.ready(() => {
      api
        .execute(siteKey, { action })
        .then((token) => {
          if (!token) reject(new Error("Пустой токен капчи"));
          else resolve(token);
        })
        .catch(reject);
    });
  });
}
