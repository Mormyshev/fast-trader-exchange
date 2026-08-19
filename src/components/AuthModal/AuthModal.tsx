"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { loginAndGetRoute } from "@/src/app/actions/auth";
import { validateEmail, validatePassword } from "@/src/utils/validation";
import {
  executeRecaptcha,
  preloadRecaptcha,
} from "@/src/utils/captcha/recaptcha-v3";
import { lockPageScroll, unlockPageScroll } from "@/src/utils/lenis-bridge";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
}

export default function AuthModal({
  isOpen,
  onClose,
  onSwitchToRegister,
}: AuthModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimated, setIsAnimated] = useState(isOpen);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsAnimated(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }

    setError("");
    setIsLoading(false);
    setShouldRender(true);
    lockPageScroll();
    void preloadRecaptcha().catch(() => {});
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

    setIsLoading(true);

    try {
      const captchaToken = await executeRecaptcha("login");
      const result = await loginAndGetRoute(
        emailCheck.value,
        passwordCheck.value,
        captchaToken,
      );

      if (result.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      if (result.route) {
        setLogin("");
        setPassword("");
        setIsLoading(false);
        onClose();
        window.location.href = result.route;
      }
    } catch {
      setIsLoading(false);
      setError("Не удалось проверить капчу. Обновите страницу и попробуйте снова.");
    }
  };

  return (
    <div
      data-lenis-prevent
      className={`fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
        isOpen && isAnimated
          ? "opacity-100"
          : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={`relative w-full max-w-[480px] bg-white text-zinc-900 rounded-[32px] p-8 md:p-10 shadow-2xl z-10 border border-zinc-100 transform transition-all duration-300 ease-in-out ${
          isAnimated ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-600"
          disabled={isLoading}
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl md:text-2xl font-bold text-center text-[#2A2A2A] mb-6">
          Авторизация
        </h2>

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
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#FFDD2D] hover:bg-[#e6c628] disabled:bg-zinc-200 disabled:text-zinc-400 text-zinc-900 font-bold py-3.5 rounded-full shadow-xs transition-all flex items-center justify-center"
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

        <div className="mt-6 text-center text-xs font-semibold">
          <span className="text-zinc-400">Ещё нет аккаунта? </span>
          <button
            onClick={onSwitchToRegister}
            className="text-amber-400 hover:underline"
            disabled={isLoading}
          >
            Создать аккаунт
          </button>
        </div>
      </div>
    </div>
  );
}
