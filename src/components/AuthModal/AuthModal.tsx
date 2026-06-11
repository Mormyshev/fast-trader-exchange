"use client";

import { useState, useEffect, startTransition } from "react";
import { X, RefreshCw } from "lucide-react";
import { useLenis } from "lenis/react";
import { createClient } from "@/src/utils/supabase/client";
import { useRouter } from "next/navigation";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void; // 1. Добавляем новое свойство в интерфейс
}

export default function AuthModal({
  isOpen,
  onClose,
  onSwitchToRegister, // 2. Принимаем свойство в аргументах компонента
}: AuthModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimated, setIsAnimated] = useState(isOpen);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [num1, setNum1] = useState(6);
  const [num2, setNum2] = useState(6);

  const lenis = useLenis();
  const router = useRouter();
  const supabase = createClient();

  const generateCaptcha = () => {
    setNum1(Math.floor(Math.random() * 10) + 1);
    setNum2(Math.floor(Math.random() * 10) + 1);
    setCaptchaAnswer("");
  };

  useEffect(() => {
    if (isOpen) {
      setError("");
      setIsLoading(false);
      generateCaptcha();
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

    if (parseInt(captchaAnswer) !== num1 + num2) {
      setError("Неверный ответ на капчу");
      generateCaptcha();
      return;
    }

    setIsLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: login,
      password: password,
    });

    if (authError) {
      setIsLoading(false);
      if (authError.message.includes("Invalid login credentials")) {
        setError("Неверный логин или пароль");
      } else {
        setError(authError.message);
      }
      generateCaptcha();
    } else {
      // 1. Немедленно очищаем поля и закрываем модальное окно
      setLogin("");
      setPassword("");
      setIsLoading(false);
      onClose(); // Модалка начнет закрываться мгновенно (fade-out анимация)

      // 2. Выполняем тяжелое обновление страницы в фоновом режиме,
      // чтобы не прерывать анимацию закрытия
      startTransition(() => {
        router.refresh();
      });
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

          <div className="flex items-center space-x-4 pt-2">
            <div className="flex items-center bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-2 font-bold text-lg text-zinc-700 select-none">
              {num1} + {num2} =
            </div>
            <input
              type="number"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              className="w-16 h-12 bg-white border border-zinc-200 rounded-full text-center font-bold focus:outline-hidden focus:border-[#FFDD2D]"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={generateCaptcha}
              className="p-2 text-amber-400 hover:text-amber-500 transition-colors"
              disabled={isLoading}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#FFDD2D] hover:bg-[#e6c628] disabled:bg-zinc-200 disabled:text-zinc-400 text-zinc-900 font-bold py-3.5 rounded-full shadow-xs transition-all flex items-center justify-center"
            >
              {isLoading ? "Вход..." : "Войти"}
            </button>
          </div>
        </form>

        {/* Кнопка быстрого перехода на регистрацию */}
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
