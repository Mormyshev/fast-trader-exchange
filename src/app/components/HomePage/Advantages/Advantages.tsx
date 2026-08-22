import { TrendingUp, Zap } from "lucide-react";

const advantages = [
  {
    title: "Быстрые и удобные операции",
    description:
      "Наши операции обмена крипто активов проходят моментально и легко благодаря простому интерфейсу и эффективному процессу",
    icon: Zap,
  },
  {
    title: "Выгодные курсы обмена",
    description:
      "Мы предлагаем конкурентоспособные курсы обмена, чтобы вы могли получить максимальную сумму за свои активы",
    icon: TrendingUp,
  },
];

export default function Advantages() {
  return (
    <section className="rounded-[32px] border border-zinc-200/80 bg-white px-5 py-8 sm:px-8 sm:py-10 md:px-12 md:py-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
        Преимущества
      </p>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-0">
        {advantages.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className={`min-w-0 md:px-8 first:md:pl-0 last:md:pr-0 ${
                index === 0 ? "md:border-r md:border-zinc-100" : ""
              }`}
            >
              <Icon className="h-8 w-8 text-[#C9A227] stroke-[1.4]" />
              <h3 className="mt-5 text-xl font-semibold tracking-tight text-zinc-900">
                {item.title}
              </h3>
              <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-zinc-500">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
