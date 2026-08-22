import Link from "next/link";
import { ArrowUpRight, Send, ShieldCheck } from "lucide-react";

const TELEGRAM_URL = "https://t.me/FastTraderExchange";

export default function Features() {
  return (
    <section className="w-full space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1A1A1A] dark:text-zinc-50">
          Обмен криптовалюты
        </h1>
        <p className="text-xs sm:text-sm font-medium text-zinc-500">
          Демо-площадка: заявка, оплата и выплата после проверки оператором.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <a
          href="#exchange"
          className="flex min-w-0 flex-col justify-between rounded-2xl bg-[#FFDD2D] px-4 py-4 text-zinc-950 sm:px-5"
        >
          <h2 className="text-sm font-semibold tracking-tight">
            Обмен в несколько шагов
          </h2>
          <p className="mt-1.5 text-xs font-medium leading-relaxed text-zinc-800/80">
            Заявка, оплата и статус в кабинете. Курс фиксируется на 15 минут.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold">
            К калькулятору
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </a>

        <Link
          href="/legal/verify-address"
          className="flex min-w-0 flex-col rounded-2xl border border-zinc-200/80 bg-white px-4 py-4 sm:px-5 hover:border-zinc-300"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-zinc-900 stroke-[1.75]" />
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
              Проверить адрес
            </h2>
          </div>
          <p className="mt-1.5 text-xs font-medium leading-relaxed text-zinc-500">
            AML-проверка кошелька перед обменом — в один клик.
          </p>
        </Link>

        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-col rounded-2xl border border-zinc-200/80 bg-white px-4 py-4 sm:px-5 hover:border-zinc-300"
        >
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 shrink-0 text-zinc-900 stroke-[1.75]" />
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
              Новости в Telegram
            </h2>
          </div>
          <p className="mt-1.5 text-xs font-medium leading-relaxed text-zinc-500">
            Обновления демо-сервиса и статус работы площадки.
          </p>
        </a>
      </div>
    </section>
  );
}
