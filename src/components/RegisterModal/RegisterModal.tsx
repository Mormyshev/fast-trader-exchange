"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { registerAccount } from "@/src/app/actions/auth";
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from "@/src/utils/validation";
import {
  RecaptchaV2,
  type RecaptchaV2Handle,
} from "@/src/utils/captcha/recaptcha-v2";
import { isRecaptchaEnabled } from "@/src/utils/captcha/site-key";
import { lockPageScroll, unlockPageScroll } from "@/src/utils/lenis-bridge";

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
  redirectTo?: string | null;
}

export default function RegisterModal({
  isOpen,
  onClose,
  onSwitchToLogin,
  redirectTo,
}: RegisterModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimated, setIsAnimated] = useState(isOpen);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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
    setSuccessMessage("");
    setIsLoading(false);
    setCaptchaToken("");
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
    setSuccessMessage("");

    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      setError(emailCheck.error);
      return;
    }

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

    if (!agreeTerms) {
      setError("Необходимо согласиться с правилами");
      return;
    }

    const token = captchaToken || recaptchaRef.current?.getToken() || "";
    if (isRecaptchaEnabled() && !token) {
      setError("Подтвердите, что вы не робот");
      return;
    }

    setIsLoading(true);

    try {
      const result = await registerAccount(
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

      setEmail("");
      setPassword("");
      setPasswordConfirm("");
      setAgreeTerms(false);
      setCaptchaToken("");
      recaptchaRef.current?.reset();
      setIsLoading(false);

      if (result.route) {
        onClose();
        const next = redirectTo ?? result.route;
        window.location.href = next;
        return;
      }

      setSuccessMessage(
        "Регистрация успешна! Проверьте почту и перейдите по ссылке для подтверждения аккаунта.",
      );
    } catch {
      setIsLoading(false);
      setCaptchaToken("");
      recaptchaRef.current?.reset();
      setError("Не удалось проверить капчу. Обновите страницу и попробуйте снова.");
    }
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
        className={`relative z-10 w-full max-w-[420px] overflow-x-hidden overflow-y-auto bg-white text-zinc-900 rounded-2xl p-6 sm:p-7 shadow-[0_24px_80px_rgba(15,23,42,0.12)] transform transition-all duration-300 ease-in-out max-h-[90vh] ${
          isAnimated ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 size-9 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 flex items-center justify-center transition-colors z-10"
          disabled={isLoading}
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-xl font-bold tracking-tight text-zinc-900 mb-5">
          Регистрация
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="text-xs font-bold text-red-500 text-center bg-red-50 py-2 rounded-full px-4">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="text-xs font-bold text-green-600 text-center bg-green-50 py-3 rounded-2xl px-4">
              {successMessage}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-500 pl-1">
              E-mail *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 bg-white border border-zinc-200 rounded-full px-6 text-sm font-medium focus:outline-hidden focus:border-[#FFDD2D] transition-all"
              required
              disabled={isLoading || Boolean(successMessage)}
              placeholder="example@mail.com"
              autoComplete="email"
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
              className="w-full h-12 bg-white border border-zinc-200 rounded-full px-6 text-sm font-medium focus:outline-hidden focus:border-[#FFDD2D] transition-all"
              required
              disabled={isLoading || Boolean(successMessage)}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-500 pl-1">
              Повторите пароль *
            </label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full h-12 bg-white border border-zinc-200 rounded-full px-6 text-sm font-medium focus:outline-hidden focus:border-[#FFDD2D] transition-all"
              required
              disabled={isLoading || Boolean(successMessage)}
              autoComplete="new-password"
            />
          </div>

          <RecaptchaV2 ref={recaptchaRef} onChange={setCaptchaToken} />

          <div className="flex items-start space-x-2.5 pt-1">
            <input
              type="checkbox"
              id="agreeTerms"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded-xs border-zinc-300 text-[#FFDD2D] focus:ring-[#FFDD2D] accent-[#FFDD2D] cursor-pointer"
              required
              disabled={isLoading || Boolean(successMessage)}
              style={{ accentColor: "#FFDD2D" }}
            />
            <label
              htmlFor="agreeTerms"
              className="text-[11px] font-medium text-zinc-500 leading-normal cursor-pointer select-none"
            >
              Я согласен с{" "}
              <a
                href="/tos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#C9A227] hover:underline"
              >
                правилами сервиса
              </a>{" "}
              и{" "}
              <a
                href="/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#C9A227] hover:underline"
              >
                обработкой персональных данных
              </a>
            </label>
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoading || Boolean(successMessage)}
              className="w-full bg-[#FFDD2D] hover:bg-[#e6c628] disabled:bg-zinc-200 disabled:text-zinc-400 text-zinc-900 font-bold py-3.5 rounded-xl shadow-none transition-all flex items-center justify-center"
            >
              {isLoading ? "Регистрация..." : "Зарегистрироваться"}
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

        <div className="mt-6 text-center text-xs font-semibold">
          <span className="text-zinc-400">Уже зарегистрированы? </span>
          <button
            onClick={onSwitchToLogin}
            className="text-[#C9A227] hover:underline"
            disabled={isLoading}
          >
            Войти
          </button>
        </div>
      </div>
    </div>
  );
}
