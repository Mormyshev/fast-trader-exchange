import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AmlServiceButtons from "../_components/AmlServiceButtons";

export const metadata: Metadata = {
  title: "Проверить адрес перед обменом — Aurum Swap",
  description:
    "Проверьте криптовалютный адрес через независимые AML-сервисы перед обменом",
};

export default function VerifyAddressPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        На главную
      </Link>

      <div className="space-y-5">
        <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
          Проверить адрес перед обменом
        </h1>

        <div className="space-y-4 text-sm md:text-[15px] text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
          <p>
            Убедитесь в безопасности сделки: проверьте криптовалютный адрес через
            независимые сервисы. Это снижает риск блокировки средств по причине
            AML.
          </p>
          <p>
            На этой странице собраны ссылки на популярные AML-анализаторы и
            аналитические инструменты. Они покажут историю транзакций, метки
            риска и другую полезную информацию об адресе.
          </p>
        </div>
      </div>

      <AmlServiceButtons />
    </div>
  );
}
