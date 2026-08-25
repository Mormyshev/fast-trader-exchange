import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Features() {
  return (
    <section className="rounded-2xl bg-[#FFDD2D] px-6 py-8 shadow-[0_4px_24px_rgba(15,23,42,0.04)] sm:px-9 sm:py-10 lg:px-12 lg:py-12">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-900/40">
        Aurum Swap
      </p>
      <h1 className="mt-4 text-[1.85rem] font-bold leading-[1.05] tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.75rem]">
        Обмен криптовалюты
        <span className="mt-1.5 block font-medium text-zinc-900/45">
          за несколько минут
        </span>
      </h1>
      <p className="mt-5 max-w-md text-sm font-medium leading-relaxed text-zinc-900/55 sm:text-[15px]">
        Рассчитайте сумму, оплатите по СБП — оператор проверит перевод и
        отправит выплату.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <a
          href="#exchange"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 text-sm font-bold text-white transition-colors hover:bg-zinc-800"
        >
          Рассчитать обмен
          <ArrowRight className="h-4 w-4" />
        </a>
        <Link
          href="/legal/verify-address"
          className="text-sm font-semibold text-zinc-900 underline decoration-zinc-900/25 underline-offset-[5px] transition-colors hover:decoration-zinc-900"
        >
          Проверить адрес
        </Link>
      </div>
    </section>
  );
}
