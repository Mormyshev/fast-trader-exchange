"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NoticeMessage() {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        <div className="relative w-full overflow-hidden rounded-2xl bg-white p-6 text-sm text-zinc-900 shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:bg-zinc-900 dark:text-zinc-50 sm:p-7">
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsVisible(false)}
                className="absolute top-4 right-4 size-9 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
                <X className="size-4" />
                <span className="sr-only">Закрыть</span>
            </Button>

            <div className="flex size-12 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
                <HelpCircle className="size-6" />
            </div>

            <div className="mt-4 space-y-1.5 pr-8">
                <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    Перед обменом
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Несколько правил, которые стоит учесть при создании заявки.
                </p>
            </div>

            <ul className="mt-5 space-y-3 text-sm font-medium leading-relaxed text-zinc-600 dark:text-zinc-300">
                <li>
                    Для оформления заявки заполните форму обмена ниже. Если
                    возникнут вопросы, напишите в онлайн-чат или{" "}
                    <a
                        href="tg://resolve?domain=finex24cash"
                        className="font-bold text-[#C9A227] hover:underline"
                    >
                        Telegram
                    </a>
                    .
                </li>
                <li>
                    Сумма к получению считается после полного пересчёта и
                    статуса заявки «Оплаченная».
                </li>
                <li>
                    Комиссия обменного пункта уже включена в курс. Курс
                    формируется по данным{" "}
                    <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                        Rapira.net
                    </span>{" "}
                    и может включать комиссию до 1%.
                </li>
            </ul>
        </div>
    );
}
