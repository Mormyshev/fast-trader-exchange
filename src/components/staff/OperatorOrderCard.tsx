import Link from "next/link";
import type { ReactNode } from "react";
import {
  OrderTtlBadge,
  hasOrderTtl,
} from "@/src/components/OrderTtlBadge/OrderTtlBadge";
import StaffClientInfo from "@/src/components/StaffClientInfo/StaffClientInfo";
import StaffOperatorLabel from "@/src/components/StaffOperatorLabel/StaffOperatorLabel";
import OrderExchangePair from "@/src/components/staff/OrderExchangePair";
import type { OrderClient } from "@/src/utils/orders/client-info";

export type OperatorOrderCardTone =
  | "new"
  | "processing"
  | "awaiting"
  | "review"
  | "completed"
  | "cancelled";

type CardOrder = {
  id: string;
  created_at: string;
  status: string;
  currency_from: string;
  currency_to: string;
  amount_from: number;
  amount_to: number;
  wallet_to?: string | null;
  client?: OrderClient | null;
  operator_pseudonym_snapshot?: string | null;
};

const TONE: Record<
  OperatorOrderCardTone,
  { header: string; badge: string; shell: string }
> = {
  new: {
    header: "bg-amber-100 border-amber-200",
    badge: "bg-white text-amber-900 border-amber-200",
    shell: "border-amber-200",
  },
  processing: {
    header: "bg-blue-100 border-blue-200",
    badge: "bg-white text-blue-900 border-blue-200",
    shell: "border-blue-200",
  },
  awaiting: {
    header: "bg-violet-100 border-violet-200",
    badge: "bg-white text-violet-900 border-violet-200",
    shell: "border-violet-200",
  },
  review: {
    header: "bg-teal-100 border-teal-200",
    badge: "bg-white text-teal-900 border-teal-200",
    shell: "border-teal-300",
  },
  completed: {
    header: "bg-emerald-100 border-emerald-200",
    badge: "bg-white text-emerald-900 border-emerald-200",
    shell: "border-emerald-300",
  },
  cancelled: {
    header: "bg-rose-100 border-rose-200",
    badge: "bg-white text-rose-800 border-rose-200",
    shell: "border-rose-200",
  },
};

function formatCardTime(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OperatorOrderCard({
  order,
  now,
  tone,
  statusText,
  walletLabel = "Реквизиты клиента",
  showWallet = true,
  showOperator = false,
  actions,
  children,
}: {
  order: CardOrder;
  now: number;
  tone: OperatorOrderCardTone;
  statusText: string;
  walletLabel?: string;
  showWallet?: boolean;
  showOperator?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const toneStyle = TONE[tone];
  const showTtl = hasOrderTtl(order.status);

  return (
    <article
      className={`min-w-0 overflow-hidden rounded-2xl bg-white border ${toneStyle.shell} shadow-[0_1px_2px_rgba(15,23,42,0.06)]`}
    >
      <header
        className={`flex flex-wrap items-start justify-between gap-2 px-3 min-[380px]:px-3.5 sm:px-5 py-3 sm:py-3.5 border-b ${toneStyle.header}`}
      >
        <div className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${toneStyle.badge}`}
          >
            {statusText}
          </span>
          {showTtl && (
            <OrderTtlBadge
              createdAt={order.created_at}
              status={order.status}
              now={now}
              compact
            />
          )}
        </div>
        <div className="text-right min-w-0 max-w-full space-y-0.5">
          <p className="text-[11px] font-mono font-semibold text-zinc-600">
            #{order.id.slice(0, 8)}
          </p>
          <p className="text-[11px] text-zinc-600">{formatCardTime(order.created_at)}</p>
          <Link
            href={`/operator/orders/${order.id}`}
            className="inline-block text-[11px] font-semibold text-zinc-700 hover:text-zinc-950 underline-offset-2 hover:underline"
          >
            Карточка
          </Link>
        </div>
      </header>

      <div className="px-3 min-[380px]:px-3.5 sm:px-5 py-3.5 sm:py-4 bg-zinc-50 border-b border-zinc-200 min-w-0">
        <OrderExchangePair
          amountFrom={order.amount_from}
          amountTo={order.amount_to}
          currencyFrom={order.currency_from}
          currencyTo={order.currency_to}
        />
      </div>

      <div className="px-3 min-[380px]:px-3.5 sm:px-5 py-3.5 sm:py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
        <div className="min-w-0 rounded-xl bg-zinc-100 border border-zinc-200 px-3 py-2.5">
          <StaffClientInfo client={order.client} compact />
        </div>
        {showWallet && (
          <div className="min-w-0 rounded-xl bg-zinc-100 border border-zinc-200 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {walletLabel}
            </p>
            <p className="mt-1 font-mono text-[11px] sm:text-xs font-semibold text-zinc-800 break-all leading-relaxed">
              {order.wallet_to || "Не указаны"}
            </p>
          </div>
        )}
        {showOperator && (
          <div className="sm:col-span-2 min-w-0">
            <StaffOperatorLabel snapshot={order.operator_pseudonym_snapshot} />
          </div>
        )}
      </div>

      {children && (
        <div className="px-3 min-[380px]:px-3.5 sm:px-5 pb-4 space-y-3 min-w-0 overflow-hidden">
          {children}
        </div>
      )}

      {actions ? (
        <footer className="border-t border-zinc-200 bg-zinc-100 px-3 min-[380px]:px-3.5 sm:px-5 py-3 sm:py-4 min-w-0">
          {actions}
        </footer>
      ) : null}
    </article>
  );
}
