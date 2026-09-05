"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/src/utils/supabase/client";
import {
  validatePassword,
  validatePasswordConfirm,
} from "@/src/utils/validation";
import PasswordInput from "@/src/components/PasswordInput/PasswordInput";

const INPUT_CLASS =
  "w-full h-12 bg-white border border-zinc-200 rounded-full px-6 text-sm font-medium focus:outline-hidden focus:border-[#FFDD2D]";

const LOGIN_HREF = "/?auth=login";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const leaveReady = useRef(Promise.resolve());

  const linkInvalid = searchParams.get("error") === "invalid";

  useEffect(() => {
    if (linkInvalid) {
      setHasSession(false);
      setReady(true);
      return;
    }

    let cancelled = false;
    let settled = false;

    const finish = (hasUser: boolean) => {
      if (cancelled || settled) return;
      settled = true;
      setHasSession(hasUser);
      setReady(true);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "PASSWORD_RECOVERY" ||
        event === "SIGNED_IN" ||
        (event === "INITIAL_SESSION" && session?.user)
      ) {
        finish(Boolean(session?.user));
      }
    });

    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) finish(true);
    });

    const waitingForExchange =
      typeof window !== "undefined" &&
      (window.location.search.includes("code=") ||
        window.location.search.includes("token_hash=") ||
        window.location.hash.includes("access_token") ||
        window.location.hash.includes("type=recovery"));

    const timer = window.setTimeout(
      () => {
        void supabase.auth.getUser().then(({ data }) => {
          finish(Boolean(data.user));
        });
      },
      waitingForExchange ? 4000 : 800,
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, [supabase, linkInvalid]);

  const goToLogin = () => {
    void leaveReady.current.finally(() => {
      window.location.replace(LOGIN_HREF);
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) {
      setError(passwordCheck.error);
      return;
    }
    const confirmCheck = validatePasswordConfirm(password, passwordConfirm);
    if (!confirmCheck.ok) {
      setError(confirmCheck.error);
      return;
    }

    setIsLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: passwordCheck.value,
    });

    if (updateError) {
      setIsLoading(false);
      setError("Не удалось сохранить пароль. Запросите ссылку ещё раз.");
      return;
    }

    setIsLoading(false);
    setSuccess(true);

    leaveReady.current = (async () => {
      try {
        await Promise.race([
          fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include",
          }),
          new Promise((resolve) => window.setTimeout(resolve, 4000)),
        ]);
      } catch {
        // local sign-out below still clears the recovery session in the browser
      }
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // ignore
      }
    })();

    window.setTimeout(goToLogin, 1400);
  };

  if (!ready) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#FFDD2D] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)] sm:p-7">
      {success ? (
        <div className="space-y-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Пароль обновлён
          </h1>
          <p className="text-sm font-medium leading-relaxed text-zinc-500">
            Теперь войдите в аккаунт с новым паролем.
          </p>
          <button
            type="button"
            onClick={goToLogin}
            className="flex w-full items-center justify-center rounded-xl bg-[#FFDD2D] py-3.5 font-bold text-zinc-900 transition-all hover:bg-[#e6c628]"
          >
            Войти
          </button>
        </div>
      ) : (
        <>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Новый пароль
          </h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-500">
            Придумайте пароль для входа в аккаунт.
          </p>

          {linkInvalid || !hasSession ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-center text-xs font-bold text-red-500">
                Ссылка недействительна или устарела. Запросите новую из формы
                входа.
              </div>
              <a
                href={LOGIN_HREF}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#FFDD2D] text-sm font-bold text-zinc-900 hover:bg-[#e6c628]"
              >
                Ко входу
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              {error ? (
                <div className="rounded-full bg-red-50 px-4 py-2 text-center text-xs font-bold text-red-500">
                  {error}
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="block pl-1 text-xs font-semibold text-zinc-500">
                  Новый пароль *
                </label>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={INPUT_CLASS}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>

              <div className="space-y-2">
                <label className="block pl-1 text-xs font-semibold text-zinc-500">
                  Повторите пароль *
                </label>
                <PasswordInput
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className={INPUT_CLASS}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center rounded-xl bg-[#FFDD2D] py-3.5 font-bold text-zinc-900 transition-all hover:bg-[#e6c628] disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                {isLoading ? "Сохранение…" : "Сохранить пароль"}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#FFDD2D] border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
