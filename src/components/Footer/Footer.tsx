"use client";

import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import Image from "next/image";

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="w-full bg-white dark:bg-zinc-950 border-t border-gray-100 dark:border-zinc-900 pt-12 pb-10 md:pt-16 md:pb-12 transition-colors duration-200 relative">
            {/* Кнопка чата (зафиксирована на экране) */}
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    type="button"
                    className="w-14 h-14 bg-[#FFDD2D] hover:bg-[#e6c628] rounded-full flex items-center justify-center text-zinc-900 shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 relative group"
                    aria-label="Открыть онлайн чат"
                >
                    <span className="absolute inset-0 rounded-full bg-[#FFDD2D]/40 animate-ping pointer-events-none group-hover:opacity-0 transition-opacity" />
                    <MessageCircle className="w-6 h-6 fill-zinc-900 stroke-none relative z-10" />
                </button>
            </div>

            <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
                {/* 
                  ГЛАВНЫЙ КОНТЕЙНЕР:
                  - flex-col: вертикально на смартфонах
                  - md:flex-row: горизонтально на планшетах и ПК
                */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-8 md:gap-6 pb-10 border-b border-gray-100 dark:border-zinc-900/60 w-full">
                    {/* 
                      БЛОК ЛОГОТИПА (ИСПРАВЛЕНО):
                      - items-start: жестко выравнивает логотип по левому краю на мобилках и ПК
                      - text-left: делает текст слогана выровненным по левой стороне
                    */}
                    <div className="flex flex-col items-start text-left space-y-1.5 shrink-0 w-full md:w-auto">
                        <Link
                            href="/"
                            className="flex items-center space-x-3 group"
                        >
                            <Image
                                src="/logo.png"
                                alt="Fast Trader Logo"
                                width={40}
                                height={40}
                                priority
                            />
                            <div className="flex flex-col text-left">
                                <span className="font-bold text-2xl text-gray-900 dark:text-zinc-50 tracking-tight leading-none">
                                    Fast Trader
                                </span>
                                <span className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 uppercase tracking-wider font-medium">
                                    с нами надёжно
                                </span>
                            </div>
                        </Link>
                    </div>

                    {/* Обертка для двух колонок ссылок меню */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-6 w-full md:flex md:flex-row md:justify-start md:gap-12 lg:gap-20">
                        {/* Навигация (Колонка 1) */}
                        <div className="flex flex-col space-y-3 text-[13px] font-medium text-gray-600 dark:text-zinc-400">
                            <Link
                                href="/terms"
                                className="hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
                            >
                                Пользовательское соглашение
                            </Link>
                            <Link
                                href="/aml-check"
                                className="hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
                            >
                                Проверить адрес перед обменом
                            </Link>
                            <Link
                                href="/aml-kyc"
                                className="hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
                            >
                                AML/KYC
                            </Link>
                        </div>

                        {/* Навигация (Колонка 2) */}
                        <div className="flex flex-col space-y-3 text-[13px] font-medium text-gray-600 dark:text-zinc-400">
                            <Link
                                href="/telegram"
                                className="hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
                            >
                                Сообщество в телеграм
                            </Link>
                            <Link
                                href="/privacy"
                                className="hover:text-gray-900 dark:hover:text-zinc-100 transition-colors leading-normal"
                            >
                                Пользовательское соглашение по обработке
                                персональных данных
                            </Link>
                        </div>
                    </div>

                    {/* Контакты (Кнопка почты) */}
                    <div className="w-full md:w-auto flex justify-start md:justify-end shrink-0 pt-2 md:pt-0">
                        <a
                            href="mailto:support@fasttrader.io"
                            className="inline-flex items-center space-x-2 bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 text-xs font-bold px-6 py-4 rounded-full shadow-xs transition-all active:scale-95 w-full sm:w-auto justify-center whitespace-nowrap"
                        >
                            <Mail className="w-4 h-4 stroke-[2.2]" />
                            <span>support@fasttrader.io</span>
                        </a>
                    </div>
                </div>

                {/* Нижняя плашка для копирайта (Выровнен по левому краю) */}
                <div className="pt-6 w-full text-center">
                    <p className="text-xs font-medium text-gray-400 dark:text-zinc-500">
                        &copy; 2021 &mdash; {currentYear} FastTrader.io
                    </p>
                </div>
            </div>
        </footer>
    );
}
