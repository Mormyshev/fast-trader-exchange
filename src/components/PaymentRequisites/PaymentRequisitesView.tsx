"use client";

import CurrencyIcon from "@/src/components/CurrencyIcon/CurrencyIcon";
import { findSbpBank } from "@/src/utils/banks/sbp-banks";
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
  const stack = compact ? "space-y-2" : "space-y-3";

  if (parsed.kind === "empty") {
    return (
      <p className="text-sm font-medium text-zinc-400">{emptyText}</p>
    );
  }

  if (parsed.kind === "legacy" && parsed.legacy) {
    return (
      <p className={`${compact ? "text-xs" : "text-sm"} font-mono whitespace-pre-wrap font-bold text-zinc-900 dark:text-zinc-50 leading-relaxed`}>
        {parsed.legacy}
      </p>
    );
  }

  if (parsed.kind === "crypto") {
    return (
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
          Адрес кошелька
        </p>
        <p className={box}>{parsed.wallet || "—"}</p>
      </div>
    );
  }

  if (parsed.kind === "sbp") {
    const bank = findSbpBank(parsed.bankId);
    return (
      <div className={stack}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Банк СБП
          </p>
          <div className={`${box} flex items-center gap-2`}>
            {bank ? (
              <CurrencyIcon src={bank.iconSrc} alt={bank.name} size={22} />
            ) : null}
            <span>{parsed.bankName || bank?.name || "—"}</span>
          </div>
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

  return (
    <div className={stack}>
      {parsed.card ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Номер карты
          </p>
          <p className={box}>{parsed.card}</p>
        </div>
      ) : null}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
          Номер телефона
        </p>
        <p className={box}>{parsed.phone || "—"}</p>
      </div>
    </div>
  );
}
