"use client";

import { useState, useEffect } from "react";
import { X, RefreshCw } from "lucide-react";
import Link from "next/link";

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
    const [login, setLogin] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [captchaInput, setCaptchaInput] = useState("");
    const [agreeTerms, setAgreeTerms] = useState(false);

    // Блокируем скролл основного сайта при открытом окне
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-all duration-300">
            {/* Подложка для закрытия по клику вне формы */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Белое модальное окно */}
            <div className="relative w-full max-w-[480px] bg-white text-zinc-900 rounded-[32px] p-6 md:p-8 shadow-2xl z-10 border border-zinc-100 max-h-[90vh] overflow-y-auto scrollbar-none">
                {/* Кнопка закрытия */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-600 transition-colors p-1"
                    aria-label="Закрыть"
                >
                    <X className="w-5 h-5 stroke-[1.5]" />
                </button>

                {/* Заголовок */}
                <h2 className="text-xl md:text-2xl font-bold text-center text-[#2A2A2A] mb-6 tracking-tight">
                    Регистрация
                </h2>

                {/* Форма */}
                <form
                    onSubmit={(e) => e.preventDefault()}
                    className="space-y-4"
                >
                    {/* Поле: Логин */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-zinc-500 pl-1">
                            Логин <span className="text-amber-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)}
                            className="w-full h-11 bg-white border border-zinc-200 rounded-full px-5 text-sm font-medium shadow-[0_0_12px_rgba(255,221,45,0.12)] focus:outline-hidden focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.4)] transition-all"
                            required
                        />
                    </div>

                    {/* Поле: E-mail */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-zinc-500 pl-1">
                            E-mail <span className="text-amber-500">*</span>
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-11 bg-white border border-zinc-200 rounded-full px-5 text-sm font-medium shadow-[0_0_12px_rgba(255,221,45,0.12)] focus:outline-hidden focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.4)] transition-all"
                            required
                        />
                    </div>

                    {/* Поле: Пароль */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-zinc-500 pl-1">
                            Пароль <span className="text-amber-500">*</span>
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full h-11 bg-white border border-zinc-200 rounded-full px-5 text-sm font-medium shadow-[0_0_12px_rgba(255,221,45,0.12)] focus:outline-hidden focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.4)] transition-all"
                            required
                        />
                    </div>

                    {/* Поле: Повтор пароля */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-zinc-500 pl-1">
                            Повторите пароль{" "}
                            <span className="text-amber-500">*</span>
                        </label>
                        <input
                            type="password"
                            value={passwordConfirm}
                            onChange={(e) => setPasswordConfirm(e.target.value)}
                            className="w-full h-11 bg-white border border-zinc-200 rounded-full px-5 text-sm font-medium shadow-[0_0_12px_rgba(255,221,45,0.12)] focus:outline-hidden focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.4)] transition-all"
                            required
                        />
                    </div>

                    {/* Капча */}
                    <div className="flex items-center space-x-4 pt-1">
                        <div className="flex items-center bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-1.5 select-none font-bold text-base text-zinc-700 tracking-widest italic shadow-inner">
                            <span>3</span>
                            <span className="text-xs mx-1.5 text-zinc-400 not-italic">
                                +
                            </span>
                            <span>4</span>
                            <span className="text-xs mx-1.5 text-zinc-400 not-italic">
                                =
                            </span>
                        </div>

                        <input
                            type="number"
                            value={captchaInput}
                            onChange={(e) => setCaptchaInput(e.target.value)}
                            className="w-11 h-11 bg-white border border-zinc-200 rounded-full text-center text-sm font-bold shadow-[0_0_12px_rgba(255,221,45,0.12)] focus:outline-hidden focus:border-[#FFDD2D] focus:shadow-[0_0_15px_rgba(255,221,45,0.4)] transition-all"
                            required
                        />

                        <button
                            type="button"
                            className="p-2 text-amber-400 hover:text-amber-500 transition-colors"
                            aria-label="Обновить капчу"
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
                            className="mt-0.5 w-4 h-4 rounded-sm border-zinc-300 text-[#FFDD2D] focus:ring-[#FFDD2D] accent-[#FFDD2D] cursor-pointer"
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
                    <div className="pt-2">
                        <button
                            type="submit"
                            className="w-full bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 font-bold text-base py-3.5 rounded-full shadow-xs active:scale-[0.99] transition-all"
                        >
                            Зарегистрироваться
                        </button>
                    </div>
                </form>

                {/* Ссылка быстрого переключения на вход */}
                <div className="mt-5 text-center text-xs font-semibold">
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
