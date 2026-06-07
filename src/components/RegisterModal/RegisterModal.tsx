"use client";

import { useState, useEffect } from "react";
import { X, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useLenis } from "lenis/react";

interface RegisterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSwitchToLogin: () => void; // Функция для быстрого перехода на окно входа
}

export default function RegisterModal({
    isOpen,
    onClose,
    onSwitchToLogin,
}: RegisterModalProps) {
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isAnimated, setIsAnimated] = useState(isOpen);

    const [login, setLogin] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [captchaInput, setCaptchaInput] = useState("");
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [error, setError] = useState("");

    const lenis = useLenis();

    // Логика плавной анимации и интеграции с Lenis скроллом
    useEffect(() => {
        if (isOpen) {
            setError("");
            setShouldRender(true);

            // Блокируем Lenis скролл
            if (lenis) lenis.stop();
            // Блокируем стандартный скролл браузера
            document.body.style.overflow = "hidden";

            const timer = setTimeout(() => setIsAnimated(true), 10);
            return () => clearTimeout(timer);
        } else {
            setIsAnimated(false);

            const timer = setTimeout(() => {
                setShouldRender(false);

                // Включаем Lenis обратно
                if (lenis) lenis.start();
                // Возвращаем стандартный скролл браузера
                document.body.style.overflow = "";
            }, 300); // Соответствует duration-300

            return () => clearTimeout(timer);
        }
    }, [isOpen, lenis]);

    if (!shouldRender) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== passwordConfirm) {
            setError("Пароли не совпадают");
            return;
        }

        // Ваша логика регистрации
        console.log("Регистрация:", {
            login,
            email,
            password,
            captchaInput,
            agreeTerms,
        });
    };

    return (
        /* data-lenis-prevent запрещает скролл подложки в Lenis */
        <div
            data-lenis-prevent
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
                isAnimated ? "opacity-100" : "opacity-0"
            }`}
        >
            {/* Подложка для закрытия по клику вне формы */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Белое модальное окно */}
            <div
                className={`relative w-full max-w-[480px] bg-white text-zinc-900 rounded-[32px] p-8 md:p-10 shadow-2xl z-10 border border-zinc-100 transform transition-all duration-300 ease-in-out max-h-[90vh] overflow-y-auto scrollbar-none ${
                    isAnimated ? "scale-100 opacity-100" : "scale-95 opacity-0"
                }`}
            >
                {/* Кнопка закрытия */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Заголовок */}
                <h2 className="text-xl md:text-2xl font-bold text-center text-[#2A2A2A] mb-6">
                    Регистрация
                </h2>

                {/* Форма */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="text-xs font-bold text-red-500 text-center bg-red-50 py-2 rounded-full">
                            {error}
                        </div>
                    )}

                    {/* Поле: Логин */}
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
                        />
                    </div>

                    {/* Поле: E-mail */}
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
                        />
                    </div>

                    {/* Поле: Пароль */}
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
                        />
                    </div>

                    {/* Поле: Повтор пароля */}
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
                        />
                    </div>

                    {/* Капча */}
                    <div className="flex items-center space-x-4 pt-2">
                        <div className="flex items-center bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-2 font-bold text-lg text-zinc-700 select-none">
                            3 + 4 =
                        </div>
                        <input
                            type="number"
                            value={captchaInput}
                            onChange={(e) => setCaptchaInput(e.target.value)}
                            className="w-12 h-12 bg-white border border-zinc-200 rounded-full text-center font-bold focus:outline-hidden focus:border-[#FFDD2D] transition-all"
                            required
                        />
                        <button
                            type="button"
                            className="p-2 text-amber-400 hover:text-amber-500 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Чекбокс согласия с правилами */}
                    <div className="flex items-start space-x-2.5 pt-2">
                        <input
                            type="checkbox"
                            id="agreeTerms"
                            checked={agreeTerms}
                            onChange={(e) => setAgreeTerms(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded-xs border-zinc-300 text-[#FFDD2D] focus:ring-[#FFDD2D] accent-[#FFDD2D] cursor-pointer"
                            required
                        />
                        <label
                            htmlFor="agreeTerms"
                            className="text-[11px] font-medium text-zinc-500 leading-normal cursor-pointer select-none"
                        >
                            Я согласен с{" "}
                            <Link
                                href="/terms"
                                className="text-amber-400 hover:underline"
                            >
                                правилами сервиса
                            </Link>{" "}
                            и обработкой персональных данных
                        </label>
                    </div>

                    {/* Кнопка Регистрация */}
                    <div className="pt-4">
                        <button
                            type="submit"
                            className="w-full bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 font-bold py-3.5 rounded-full shadow-xs transition-all"
                        >
                            Зарегистрироваться
                        </button>
                    </div>
                </form>

                {/* Ссылка быстрого переключения на вход */}
                <div className="mt-6 text-center text-xs font-semibold">
                    <span className="text-zinc-400">
                        Уже зарегистрированы?{" "}
                    </span>
                    <button
                        onClick={onSwitchToLogin}
                        className="text-amber-400 hover:underline"
                    >
                        Войти
                    </button>
                </div>
            </div>
        </div>
    );
}
