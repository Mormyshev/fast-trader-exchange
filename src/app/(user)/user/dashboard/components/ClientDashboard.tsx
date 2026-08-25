import React from "react";
import Link from "next/link";
import { ArrowLeftRight, Clock, CheckCircle2 } from "lucide-react";
import ExchangeCalculator from "@/src/components/ExchangeCalculator/ExchangeCalculator";
import { Button } from "@/components/ui/button";
import { orderStatusBadgeClass } from "@/src/utils/orders/status-style";

type ActiveOrder = {
  id: string;
  created_at: string;
  status: string;
  currency_from: string;
  currency_to: string;
  amount_from: number;
  amount_to: number;
};

function statusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Ожидает оператора";
    case "processing":
      return "В обработке";
    case "awaiting_payment":
      return "Ожидает оплаты";
    case "paid":
      return "Платёж проверяется";
    default:
      return status;
  }
}

export default function ClientDashboard({
  userEmail,
  activeOrders,
  completedCount,
}: {
  userEmail: string;
  activeOrders: ActiveOrder[];
  completedCount: number;
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <ExchangeCalculator />
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/user/orders"
          className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_28px_rgba(15,23,42,0.07)] transition-shadow"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500">Мои заявки</p>
            <p className="text-xl font-bold text-zinc-900">
              {activeOrders.length}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500">Успешные обмены</p>
            <p className="text-xl font-bold text-zinc-900">
              {completedCount}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500">Аккаунт</p>
            <p className="text-sm font-semibold text-zinc-900 truncate max-w-[160px]">
              {userEmail}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-zinc-900">Активные заявки</h2>
          <Link
            href="/user/orders"
            className="text-sm font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Мои заявки
          </Link>
        </div>

        {activeOrders.length === 0 ? (
          <div className="text-center py-8 text-sm text-zinc-500 border border-dashed border-zinc-200 rounded-xl">
            У вас пока нет активных заявок.{" "}
            <Link
              href="/user/exchange"
              className="text-[#C9A227] font-medium hover:underline"
            >
              Создать обмен?
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {activeOrders.slice(0, 3).map((order) => (
              <div
                key={order.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50/60 p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-400">
                    <span>
                      {new Date(order.created_at).toLocaleString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>·</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${orderStatusBadgeClass(order.status)}`}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-zinc-900 truncate">
                    {Number(order.amount_from || 0).toLocaleString("ru-RU")}{" "}
                    {order.currency_from} →{" "}
                    {Number(order.amount_to || 0).toLocaleString("ru-RU", {
                      maximumFractionDigits: 8,
                    })}{" "}
                    {order.currency_to.replace(/_/g, " ")}
                  </p>
                </div>
                <Button
                  asChild
                  size="sm"
                  className="rounded-full h-9 px-5 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none shrink-0"
                >
                  <Link href={`/order/${order.id}`}>Открыть</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
