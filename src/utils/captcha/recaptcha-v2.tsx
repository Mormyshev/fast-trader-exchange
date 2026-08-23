"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { getRecaptchaSiteKey, isRecaptchaEnabled } from "@/src/utils/captcha/site-key";

type GrecaptchaV2 = {
  ready?: (cb: () => void) => void;
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
    __onRecaptchaV2Load?: () => void;
  }
}

const CALLBACK_NAME = "__onRecaptchaV2Load";
const SCRIPT_SRC = `https://www.recaptcha.net/recaptcha/api.js?hl=ru&render=explicit&onload=${CALLBACK_NAME}`;

let scriptPromise: Promise<GrecaptchaV2> | null = null;

function resolveApi(): GrecaptchaV2 | null {
  const api = window.grecaptcha;
  return api?.render ? api : null;
}

function loadRecaptchaV2(): Promise<GrecaptchaV2> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("reCAPTCHA is client-only"));
  }

  const existingApi = resolveApi();
  if (existingApi) return Promise.resolve(existingApi);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<GrecaptchaV2>((resolve, reject) => {
    const finish = () => {
      const api = resolveApi();
      if (api) resolve(api);
      else reject(new Error("reCAPTCHA failed to initialize"));
    };

    window[CALLBACK_NAME] = finish;

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      if (resolveApi()) {
        finish();
        return;
      }
      existing.addEventListener("error", () => {
        scriptPromise = null;
        reject(new Error("Не удалось загрузить капчу"));
      }, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Не удалось загрузить скрипт Google reCAPTCHA"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function renderWhenReady(api: GrecaptchaV2, render: () => void) {
  if (api.ready) api.ready(render);
  else render();
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
  const [error, setError] = useState("");
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
    const siteKey = getRecaptchaSiteKey();
    if (!siteKey) {
      setError("Ключ капчи не попал в сборку. Задайте NEXT_PUBLIC_RECAPTCHA_SITE_KEY и пересоберите проект.");
      return;
    }

    let cancelled = false;

    void loadRecaptchaV2()
      .then((api) => {
        if (cancelled || !hostRef.current || widgetIdRef.current !== null) {
          return;
        }
        renderWhenReady(api, () => {
          if (cancelled || !hostRef.current || widgetIdRef.current !== null) {
            return;
          }
          widgetIdRef.current = api.render(hostRef.current, {
            sitekey: siteKey,
            callback: (token) => onChangeRef.current(token),
            "expired-callback": () => onChangeRef.current(""),
            "error-callback": () => onChangeRef.current(""),
          });
          setError("");
        });
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || "Не удалось загрузить капчу");
          onChangeRef.current("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isRecaptchaEnabled() && !error) return null;

  return (
    <div className="space-y-2">
      <div className="flex min-h-[78px] justify-center overflow-x-auto">
        <div ref={hostRef} />
      </div>
      {error ? (
        <p className="text-center text-[11px] font-semibold leading-relaxed text-rose-500">
          {error}
        </p>
      ) : null}
    </div>
  );
});
