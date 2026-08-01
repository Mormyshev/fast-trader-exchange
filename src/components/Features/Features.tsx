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
        "Быстрый криптообмен\nТоповые монеты: USDT, BTC, ETH\nВывод на карты\nФиксация курса на сделку",
      icon: (
        <Globe className="w-6 h-6 text-zinc-950 stroke-[1.5] transition-transform duration-500 group-hover:rotate-12" />
      ),
    },
    {
      title: "Проверить адрес перед обменом",
      description: "AML проверка безопасных транзакций в один клик",
      icon: (
        <ShieldCheck className="w-6 h-6 text-zinc-950 stroke-[1.5] transition-transform duration-500 group-hover:scale-110" />
      ),
    },
    {
      title: "Подписывайся на наш телеграм",
      description: "@AurumSwapNews — новости и обновления демо-сервиса",
      icon: (
        <Send className="w-6 h-6 text-zinc-950 stroke-[1.5] transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" />
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
    <section className="w-full py-4 bg-transparent text-zinc-950">
      {/* Контейнер карточек */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto gap-4 pb-4 scrollbar-none snap-x snap-mandatory scroll-smooth md:grid md:grid-cols-3 md:gap-5 md:overflow-x-visible md:pb-0 md:snap-none"
      >
        {cards.map((card, index) => (
          <div
            key={index}
            className="relative overflow-hidden bg-[#FFDD2D] hover:bg-[#E2C21E] rounded-[24px] p-6 min-h-[220px] flex flex-col justify-start border border-black/[0.04] shadow-[0_4px_12px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.04)] group cursor-pointer transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.05)] min-w-[85vw] sm:min-w-[70vw] snap-center md:min-w-0 md:w-full md:snap-align-none"
          >
            {/* Иконка сверху в аккуратном матовом контейнере */}
            <div className="flex mb-4 relative z-10">
              <div className="flex items-center justify-center w-11 h-11 bg-white/40 rounded-xl border border-white/60 shadow-sm backdrop-blur-sm group-hover:bg-white/60 transition-colors duration-300">
                {card.icon}
              </div>
            </div>

            {/* Текстовый контент */}
            <div className="relative z-10 flex flex-col flex-1">
              <h3 className="font-bold text-lg md:text-xl leading-snug tracking-tight mb-2 text-zinc-950">
                {card.title}
              </h3>
              <p className="text-xs md:text-sm font-medium text-zinc-900/80 leading-relaxed whitespace-pre-line">
                {card.description}
              </p>
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
            className={`h-2 rounded-full transition-all duration-300 ${
              activeIndex === index ? "w-6 bg-zinc-900" : "w-2 bg-zinc-300"
            }`}
            aria-label={`Перейти к слайду ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
