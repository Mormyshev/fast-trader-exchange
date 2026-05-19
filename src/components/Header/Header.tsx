"use client";

import { useState, useEffect } from "react";
import NextLink from "next/link";
import { useTheme } from "next-themes";
import {
    Menu,
    Globe,
    Sun,
    Moon,
    UserPlus,
    LogIn,
    LogOut,
    User,
} from "lucide-react";
import Image from "next/image";
import AuthModal from "../AuthModal/AuthModal";
import RegisterModal from "../RegisterModal/RegisterModal";
import { useAuth } from "@/src/app/context/AuthContext";

// Импорт компонентов из вашей папки shadcn/ui
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetTitle,
} from "@/components/ui/sheet";

const navLinks = [
    { label: "Сообщество в телеграм", href: "/telegram" },
    { label: "Отзывы", href: "/reviews" },
    { label: "Контакты", href: "/contacts" },
];

export default function Header() {
    const [isOpen, setIsOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    const { role, logoutUser } = useAuth();

    useEffect(() => {
        setMounted(true);
    }, []);

    const toggleTheme = () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
    };

    // Методы бесшовного переключения модалок
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
            {/* Шапка теперь ВСЕГДА белая (bg-white/80) */}
            <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md transition-colors duration-200 dark:border-zinc-900">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-20 items-center justify-between">
                        {/* Логотип */}
                        <NextLink
                            href="/"
                            className="flex items-center space-x-3 group"
                        >
                            <div className="relative h-10 w-10 flex items-center justify-center font-bold text-xl text-black">
                                <Image
                                    src="/logo.png"
                                    alt="Logo"
                                    width={40}
                                    height={40}
                                    priority
                                />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-50 leading-none">
                                    FAST TRADER
                                </span>
                                <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                                    с нами надёжно
                                </span>
                            </div>
                        </NextLink>

                        {/* Десктопное меню */}
                        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-600 dark:text-zinc-400">
                            {navLinks.map((link) => (
                                <NextLink
                                    key={link.href}
                                    href={link.href}
                                    className="transition-colors hover:text-gray-900 dark:hover:text-zinc-50"
                                >
                                    {link.label}
                                </NextLink>
                            ))}
                        </nav>

                        {/* Правая часть (Десктоп управление) */}
                        <div className="hidden md:flex items-center space-x-6">
                            <button className="flex items-center space-x-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-50">
                                <Globe className="h-4 w-4 text-[#FFDD2D]" />
                                <span>RU</span>
                            </button>

                            {/* Переключатель темы (Десктоп) */}
                            {mounted && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleTheme}
                                    className="rounded-full text-gray-600 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                                    aria-label="Переключить тему"
                                >
                                    {resolvedTheme === "dark" ? (
                                        <Sun className="h-5 w-5 text-amber-400" />
                                    ) : (
                                        <Moon className="h-5 w-5 text-zinc-700" />
                                    )}
                                </Button>
                            )}

                            {/* Кнопки авторизации (Десктоп) */}
                            {role === "guest" ? (
                                <div className="flex items-center space-x-3">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setIsAuthOpen(true)}
                                        className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-zinc-300 dark:hover:text-zinc-50"
                                    >
                                        Войти
                                    </Button>
                                    <Button
                                        onClick={() => setIsRegisterOpen(true)}
                                        className="rounded-full bg-[#FFDD2D] px-6 text-sm font-semibold text-black hover:bg-[#e6c625] transition-colors shadow-sm"
                                    >
                                        Регистрация
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-3">
                                    <NextLink href="/dashboard">
                                        <Button
                                            variant="ghost"
                                            className="text-sm font-medium text-gray-700 dark:text-zinc-300"
                                        >
                                            Аккаунт
                                            <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase font-bold text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
                                                {role}
                                            </span>
                                        </Button>
                                    </NextLink>
                                    <Button
                                        onClick={logoutUser}
                                        variant="secondary"
                                        className="rounded-full px-6 text-sm font-semibold transition-all"
                                    >
                                        Выйти
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Мобильный блок (Тема + Бургер) */}
                        <div className="flex items-center space-x-2 md:hidden">
                            {mounted && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleTheme}
                                    className="rounded-full text-gray-600 dark:text-zinc-400"
                                >
                                    {resolvedTheme === "dark" ? (
                                        <Sun className="h-5 w-5 text-amber-400" />
                                    ) : (
                                        <Moon className="h-5 w-5 text-zinc-700" />
                                    )}
                                </Button>
                            )}

                            <Sheet open={isOpen} onOpenChange={setIsOpen}>
                                <SheetTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-gray-600 dark:text-zinc-400"
                                    >
                                        <Menu className="h-6 w-6" />
                                        <span className="sr-only">
                                            Открыть меню
                                        </span>
                                    </Button>
                                </SheetTrigger>
                                {/* Шторка мобильного меню теперь ВСЕГДА белая (bg-white/95) */}
                                <SheetContent
                                    side="right"
                                    className="w-full sm:max-w-xs border-l border-gray-100 bg-white/95 backdrop-blur-md p-6 flex flex-col justify-between dark:border-zinc-900"
                                >
                                    <div>
                                        <SheetTitle className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-6">
                                            Навигация
                                        </SheetTitle>

                                        {/* Желтый блок меню */}
                                        <div className="bg-[#FFDD2D] text-zinc-900 rounded-2xl p-2.5 flex flex-col shadow-sm mb-6">
                                            {navLinks.map((link, idx) => (
                                                <div key={link.href}>
                                                    <NextLink
                                                        href={link.href}
                                                        onClick={() =>
                                                            setIsOpen(false)
                                                        }
                                                        className="block text-[15px] font-semibold py-3 px-3 rounded-xl hover:bg-black/5 transition-colors"
                                                    >
                                                        {link.label}
                                                    </NextLink>
                                                    {idx !==
                                                        navLinks.length - 1 && (
                                                        <div className="h-[1px] bg-black/10 w-full my-0.5" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Выбор языка в мобильной шторке */}
                                        <div className="flex items-center space-x-4 px-3 py-2 border-t border-gray-100 dark:border-zinc-900 mt-2 pt-4">
                                            <button
                                                className="text-2xl transition-transform active:scale-95"
                                                aria-label="RU"
                                            >
                                                🇷🇺
                                            </button>
                                            <button
                                                className="text-2xl opacity-30 transition-transform active:scale-95"
                                                aria-label="US"
                                            >
                                                🇺🇸
                                            </button>
                                        </div>
                                    </div>

                                    {/* Нижний ряд кнопок в мобильной шторке */}
                                    <div className="pt-4 border-t border-gray-100 dark:border-zinc-900">
                                        {role === "guest" ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setIsOpen(false);
                                                        setIsRegisterOpen(true);
                                                    }}
                                                    className="border-gray-200 text-gray-700 dark:border-zinc-800 dark:text-zinc-300 rounded-xl py-5 text-xs font-semibold bg-white"
                                                >
                                                    <UserPlus className="w-4 h-4 mr-1.5 text-gray-500" />
                                                    Регистрация
                                                </Button>
                                                <Button
                                                    onClick={() => {
                                                        setIsOpen(false);
                                                        setIsAuthOpen(true);
                                                    }}
                                                    className="bg-[#FFDD2D] hover:bg-[#e6c625] text-black rounded-xl py-5 text-xs font-semibold border-none shadow-none"
                                                >
                                                    <LogIn className="w-4 h-4 mr-1.5 text-black" />
                                                    Войти
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-3">
                                                <NextLink
                                                    href="/dashboard"
                                                    onClick={() =>
                                                        setIsOpen(false)
                                                    }
                                                    className="w-full"
                                                >
                                                    <Button
                                                        variant="outline"
                                                        className="w-full border-gray-200 dark:border-zinc-800 rounded-xl py-5 text-xs font-semibold bg-white"
                                                    >
                                                        <User className="w-4 h-4 mr-1.5" />
                                                        Кабинет
                                                    </Button>
                                                </NextLink>
                                                <Button
                                                    onClick={() => {
                                                        setIsOpen(false);
                                                        logoutUser();
                                                    }}
                                                    variant="destructive"
                                                    className="rounded-xl py-5 text-xs font-semibold"
                                                >
                                                    <LogOut className="w-4 h-4 mr-1.5" />
                                                    Выйти
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                    </div>
                </div>
            </header>

            <AuthModal
                isOpen={isAuthOpen}
                onClose={() => setIsAuthOpen(false)}
            />
            <RegisterModal
                isOpen={isRegisterOpen}
                onClose={() => setIsRegisterOpen(false)}
                onSwitchToLogin={openLoginAndCloseRegister}
            />
        </>
    );
}
