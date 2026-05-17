"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Menu, X, Globe, Sun, Moon, UserPlus, LogIn } from "lucide-react";
import Image from "next/image";
import AuthModal from "../AuthModal/AuthModal";
import RegisterModal from "../RegisterModal/RegisterModal";
import { useAuth } from "@/src/app/context/AuthContext";

export default function Header() {
    const [isOpen, setIsOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);
    // Используем resolvedTheme вместо theme
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    const { role, logoutUser } = useAuth();

    // Ждем монтирования на клиенте, чтобы избежать ошибок гидратации
    useEffect(() => {
        setMounted(true);
    }, []);

    // Функция для безопасного переключения темы
    const toggleTheme = () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
    };
    const openLoginAndCloseRegister = () => {
        setIsRegisterOpen(false);
        setIsAuthOpen(true);
    };

    const openRegisterAndCloseLogin = () => {
        setIsAuthOpen(false);
        setIsRegisterOpen(true);
    };
    return (
        <>
            <header className="w-full bg-white dark:bg-zinc-950 border-b border-gray-100 dark:border-zinc-900 sticky top-0 z-50 transition-colors duration-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        {/* Логотип */}
                        <Link
                            href="/"
                            className="flex items-center space-x-3 group"
                        >
                            <div className="w-10 h-10 flex items-center justify-center font-bold text-xl text-black">
                                <Image
                                    src="/logo.png"
                                    alt="Logo"
                                    width={40}
                                    height={40}
                                    priority
                                />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-2xl text-gray-900 dark:text-zinc-50 tracking-tight leading-none">
                                    FAST TRADER
                                </span>
                                <span className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 uppercase tracking-wider font-medium">
                                    с нами надёжно
                                </span>
                            </div>
                        </Link>

                        {/* Десктопное меню */}
                        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-600 dark:text-zinc-400">
                            <Link
                                href="/telegram"
                                className="hover:text-gray-900 dark:hover:text-zinc-50 transition-colors"
                            >
                                Сообщество в телеграм
                            </Link>
                            <Link
                                href="/reviews"
                                className="hover:text-gray-900 dark:hover:text-zinc-50 transition-colors"
                            >
                                Отзывы
                            </Link>
                            <Link
                                href="/contacts"
                                className="hover:text-gray-900 dark:hover:text-zinc-50 transition-colors"
                            >
                                Контакты
                            </Link>
                        </nav>

                        {/* Правая часть (Язык, Тема, Вход, Регистрация) */}
                        <div className="hidden md:flex items-center space-x-6">
                            <button className="flex items-center space-x-1.5 text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50 transition-colors">
                                <Globe className="w-4 h-4 text-[#FFDD2D]" />
                                <span>RU</span>
                            </button>

                            {/* Переключатель темы (Десктоп) */}
                            {mounted && (
                                <button
                                    onClick={toggleTheme}
                                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-900 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50 transition-colors flex items-center justify-center"
                                    aria-label="Переключить тему"
                                >
                                    {resolvedTheme === "dark" ? (
                                        <Sun className="w-5 h-5 text-amber-400" />
                                    ) : (
                                        <Moon className="w-5 h-5 text-zinc-700" />
                                    )}
                                </button>
                            )}

                            {role === "guest" ? (
                                <>
                                    <button
                                        onClick={() => setIsAuthOpen(true)}
                                        className="text-sm font-medium text-gray-700 dark:text-zinc-300"
                                    >
                                        Войти
                                    </button>
                                    <button
                                        onClick={() => setIsRegisterOpen(true)}
                                        className="bg-[#FFDD2D] text-black text-sm font-semibold px-6 py-3 rounded-full"
                                    >
                                        Регистрация
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* Кнопки для авторизованного пользователя */}
                                    <Link
                                        href="/dashboard"
                                        className="text-sm font-medium text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-zinc-50"
                                    >
                                        Аккаунт{" "}
                                        <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-md ml-1 uppercase">
                                            {role}
                                        </span>
                                    </Link>
                                    <button
                                        onClick={logoutUser}
                                        className="bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm font-semibold px-6 py-3 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800/80 transition-all"
                                    >
                                        Выйти
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Правый блок мобильной версии (Тема + Бургер) */}
                        <div className="md:hidden flex items-center space-x-2">
                            {mounted && (
                                <button
                                    onClick={toggleTheme}
                                    className="p-2 rounded-full text-gray-600 dark:text-zinc-400 flex items-center justify-center"
                                    aria-label="Переключить тему"
                                >
                                    {resolvedTheme === "dark" ? (
                                        <Sun className="w-5 h-5 text-amber-400" />
                                    ) : (
                                        <Moon className="w-5 h-5 text-zinc-700" />
                                    )}
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                className="text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-50 p-2 rounded-md focus:outline-none"
                            >
                                {isOpen ? (
                                    <X className="w-6 h-6" />
                                ) : (
                                    <Menu className="w-6 h-6" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Выпадающее мобильное меню */}
                {isOpen && (
                    <div className="fixed inset-0 bg-[#0B0F17] z-50 p-5 flex flex-col justify-start transition-all overflow-y-auto antialiased">
                        {/* Верхний бар: Флаги и Кнопка закрытия */}
                        <div className="flex justify-between items-center w-full mb-6">
                            {/* Нативные аккуратные флаги с точным позиционированием */}
                            <div className="flex items-center space-x-5 pl-1">
                                <button
                                    className="text-[26px] leading-none transition-transform active:scale-95 filter drop-shadow-sm"
                                    aria-label="RU"
                                >
                                    🇷🇺
                                </button>
                                <button
                                    className="text-[26px] leading-none opacity-30 transition-all hover:opacity-50 active:scale-95 filter drop-shadow-sm"
                                    aria-label="US"
                                >
                                    🇺🇸
                                </button>
                            </div>

                            {/* Идеальная квадратная кнопка закрытия меню по макету */}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-11 h-11 rounded-xl border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors active:scale-95"
                                aria-label="Закрыть меню"
                            >
                                <X className="w-5 h-5 stroke-[1.5]" />
                            </button>
                        </div>

                        {/* 
          ЖЕЛТЫЙ БЛОК МЕНЮ (Pixel Perfect):
          - bg-[#FFDD2D]: точный оттенок теплого желтого цвета
          - Разделительные линии имеют мягкую прозрачность black/10
        */}
                        <div className="bg-[#FFDD2D] text-zinc-900 rounded-2xl px-5 py-5 flex flex-col shadow-sm mb-6">
                            <Link
                                href="/telegram"
                                onClick={() => setIsOpen(false)}
                                className="text-[15px] font-medium py-3.5 hover:opacity-80 transition-opacity pl-1"
                            >
                                Сообщество в телеграм
                            </Link>
                            <div className="h-[1px] bg-zinc-900/10 w-full" />
                            <Link
                                href="/reviews"
                                onClick={() => setIsOpen(false)}
                                className="text-[15px] font-medium py-3.5 hover:opacity-80 transition-opacity pl-1"
                            >
                                Отзывы
                            </Link>
                            <div className="h-[1px] bg-zinc-900/10 w-full" />
                            <Link
                                href="/contacts"
                                onClick={() => setIsOpen(false)}
                                className="text-[15px] font-medium py-3.5 hover:opacity-80 transition-opacity pl-1"
                            >
                                Контакты
                            </Link>
                        </div>

                        {/* 
          НИЖНИЙ РЯД КНОПОК:
          - Тонкие изящные рамки в цвет кнопок
          - Точные векторные иконки Lucide React вместо смайликов
        */}
                        {role === "guest" ? (
                            <div className="grid grid-cols-2 gap-3.5 w-full px-0.5">
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        setIsRegisterOpen(true);
                                    }}
                                    className="border border-[#FFDD2D]/40 text-[#FFDD2D] py-3 rounded-xl flex items-center justify-center space-x-2 text-[14px]"
                                >
                                    <UserPlus className="w-4 h-4 text-[#FFDD2D]" />
                                    <span>Регистрация</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        setIsAuthOpen(true);
                                    }}
                                    className="border border-[#FFDD2D]/40 text-[#FFDD2D] py-3 rounded-xl flex items-center justify-center space-x-2 text-[14px]"
                                >
                                    <LogIn className="w-4 h-4 text-[#FFDD2D]" />
                                    <span>Войти</span>
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3.5 w-full px-0.5">
                                <Link
                                    href="/dashboard"
                                    onClick={() => setIsOpen(false)}
                                    className="border border-[#FFDD2D]/40 text-[#FFDD2D] py-3 rounded-xl flex items-center justify-center space-x-2 text-[14px]"
                                >
                                    <span>Аккаунт ({role})</span>
                                </Link>
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        logoutUser();
                                    }}
                                    className="border border-red-500/40 text-red-400 py-3 rounded-xl flex items-center justify-center space-x-2 text-[14px]"
                                >
                                    <span>Выйти</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </header>
            <AuthModal
                isOpen={isAuthOpen}
                onClose={() => setIsAuthOpen(false)}
                // Если внутри AuthModal дописать проп onSwitchToRegister={openRegisterAndCloseLogin}, переключение станет бесшовным
            />

            {/* 4. Подключаем компонент регистрации и связываем его со входом */}
            <RegisterModal
                isOpen={isRegisterOpen}
                onClose={() => setIsRegisterOpen(false)}
                onSwitchToLogin={openLoginAndCloseRegister}
            />
        </>
    );
}
