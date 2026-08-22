"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { getRecaptchaSiteKey, isRecaptchaEnabled } from "@/src/utils/captcha/site-key";

type GrecaptchaV2 = {
  ready: (cb: () => void) => void;
  render: (
    container: HTMLElement,
    params: {
      sitekey: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark";
      size?: "normal" | "compact";
    },
  ) => number;
  reset: (widgetId?: number) => void;
  getResponse: (widgetId?: number) => string;
};

declare global {
  interface Window {
    grecaptcha?: GrecaptchaV2;
  }
}

const SCRIPT_SRC =
  "https://www.recaptcha.net/recaptcha/api.js?hl=ru&render=explicit";

let scriptPromise: Promise<GrecaptchaV2> | null = null;

function loadRecaptchaV2(): Promise<GrecaptchaV2> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("reCAPTCHA is client-only"));
  }
  if (window.grecaptcha?.render) {
    return Promise.resolve(window.grecaptcha);
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<GrecaptchaV2>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    const onReady = () => {
      const api = window.grecaptcha;
      if (!api?.ready || !api.render) {
        reject(new Error("reCAPTCHA failed to initialize"));
        return;
      }
      api.ready(() => resolve(api));
    };

    if (existing) {
      if (window.grecaptcha?.render) {
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
    script.src = SCRIPT_SRC;
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

export type RecaptchaV2Handle = {
  reset: () => void;
  getToken: () => string;
};

export const RecaptchaV2 = forwardRef<
  RecaptchaV2Handle,
  { onChange: (token: string) => void }
>(function RecaptchaV2({ onChange }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current === null || !window.grecaptcha?.reset) return;
      window.grecaptcha.reset(widgetIdRef.current);
      onChangeRef.current("");
    },
    getToken() {
      if (widgetIdRef.current === null || !window.grecaptcha?.getResponse) {
        return "";
      }
      return window.grecaptcha.getResponse(widgetIdRef.current);
    },
  }));

  useEffect(() => {
    if (!isRecaptchaEnabled()) return;

    let cancelled = false;

    void loadRecaptchaV2()
      .then((api) => {
        if (cancelled || !hostRef.current || widgetIdRef.current !== null) {
          return;
        }
        api.ready(() => {
          if (cancelled || !hostRef.current || widgetIdRef.current !== null) {
            return;
          }
          widgetIdRef.current = api.render(hostRef.current, {
            sitekey: getRecaptchaSiteKey(),
            callback: (token) => onChangeRef.current(token),
            "expired-callback": () => onChangeRef.current(""),
            "error-callback": () => onChangeRef.current(""),
          });
        });
      })
      .catch(() => {
        if (!cancelled) onChangeRef.current("");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isRecaptchaEnabled()) return null;

  return (
    <div className="flex justify-center overflow-x-auto">
      <div ref={hostRef} />
    </div>
  );
});
