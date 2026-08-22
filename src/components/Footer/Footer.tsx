"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import ChatWidget from "@/src/components/Chat/ChatWidget";

const TELEGRAM_URL = "https://t.me/FastTraderExchange";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white dark:bg-zinc-950 border-t border-gray-100 dark:border-zinc-900 pt-12 pb-10 md:pt-16 md:pb-12 transition-colors duration-200 relative">
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
        <ChatWidget />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-5 md:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-8 md:gap-6 pb-10 border-b border-gray-100 dark:border-zinc-900/60 w-full">
          <div className="flex flex-col items-start text-left space-y-1.5 shrink-0 w-full md:w-auto">
            <Link href="/" className="flex items-center space-x-3 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.svg"
                alt="Aurum Swap"
                width={40}
                height={40}
                className="h-10 w-10"
              />
              <div className="flex flex-col text-left">
                <span className="font-bold text-2xl text-gray-900 dark:text-zinc-50 tracking-tight leading-none">
                  Aurum Swap
                </span>
                <span className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 uppercase tracking-wider font-medium">
                  демо-площадка обмена
                </span>
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-6 w-full md:flex md:flex-row md:justify-start md:gap-12 lg:gap-20">
            <nav
              className="flex flex-col space-y-3 text-[13px] font-medium text-gray-600 dark:text-zinc-400"
              aria-label="Правовая информация"
            >
              <Link
                href="/tos"
                className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Пользовательское соглашение
              </Link>
              <Link
                href="/legal/verify-address"
                className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Проверить адрес перед обменом
              </Link>
              <Link
                href="/legal/aml-kyc"
                className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                AML/KYC
              </Link>
            </nav>

            <nav
              className="flex flex-col space-y-3 text-[13px] font-medium text-gray-600 dark:text-zinc-400"
              aria-label="Сообщество и конфиденциальность"
            >
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Сообщество в телеграм
              </a>
              <Link
                href="/legal/privacy"
                className="leading-normal hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Пользовательское соглашение по обработке персональных данных
              </Link>
            </nav>
          </div>

          <div className="w-full md:w-auto flex justify-start md:justify-end shrink-0 pt-2 md:pt-0">
            <a
              href="mailto:hello@aurumswap.demo"
              className="inline-flex items-center space-x-2 bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 text-xs font-bold px-6 py-4 rounded-full shadow-xs transition-all active:scale-95 w-full sm:w-auto justify-center whitespace-nowrap"
            >
              <Mail className="w-4 h-4 stroke-[2.2]" />
              <span>hello@aurumswap.demo</span>
            </a>
          </div>
        </div>

        <div className="pt-6 w-full text-center">
          <p className="text-xs font-medium text-gray-400 dark:text-zinc-500">
            &copy; 2024 &mdash; {currentYear} aurumswap.demo
          </p>
        </div>
      </div>
    </footer>
  );
}
