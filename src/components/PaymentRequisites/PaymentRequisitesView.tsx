"use client";

import { parsePaymentDetails } from "@/src/utils/orders/payment-details";

export default function PaymentRequisitesView({
  value,
  emptyText = "Ещё не выданы",
  compact = false,
}: {
  value: string | null | undefined;
  emptyText?: string;
  compact?: boolean;
}) {
  const parsed = parsePaymentDetails(value);
  const box = compact
    ? "font-mono text-xs font-bold break-all bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5"
    : "font-mono text-sm font-bold break-all bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2";

  if (!parsed.card && !parsed.phone && !parsed.legacy) {
    return (
      <p className="text-sm font-medium text-zinc-400">{emptyText}</p>
    );
  }

  if (parsed.legacy) {
    return (
      <p className={`${compact ? "text-xs" : "text-sm"} font-mono whitespace-pre-wrap font-bold text-zinc-900 dark:text-zinc-50 leading-relaxed`}>
        {parsed.legacy}
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
          Номер карты
        </p>
        <p className={box}>{parsed.card || "—"}</p>
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
          Номер телефона
        </p>
        <p className={box}>{parsed.phone || "—"}</p>
      </div>
    </div>
  );
}
