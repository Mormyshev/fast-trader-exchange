"use client";

import {
    Users,
    ArrowLeftRight,
    Star,
    Headphones,
    List,
    Wallet,
} from "lucide-react";

export default function Stats() {
    const statsList = [
        {
            id: 1,
            value: "98498",
            label: "пользователей",
            icon: (
                <Users className="w-12 h-12 text-[#FFDD2D] fill-[#FFDD2D] stroke-none" />
            ),
        },
        {
            id: 2,
            value: "600000+",
            label: "обменов",
            icon: (
                <ArrowLeftRight className="w-12 h-12 text-[#FFDD2D] stroke-[2.5]" />
            ),
        },
        {
            id: 3,
            value: "12000+",
            label: "отзывов на Bestchange",
            icon: (
                <Star className="w-12 h-12 text-[#FFDD2D] fill-[#FFDD2D] stroke-none" />
            ),
        },
        {
            id: 4,
            value: "24/7",
            label: "служба поддержки",
            icon: (
                <Headphones className="w-12 h-12 text-[#FFDD2D] fill-[#FFDD2D] stroke-none" />
            ),
        },
        {
            id: 5,
            value: "1000+",
            label: "направлений обмена",
            icon: <List className="w-12 h-12 text-[#FFDD2D] stroke-[2.5]" />,
        },
        {
            id: 6,
            value: "1 млн $+",
            label: "резервы",
            icon: (
                <Wallet className="w-12 h-12 text-[#FFDD2D] fill-[#FFDD2D] stroke-none" />
            ),
        },
    ];

    return (
        <section className="w-full py-16 md:py-24 bg-white dark:bg-zinc-950 transition-colors duration-200">
            <div className="w-full px-4 sm:px-8">
                {/* Заголовок секции */}
                <h2 className="text-[32px] md:text-[42px] font-bold text-center text-[#2A2A2A] dark:text-zinc-100 mb-16 md:mb-24 tracking-tight">
                    Aurum Swap <span className="text-[36px]">в цифрах</span>
                </h2>

                {/* 
          ФИКСАЦИЯ СИММЕТРИИ НА ВСЕХ РАЗРЕШЕНИЯХ:
          - max-w-max: контейнер сжимается строго по ширине элементов и зазоров между ними
          - mx-auto: центрирует всю получившуюся группу идеально по центру экрана
          - gap-x-16 md:gap-x-28: задает жесткие фиксированные расстояния между колонками, чтобы они не разлетались по краям
        */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-16 md:gap-x-28 gap-y-12 md:gap-y-16 max-w-max mx-auto w-full">
                    {statsList.map((stat) => (
                        <div
                            key={stat.id}
                            className="flex items-center space-x-5 group justify-start w-[280px] md:w-[300px]"
                        >
                            {/* Область иконки */}
                            <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                                {stat.icon}
                            </div>

                            {/* Текстовый блок */}
                            <div className="flex flex-col min-w-0 justify-center">
                                <span className="text-[26px] md:text-[32px] font-bold text-[#2A2A2A] dark:text-zinc-50 tracking-tight leading-none mb-2">
                                    {stat.value}
                                </span>
                                <span className="text-[13px] md:text-[14px] font-semibold text-gray-400 dark:text-zinc-400 leading-tight uppercase tracking-wide text-xs whitespace-nowrap">
                                    {stat.label}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
