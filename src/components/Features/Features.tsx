import Link from "next/link";
import { ArrowUpRight, Send, ShieldCheck } from "lucide-react";

const TELEGRAM_URL = "https://t.me/FastTraderExchange";

export default function Features() {
  return (
    <section className="w-full space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Обмен криптовалюты
        </h1>
        <p className="text-sm font-medium text-zinc-500">
          Демо-площадка: заявка, оплата и выплата после проверки оператором.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href="#exchange"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-zinc-800 shadow-[0_4px_24px_rgba(15,23,42,0.04)]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF4C2]">
            <ArrowUpRight className="h-4 w-4 text-[#C9A227]" />
          </span>
          К калькулятору
        </a>
        <Link
          href="/legal/verify-address"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-zinc-800 shadow-[0_4px_24px_rgba(15,23,42,0.04)]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF4C2]">
            <ShieldCheck className="h-4 w-4 text-[#C9A227]" />
          </span>
          Проверить адрес
        </Link>
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-zinc-800 shadow-[0_4px_24px_rgba(15,23,42,0.04)]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF4C2]">
            <Send className="h-4 w-4 text-[#C9A227]" />
          </span>
          Telegram
        </a>
      </div>
    </section>
  );
}
