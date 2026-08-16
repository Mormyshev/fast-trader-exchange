"use client";

import { useEffect, useRef } from "react";
import { getTurnstileSiteKey } from "@/src/utils/captcha/site-key";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      language?: string;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Turnstile is client-only"));
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  const promise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    const onReady = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile failed to initialize"));
    };

    if (existing) {
      if (window.turnstile) {
        resolve(window.turnstile);
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

  scriptPromise = promise;
  void promise.catch(() => {
    scriptPromise = null;
  });

  return promise;
}

export default function TurnstileCaptcha({
  onToken,
  resetSignal = 0,
}: {
  onToken: (token: string | null) => void;
  resetSignal?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  const siteKey = getTurnstileSiteKey();

  useEffect(() => {
    if (!siteKey || !hostRef.current) return;

    let cancelled = false;
    const host = hostRef.current;

    void loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !host) return;
        host.innerHTML = "";
        widgetIdRef.current = turnstile.render(host, {
          sitekey: siteKey,
          theme: "light",
          language: "ru",
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
      if (id && window.turnstile) {
        try {
          window.turnstile.remove(id);
        } catch {
          // ignore
        }
      }
      host.innerHTML = "";
      onTokenRef.current(null);
    };
  }, [siteKey, resetSignal]);

  if (!siteKey) {
    return (
      <p className="text-xs font-semibold text-red-500 text-center">
        Капча не настроена. Добавьте NEXT_PUBLIC_TURNSTILE_SITE_KEY и
        TURNSTILE_SECRET_KEY.
      </p>
    );
  }

  return (
    <div className="flex justify-center min-h-[65px]">
      <div ref={hostRef} />
    </div>
  );
}
