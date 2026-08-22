import { ArrowRight } from "lucide-react";
import CurrencyIcon from "@/src/components/CurrencyIcon/CurrencyIcon";
import {
  findCurrencyByOrderCode,
  isCryptoCurrency,
} from "@/src/utils/exchange-currencies";

export function formatOrderMoney(value: number, orderCode: string) {
  const currency = findCurrencyByOrderCode(orderCode);
  const crypto = currency
    ? isCryptoCurrency(currency)
    : !/^RUB/i.test(orderCode);
  return Number(value || 0).toLocaleString("ru-RU", {
    maximumFractionDigits: crypto ? 8 : 2,
  });
}

function currencyMeta(orderCode: string) {
  const currency = findCurrencyByOrderCode(orderCode);
  const code = currency?.code ?? orderCode.replace(/_/g, " ");
  const network = currency?.network?.shortLabel;
  return {
    code,
    iconSrc: currency?.iconSrc ?? "/icons/usdt.svg",
    network: network && network !== code ? network : null,
  };
}

function AmountSide({
  amount,
  orderCode,
  caption,
  compact = false,
}: {
  amount: number;
  orderCode: string;
  caption: string;
  compact?: boolean;
}) {
  const meta = currencyMeta(orderCode);

  return (
    <div className={`flex items-center min-w-0 flex-1 ${compact ? "gap-2" : "gap-2.5"}`}>
      <CurrencyIcon
        src={meta.iconSrc}
        alt={meta.code}
        size={compact ? 26 : 32}
        className="rounded-xl border border-zinc-200 bg-white shadow-none dark:border-zinc-700 dark:bg-zinc-800"
      />
      <div className="min-w-0 flex-1">
        {!compact && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {caption}
          </p>
        )}
        <p
          className={`font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums leading-tight break-all ${
            compact ? "text-sm" : "text-sm min-[380px]:text-[17px] sm:text-xl"
          }`}
        >
          {formatOrderMoney(amount, orderCode)}
        </p>
        <p className="text-[11px] font-medium text-zinc-500 break-all">
          {meta.code}
          {meta.network ? ` · ${meta.network}` : ""}
        </p>
      </div>
    </div>
  );
}

export default function OrderExchangePair({
  amountFrom,
  amountTo,
  currencyFrom,
  currencyTo,
  fromCaption = "Отдаёт",
  toCaption = "Получает",
  compact = false,
}: {
  amountFrom: number;
  amountTo: number;
  currencyFrom: string;
  currencyTo: string;
  fromCaption?: string;
  toCaption?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 ${
        compact
          ? "flex-row items-stretch gap-1.5"
          : "flex-col min-[380px]:flex-row items-stretch gap-2 min-[380px]:gap-2 sm:gap-3"
      }`}
    >
      <AmountSide
        amount={amountFrom}
        orderCode={currencyFrom}
        caption={fromCaption}
        compact={compact}
      />
      <div className="flex items-center justify-center shrink-0">
        <span
          className={`rounded-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center ${
            compact
              ? "w-6 h-6"
              : "w-6 h-6 rotate-90 min-[380px]:rotate-0 min-[380px]:w-7 min-[380px]:h-7 sm:w-8 sm:h-8"
          }`}
        >
          <ArrowRight
            className={
              compact ? "w-3 h-3 text-zinc-500" : "w-3.5 h-3.5 text-zinc-500"
            }
          />
        </span>
      </div>
      <AmountSide
        amount={amountTo}
        orderCode={currencyTo}
        caption={toCaption}
        compact={compact}
      />
    </div>
  );
}
