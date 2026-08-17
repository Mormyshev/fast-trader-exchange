"use client";

import { useEffect, useRef } from "react";
import { getRecaptchaSiteKey } from "@/src/utils/captcha/site-key";

const SCRIPT_SRC =
  "https://www.recaptcha.net/recaptcha/api.js?onload=__onRecaptchaLoad&render=explicit&hl=ru";

type GrecaptchaApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark";
    },
  ) => number;
  reset: (widgetId?: number) => void;
};

declare global {
  interface Window {
    grecaptcha?: GrecaptchaApi;
    __onRecaptchaLoad?: () => void;
  }
}

let scriptPromise: Promise<GrecaptchaApi> | null = null;

function loadRecaptcha(): Promise<GrecaptchaApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("reCAPTCHA is client-only"));
  }
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  if (scriptPromise) return scriptPromise;

  const promise = new Promise<GrecaptchaApi>((resolve, reject) => {
    const prev = window.__onRecaptchaLoad;
    window.__onRecaptchaLoad = () => {
      prev?.();
      if (window.grecaptcha?.render) resolve(window.grecaptcha);
      else reject(new Error("reCAPTCHA failed to initialize"));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      if (window.grecaptcha?.render) {
        resolve(window.grecaptcha);
      }
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Не удалось загрузить капчу"));
    document.head.appendChild(script);
  });

  scriptPromise = promise;
  void promise.catch(() => {
    scriptPromise = null;
  });

  return promise;
}

export default function RecaptchaCheckbox({
  onToken,
  resetSignal = 0,
}: {
  onToken: (token: string | null) => void;
  resetSignal?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  const siteKey = getRecaptchaSiteKey();

  useEffect(() => {
    if (!hostRef.current) return;

    let cancelled = false;
    const host = hostRef.current;

    void loadRecaptcha()
      .then((grecaptcha) => {
        if (cancelled || !host) return;
        host.innerHTML = "";
        widgetIdRef.current = grecaptcha.render(host, {
          sitekey: siteKey,
          theme: "light",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => {
        if (!cancelled) onTokenRef.current(null);
      });

    return () => {
      cancelled = true;
      const id = widgetIdRef.current;
      widgetIdRef.current = null;
      if (id !== null && window.grecaptcha) {
        try {
          window.grecaptcha.reset(id);
        } catch {
          // ignore
        }
      }
      host.innerHTML = "";
      onTokenRef.current(null);
    };
  }, [siteKey, resetSignal]);

  return (
    <div className="flex justify-center min-h-[78px]">
      <div ref={hostRef} />
    </div>
  );
}
