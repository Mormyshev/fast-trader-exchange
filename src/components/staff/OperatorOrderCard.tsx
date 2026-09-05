import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import RateFixationBar from "@/src/components/OrderTtlBadge/RateFixationBar";
import StaffClientInfo from "@/src/components/StaffClientInfo/StaffClientInfo";
import StaffOperatorLabel from "@/src/components/StaffOperatorLabel/StaffOperatorLabel";
import OrderExchangePair from "@/src/components/staff/OrderExchangePair";
import type { OrderClient } from "@/src/utils/orders/client-info";
import { orderPublicTitle } from "@/src/utils/orders/public-number";
import OrderProgressStepper from "@/src/components/OrderProgress/OrderProgressStepper";

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
  order_number?: number | null;
};

const BADGE: Record<OperatorOrderCardTone, string> = {
  new: "bg-[#FFF4C2] text-zinc-900",
  processing: "bg-[#FFF4C2] text-zinc-900",
  awaiting: "bg-[#FFF8D6] text-zinc-800",
  review: "bg-[#FFF4C2] text-zinc-900",
  completed: "bg-zinc-100 text-zinc-600",
  cancelled: "bg-zinc-100 text-zinc-500",
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
  return (
    <article className="min-w-0 overflow-visible rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${BADGE[tone]}`}
            >
              {statusText}
            </span>
            {showOperator ? (
              <StaffOperatorLabel
                snapshot={order.operator_pseudonym_snapshot}
              />
            ) : null}
          </div>
          <p className="text-[11px] font-medium text-zinc-400">
            <span className="font-semibold text-zinc-700">
              {orderPublicTitle(order)}
            </span>
            <span className="mx-1.5">·</span>
            {formatCardTime(order.created_at)}
          </p>
        </div>
        {actions ? null : (
          <Link
            href={`/operator/orders/${order.id}`}
            className="inline-flex items-center gap-0.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors shrink-0"
          >
            Открыть
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </header>

      <div className="px-4 sm:px-5 pt-4 space-y-2.5">
        <RateFixationBar
          createdAt={order.created_at}
          status={order.status}
          now={now}
          embedded
        />
        <div className="rounded-2xl bg-[#FFF8D6] px-3.5 sm:px-4 py-3.5">
          <OrderExchangePair
            amountFrom={order.amount_from}
            amountTo={order.amount_to}
            currencyFrom={order.currency_from}
            currencyTo={order.currency_to}
          />
        </div>
        <OrderProgressStepper
          status={order.status}
          operatorName={order.operator_pseudonym_snapshot}
          embedded
        />
      </div>

      <div className="px-4 sm:px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
        <div className="min-w-0 rounded-2xl bg-[#F4F5F7] px-3.5 py-3">
          <StaffClientInfo client={order.client} compact />
        </div>
        {showWallet ? (
          <div className="min-w-0 rounded-2xl bg-[#F4F5F7] px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              {walletLabel}
            </p>
            <p className="mt-1 font-mono text-[11px] sm:text-xs font-semibold text-zinc-800 break-all leading-relaxed">
              {order.wallet_to || "Не указаны"}
            </p>
          </div>
        ) : null}
      </div>

      {children ? (
        <div className="px-4 sm:px-5 pb-4 space-y-3 min-w-0 overflow-visible">
          {children}
        </div>
      ) : null}

      {actions ? (
        <footer className="border-t border-zinc-100 px-4 sm:px-5 py-3.5 sm:py-4 min-w-0">
          {actions}
        </footer>
      ) : null}
    </article>
  );
}
