"use client";

import { useState, useEffect } from "react";
import { X, RefreshCw } from "lucide-react";
import { createClient } from "@/src/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
  validateUsername,
} from "@/src/utils/validation";
import { lockPageScroll, unlockPageScroll } from "@/src/utils/lenis-bridge";

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export default function RegisterModal({
  isOpen,
  onClose,
  onSwitchToLogin,
}: RegisterModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimated, setIsAnimated] = useState(isOpen);

  // Поля ввода формы
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Статусы отправки
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Переменные для капчи
  const [num1, setNum1] = useState(3);
  const [num2, setNum2] = useState(4);

  const router = useRouter();
  const supabase = createClient();
  const generateCaptcha = () => {
    setNum1(Math.floor(Math.random() * 10) + 1);
    setNum2(Math.floor(Math.random() * 10) + 1);
    setCaptchaInput("");
  };

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSuccessMessage("");
      setIsLoading(false);
      generateCaptcha();
      setShouldRender(true);
      lockPageScroll();
      const timer = setTimeout(() => setIsAnimated(true), 10);
      return () => {
        clearTimeout(timer);
        unlockPageScroll();
      };
    }

    setIsAnimated(false);
    unlockPageScroll();
    const timer = setTimeout(() => setShouldRender(false), 300);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!shouldRender) return null;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (password !== passwordConfirm) {
      setError("Пароли не совпадают");
      return;
    }

    if (parseInt(captchaInput) !== num1 + num2) {
      setError("Неверный ответ на капчу");
      generateCaptcha();
      return;
    }

    if (!agreeTerms) {
      setError("Необходимо согласиться с правилами");
      return;
    }

    const usernameCheck = validateUsername(login);
    if (!usernameCheck.ok) {
      setError(usernameCheck.error);
      return;
    }

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

    setIsLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: emailCheck.value,
      password: passwordCheck.value,
      options: {
        data: { username: usernameCheck.value },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setIsLoading(false);
      setError(signUpError.message);
      generateCaptcha();
      return;
    }

    // ДЕЙСТВИЯ ПРИ УСПЕХЕ:
    setIsLoading(false);

    if (data?.session) {
      // Вариант А: Подтверждение отключено, юзер сразу авторизован
      setLogin("");
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
      onClose(); // Закрываем окно
      router.refresh(); // Обновляем страницу
    } else {
      // Вариант Б: Подтверждение включено, показываем текст
      setSuccessMessage(
        "Регистрация успешна! Проверьте вашу почту для подтверждения аккаунта.",
      );
      setLogin("");
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
      generateCaptcha();

      // (Опционально) Автоматически закрыть окно через 5 секунд, чтобы юзер успел прочитать
      setTimeout(() => {
        onClose();
      }, 5000);
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
        className={`relative w-full max-w-[480px] bg-white text-zinc-900 rounded-[32px] p-8 md:p-10 shadow-2xl z-10 border border-zinc-100 transform transition-all duration-300 ease-in-out max-h-[90vh] overflow-y-auto scrollbar-none ${
          isAnimated ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-600 transition-colors"
          disabled={isLoading}
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl md:text-2xl font-bold text-center text-[#2A2A2A] mb-6">
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
              Логин *
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full h-12 bg-white border border-zinc-200 rounded-full px-6 text-sm font-medium focus:outline-hidden focus:border-[#FFDD2D] transition-all"
              required
              disabled={isLoading}
              placeholder="my_username"
            />
          </div>

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
              className="w-full h-12 bg-white border border-zinc-200 rounded-full px-6 text-sm font-medium focus:outline-hidden focus:border-[#FFDD2D] transition-all"
              required
              disabled={isLoading}
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
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center space-x-4 pt-2">
            <div className="flex items-center bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-2 font-bold text-lg text-zinc-700 select-none">
              {num1} + {num2} =
            </div>
            <input
              type="number"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              className="w-16 h-12 bg-white border border-zinc-200 rounded-full text-center font-bold focus:outline-hidden focus:border-[#FFDD2D] transition-all"
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

          <div className="flex items-start space-x-2.5 pt-2">
            <input
              type="checkbox"
              id="agreeTerms"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded-xs border-zinc-300 text-[#FFDD2D] focus:ring-[#FFDD2D] accent-[#FFDD2D] cursor-pointer"
              required
              disabled={isLoading}
              style={{ accentColor: "#FFDD2D" }}
            />
            <label
              htmlFor="agreeTerms"
              className="text-[11px] font-medium text-zinc-500 leading-normal cursor-pointer select-none"
            >
              Я согласен с{" "}
              <span className="text-amber-400">правилами сервиса</span> и
              обработкой персональных данных
            </label>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#FFDD2D] hover:bg-[#e6c628] disabled:bg-zinc-200 disabled:text-zinc-400 text-zinc-900 font-bold py-3.5 rounded-full shadow-xs transition-all flex items-center justify-center"
            >
              {isLoading ? "Регистрация..." : "Зарегистрироваться"}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-xs font-semibold">
          <span className="text-zinc-400">Уже зарегистрированы? </span>
          <button
            onClick={onSwitchToLogin}
            className="text-amber-400 hover:underline"
            disabled={isLoading}
          >
            Войти
          </button>
        </div>
      </div>
    </div>
  );
}
