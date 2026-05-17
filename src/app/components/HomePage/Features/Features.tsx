"use client";

import { useState, useRef } from "react";
import { Globe, ShieldCheck, Send } from "lucide-react";

export default function Features() {
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const cards = [
        {
            title: "Международные переводы",
            description:
                "Оплата инвойсов, Swift, Sepa\nВ нужной вам валюте USD, EUR, CNY\nВ течение 1-2 дней",
            icon: (
                <Globe className="relative w-12 h-12 text-zinc-950/80 stroke-[1.5] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
            ),
        },
        {
            title: "Проверить адрес перед обменом",
            description: "AML проверка безопасных транзакций",
            icon: (
                <ShieldCheck className="relative w-12 h-12 text-zinc-950/80 stroke-[1.5] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
            ),
        },
        {
            title: "Подписывайся на наш телеграм",
            description:
                "Finex24 | exchange - все актуальные новости о нашем сервисе",
            icon: (
                <Send className="relative w-12 h-12 text-zinc-950/80 stroke-[1.5] transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
            ),
        },
    ];

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollLeft, clientWidth } = scrollRef.current;
        const index = Math.round(scrollLeft / clientWidth);
        setActiveIndex(index);
    };

    const scrollToCard = (index: number) => {
        if (!scrollRef.current) return;
        const clientWidth = scrollRef.current.clientWidth;
        scrollRef.current.scrollTo({
            left: index * clientWidth,
            behavior: "smooth",
        });
        setActiveIndex(index);
    };

    return (
        <section className="max-w-7xl mx-auto p-8 bg-white">
            {/* Контейнер карточек */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="
          flex overflow-x-auto gap-4 pb-4 scrollbar-none 
          snap-x snap-mandatory scroll-smooth
          md:grid md:grid-cols-3 md:gap-5 md:overflow-x-visible md:pb-0 md:snap-none
        "
            >
                {cards.map((card, index) => (
                    <div
                        key={index}
                        className="
              relative overflow-hidden bg-[#FFDD2D] text-zinc-900 rounded-[24px] p-6 min-h-[175px] flex flex-col justify-between shadow-sm border border-yellow-400/30 group cursor-pointer transition-all duration-300 hover:shadow-md hover:border-yellow-400
              min-w-[85vw] sm:min-w-[70vw] snap-center
              md:min-w-0 md:w-full md:snap-align-none
            "
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/[0.02] pointer-events-none" />

                        <div className="absolute right-6 bottom-6 flex items-center justify-center">
                            <div className="absolute w-16 h-16 bg-white/20 rounded-full blur-md pointer-events-none" />
                            {card.icon}
                        </div>

                        <div className="relative z-10 max-w-[70%] flex flex-col justify-between h-full">
                            <div>
                                <h3 className="font-bold text-lg md:text-xl leading-snug tracking-tight mb-2 text-zinc-950">
                                    {card.title}
                                </h3>
                                <p className="text-xs md:text-sm font-medium text-zinc-800/90 leading-relaxed whitespace-pre-line">
                                    {card.description}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Пагинация для мобильных */}
            <div className="flex justify-center items-center space-x-2 mt-4 md:hidden">
                {cards.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => scrollToCard(index)}
                        className={`
              h-2 rounded-full transition-all duration-300
              ${activeIndex === index ? "w-6 bg-zinc-900 dark:bg-zinc-100" : "w-2 bg-zinc-300 dark:bg-zinc-700"}
            `}
                        aria-label={`Перейти к слайду ${index + 1}`}
                    />
                ))}
            </div>
        </section>
    );
}
