import Link from "next/link";
import { ArrowLeftRight, ShieldCheck, Send } from "lucide-react";

const TELEGRAM_URL = "https://t.me/FastTraderExchange";

const cards = [
  {
    title: "Обмен в несколько шагов",
    description: "Заявка, оплата и статус в кабинете. Курс фиксируется на 15 минут.",
    href: "#exchange",
    icon: ArrowLeftRight,
  },
  {
    title: "Проверить адрес",
    description: "AML-проверка кошелька перед обменом — в один клик.",
    href: "/legal/verify-address",
    icon: ShieldCheck,
  },
  {
    title: "Новости в Telegram",
    description: "Обновления демо-сервиса и статус работы площадки.",
    href: TELEGRAM_URL,
    external: true,
    icon: Send,
  },
] as const;

const cardClassName =
  "flex min-w-0 items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-colors hover:border-zinc-300 hover:bg-zinc-50/80";

export default function Features() {
  return (
    <section className="w-full space-y-4 sm:space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-[#2A2A2A] dark:text-zinc-50">
          Обмен криптовалюты
        </h1>
        <p className="text-xs sm:text-sm font-medium text-zinc-400">
          Демо-площадка: создайте заявку, оплатите и получите выплату после проверки оператором.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const content = (
            <>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFDD2D] text-zinc-900">
                <Icon className="h-4 w-4 stroke-[2.2]" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {card.title}
                </h2>
                <p className="mt-1 text-xs font-medium leading-relaxed text-zinc-500">
                  {card.description}
                </p>
              </div>
            </>
          );

          if ("external" in card && card.external) {
            return (
              <a
                key={card.title}
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cardClassName}
              >
                {content}
              </a>
            );
          }

          if (card.href.startsWith("#")) {
            return (
              <a key={card.title} href={card.href} className={cardClassName}>
                {content}
              </a>
            );
          }

          return (
            <Link key={card.title} href={card.href} className={cardClassName}>
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
