"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { loginAndGetRoute, requestPasswordReset } from "@/src/app/actions/auth";
import { validateEmail, validatePassword } from "@/src/utils/validation";
import {
  RecaptchaV2,
  type RecaptchaV2Handle,
} from "@/src/utils/captcha/recaptcha-v2";
import { isRecaptchaEnabled } from "@/src/utils/captcha/site-key";
import { lockPageScroll, unlockPageScroll } from "@/src/utils/lenis-bridge";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
  redirectTo?: string | null;
}

export default function AuthModal({
  isOpen,
  onClose,
  onSwitchToRegister,
  redirectTo,
}: AuthModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimated, setIsAnimated] = useState(isOpen);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [info, setInfo] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const recaptchaRef = useRef<RecaptchaV2Handle>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsAnimated(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }

    setError("");
    setInfo("");
    setIsLoading(false);
    setCaptchaToken("");
    setMode("login");
    recaptchaRef.current?.reset();
    setShouldRender(true);
    lockPageScroll();
    const timer = setTimeout(() => setIsAnimated(true), 10);
    return () => {
      clearTimeout(timer);
      unlockPageScroll();
    };
  }, [isOpen]);

  if (!shouldRender) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const emailCheck = validateEmail(login);
    if (!emailCheck.ok) {
      setError(emailCheck.error);
      return;
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) {
      setError(passwordCheck.error);
      return;
    }

    const token = captchaToken || recaptchaRef.current?.getToken() || "";
    if (isRecaptchaEnabled() && !token) {
      setError("Подтвердите, что вы не робот");
      return;
    }

    setIsLoading(true);

    try {
      const result = await loginAndGetRoute(
        emailCheck.value,
        passwordCheck.value,
        token,
      );

      if (result.error) {
        setError(result.error);
        setCaptchaToken("");
        recaptchaRef.current?.reset();
        setIsLoading(false);
        return;
      }

      if (result.route) {
        setLogin("");
        setPassword("");
        setCaptchaToken("");
        recaptchaRef.current?.reset();
        setIsLoading(false);
        onClose();
        const next =
          redirectTo &&
          (result.route === "/user/orders" || result.route === "/user/dashboard")
            ? redirectTo
            : result.route;
        window.location.href = next;
      }
    } catch {
      setIsLoading(false);
      setCaptchaToken("");
      recaptchaRef.current?.reset();
      setError("Не удалось проверить капчу. Обновите страницу и попробуйте снова.");
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    const emailCheck = validateEmail(login);
    if (!emailCheck.ok) {
      setError(emailCheck.error);
      return;
    }

    const token = captchaToken || recaptchaRef.current?.getToken() || "";
    if (isRecaptchaEnabled() && !token) {
      setError("Подтвердите, что вы не робот");
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestPasswordReset(emailCheck.value, token);
      setCaptchaToken("");
      recaptchaRef.current?.reset();
      if (result.error) {
        setError(result.error);
        return;
      }
      setInfo(result.message ?? "Письмо отправлено, проверьте почту.");
    } catch {
      setError("Не удалось отправить письмо. Попробуйте ещё раз.");
      setCaptchaToken("");
      recaptchaRef.current?.reset();
    } finally {
      setIsLoading(false);
    }
  };

  const switchToForgot = () => {
    setError("");
    setInfo("");
    setPassword("");
    setCaptchaToken("");
    recaptchaRef.current?.reset();
    setMode("forgot");
  };

  const switchToLogin = () => {
    setError("");
    setInfo("");
    setCaptchaToken("");
    recaptchaRef.current?.reset();
    setMode("login");
  };

  return (
    <div
      data-lenis-prevent
      className={`fixed inset-0 z-[80] flex items-center justify-center p-4 bg-zinc-950/35 backdrop-blur-[2px] transition-opacity duration-300 ease-in-out ${
        isOpen && isAnimated
          ? "opacity-100"
          : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={`relative w-full max-w-[420px] overflow-x-hidden overflow-y-auto bg-white text-zinc-900 rounded-2xl p-6 sm:p-7 shadow-[0_24px_80px_rgba(15,23,42,0.12)] z-10 transform transition-all duration-300 ease-in-out ${
          isAnimated ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 size-9 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 flex items-center justify-center transition-colors"
          disabled={isLoading}
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-xl font-bold tracking-tight text-zinc-900 mb-5">
          {mode === "forgot" ? "Восстановление пароля" : "Вход в аккаунт"}
        </h2>

        {mode === "forgot" ? (
          <form onSubmit={handleForgotSubmit} className="space-y-5">
            <p className="text-sm font-medium leading-relaxed text-zinc-500">
              Укажите email аккаунта — отправим ссылку для смены пароля.
            </p>

            {error && (
              <div className="text-xs font-bold text-red-500 text-center bg-red-50 py-2 rounded-full px-4">
                {error}
              </div>
            )}
            {info && (
              <div className="text-xs font-bold text-green-600 text-center bg-green-50 py-3 rounded-2xl px-4">
                {info}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-500 pl-1">
                E-mail *
              </label>
              <input
                type="email"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="w-full h-12 bg-white border border-zinc-200 rounded-full px-6 text-sm font-medium focus:outline-hidden focus:border-[#FFDD2D]"
                required
                disabled={isLoading}
                placeholder="example@mail.com"
              />
            </div>

            <RecaptchaV2 ref={recaptchaRef} onChange={setCaptchaToken} />

            <div className="pt-1">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#FFDD2D] hover:bg-[#e6c628] disabled:bg-zinc-200 disabled:text-zinc-400 text-zinc-900 font-bold py-3.5 rounded-xl shadow-none transition-all flex items-center justify-center"
              >
                {isLoading ? "Отправка..." : "Отправить ссылку"}
              </button>
            </div>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="text-xs font-bold text-red-500 text-center bg-red-50 py-2 rounded-full px-4">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-500 pl-1">
              E-mail *
            </label>
            <input
              type="email"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full h-12 bg-white border border-zinc-200 rounded-full px-6 text-sm font-medium focus:outline-hidden focus:border-[#FFDD2D]"
              required
              disabled={isLoading}
              placeholder="example@mail.com"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-500 pl-1">
              Пароль *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 bg-white border border-zinc-200 rounded-full px-6 text-sm font-medium focus:outline-hidden focus:border-[#FFDD2D]"
              required
              disabled={isLoading}
            />
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={switchToForgot}
                className="text-xs font-semibold text-[#C9A227] hover:underline"
                disabled={isLoading}
              >
                Забыли пароль?
              </button>
            </div>
          </div>

          <RecaptchaV2 ref={recaptchaRef} onChange={setCaptchaToken} />

          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#FFDD2D] hover:bg-[#e6c628] disabled:bg-zinc-200 disabled:text-zinc-400 text-zinc-900 font-bold py-3.5 rounded-xl shadow-none transition-all flex items-center justify-center"
            >
              {isLoading ? "Вход..." : "Войти"}
            </button>
            <p className="mt-3 text-center text-[10px] leading-4 text-zinc-400">
              Этот сайт защищён reCAPTCHA Google.{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-zinc-600"
              >
                Конфиденциальность
              </a>{" "}
              и{" "}
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-zinc-600"
              >
                Условия
              </a>
              .
            </p>
          </div>
        </form>
        )}

        <div className="mt-6 text-center text-xs font-semibold">
          {mode === "forgot" ? (
            <button
              type="button"
              onClick={switchToLogin}
              className="text-[#C9A227] hover:underline"
              disabled={isLoading}
            >
              Вернуться ко входу
            </button>
          ) : (
            <>
              <span className="text-zinc-400">Ещё нет аккаунта? </span>
              <button
                onClick={onSwitchToRegister}
                className="text-[#C9A227] hover:underline"
                disabled={isLoading}
              >
                Создать аккаунт
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
