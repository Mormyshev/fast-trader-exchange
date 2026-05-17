"use client";

import { Zap, TrendingUp } from "lucide-react";

export default function Advantages() {
    const advantagesList = [
        {
            title: "Быстрые и удобные операции",
            description:
                "Наши операции обмена крипто активов проходят моментально и легко благодаря простому интерфейсу и эффективному процессу",
            // Иконка быстрой молнии (Zap)
            icon: (
                <div className="relative flex items-center justify-center">
                    {/* Мягкое размытое свечение за иконкой для объема */}
                    <div className="absolute w-24 h-24 bg-[#FFDD2D]/10 rounded-full blur-xl pointer-events-none" />
                    <Zap className="relative w-16 h-16 text-[#FFDD2D] stroke-[1.5] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
                </div>
            ),
        },
        {
            title: "Выгодные курсы обмена",
            description:
                "Мы предлагаем конкурентоспособные курсы обмена, чтобы вы могли получить максимальную сумму за свои активы",
            // Иконка растущего графика / курса (TrendingUp)
            icon: (
                <div className="relative flex items-center justify-center">
                    <div className="absolute w-24 h-24 bg-[#FFDD2D]/10 rounded-full blur-xl pointer-events-none" />
                    <TrendingUp className="relative w-16 h-16 text-[#FFDD2D] stroke-[1.5] transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1" />
                </div>
            ),
        },
    ];

    return (
        <div className="w-full">
            {/* Контейнер с закруглением и рамкой в стиле основного макета */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800/60 rounded-[32px] p-8 md:p-16 shadow-xs">
                {/* Сетка: 1 колонка на мобильных, 2 колонки на компьютерах */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
                    {advantagesList.map((item, index) => (
                        <div
                            key={index}
                            className="flex flex-col items-center text-center space-y-5 group"
                        >
                            {/* Контейнер для иконки */}
                            <div className="h-20 flex items-center justify-center">
                                {item.icon}
                            </div>

                            {/* Текстовый блок */}
                            <div className="space-y-3 max-w-md">
                                <h3 className="font-bold text-lg md:text-xl text-zinc-900 dark:text-zinc-50 tracking-tight">
                                    {item.title}
                                </h3>
                                <p className="text-xs md:text-sm font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
