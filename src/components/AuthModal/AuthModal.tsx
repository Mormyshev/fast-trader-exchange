"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useLenis } from "lenis/react";
import { loginAndGetRoute } from "@/src/app/actions/auth";
import { validateEmail, validatePassword } from "@/src/utils/validation";
import TurnstileCaptcha from "@/src/components/TurnstileCaptcha/TurnstileCaptcha";

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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const lenis = useLenis();

  const resetCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaReset((n) => n + 1);
  };

  useEffect(() => {
    if (isOpen) {
      setError("");
      setIsLoading(false);
      resetCaptcha();
      setShouldRender(true);
      if (lenis) lenis.stop();
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => setIsAnimated(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimated(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        if (lenis) lenis.start();
        document.body.style.overflow = "";
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, lenis]);

  if (!shouldRender) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!captchaToken) {
      setError("Подтвердите, что вы не робот");
      return;
    }

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

    const result = await loginAndGetRoute(
      emailCheck.value,
      passwordCheck.value,
      captchaToken,
    );

    if (result.error) {
      setIsLoading(false);
      setError(result.error);
      resetCaptcha();
    } else if (result.route) {
      setLogin("");
      setPassword("");
      setIsLoading(false);
      onClose();

      window.location.href = result.route;
    }
  };

  return (
    <div
      data-lenis-prevent
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
        isAnimated ? "opacity-100" : "opacity-0"
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

          <TurnstileCaptcha
            onToken={setCaptchaToken}
            resetSignal={captchaReset}
          />

          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading || !captchaToken}
              className="w-full bg-[#FFDD2D] hover:bg-[#e6c628] disabled:bg-zinc-200 disabled:text-zinc-400 text-zinc-900 font-bold py-3.5 rounded-full shadow-xs transition-all flex items-center justify-center"
            >
              {isLoading ? "Вход..." : "Войти"}
            </button>
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
