"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Loader2,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import CurrencyIcon from "@/src/components/CurrencyIcon/CurrencyIcon";
import { useAuth } from "@/src/app/context/AuthContext";
import { createClient } from "@/src/utils/supabase/client";
import { startPolling, subscribeWithAuth } from "@/src/utils/supabase/realtime";
import { orderStatusBadgeClass } from "@/src/utils/orders/status-style";
import { orderPublicTitle } from "@/src/utils/orders/public-number";
import { formatOrderMoney } from "@/src/components/staff/OrderExchangePair";
import {
  findCurrencyByOrderCode,
  formatLockedOrderRate,
} from "@/src/utils/exchange-currencies";

type OrderStatus =
  | "pending"
  | "processing"
  | "awaiting_payment"
  | "paid"
  | "completed"
  | "cancelled"
  | "failed";

type TabId = "pending" | "in_progress" | "completed" | "cancelled" | "all";

interface Order {
  id: string;
  created_at: string;
  status: OrderStatus;
  user_id?: string;
  currency_from: string;
  currency_to: string;
  amount_from: number;
  amount_to: number;
  wallet_to: string;
  operator_receipt_url?: string | null;
  order_number?: number | null;
}

const PAGE_SIZE = 10;
const TABLE_HEAD_CELL =
  "border-r border-zinc-200 px-5 py-3 whitespace-nowrap last:border-r-0";
const TABLE_CELL =
  "border-r border-zinc-200 px-5 py-3.5 align-middle last:border-r-0";

const IN_PROGRESS_STATUSES: OrderStatus[] = [
  "processing",
  "awaiting_payment",
  "paid",
];

function statusLabel(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "Ожидает оператора";
    case "processing":
      return "В обработке";
    case "awaiting_payment":
      return "Ожидает оплаты";
    case "paid":
      return "Платёж проверяется";
    case "completed":
      return "Выполнена";
    case "cancelled":
      return "Отменена";
    case "failed":
      return "Ошибка";
  }
}

function AmountCell({
  amount,
  orderCode,
}: {
  amount: number;
  orderCode: string;
}) {
  const currency = findCurrencyByOrderCode(orderCode);
  const code = currency?.code ?? orderCode.replace(/_/g, " ");
  const network = currency?.network?.shortLabel;
  const iconSrc = currency?.iconSrc ?? "/icons/usdt.svg";

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <CurrencyIcon
        src={iconSrc}
        alt={code}
        size={28}
        className="rounded-lg border border-zinc-200"
      />
      <div className="min-w-0">
        <p className="font-bold tabular-nums text-zinc-900 whitespace-nowrap">
          {formatOrderMoney(amount, orderCode)}
        </p>
        <p className="text-[11px] font-semibold text-zinc-400 whitespace-nowrap">
          {code}
          {network && network !== code ? ` · ${network}` : ""}
        </p>
      </div>
    </div>
  );
}

function formatOrderCreatedAt(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function matchesTab(order: Order, tab: TabId) {
  if (tab === "all") return true;
  if (tab === "pending") return order.status === "pending";
  if (tab === "in_progress") return IN_PROGRESS_STATUSES.includes(order.status);
  if (tab === "completed") return order.status === "completed";
  if (tab === "cancelled") return order.status === "cancelled";
  return false;
}

function emptyCopy(tab: TabId) {
  switch (tab) {
    case "pending":
      return {
        title: "Нет новых заявок",
        text: "Новые заявки, ожидающие оператора, появятся здесь.",
      };
    case "in_progress":
      return {
        title: "Нет заявок в работе",
        text: "Когда оператор возьмёт заявку или потребуется оплата, она отобразится в этом разделе.",
      };
    case "completed":
      return {
        title: "Нет выполненных заявок",
        text: "Завершённые обмены будут храниться здесь.",
      };
    case "cancelled":
      return {
        title: "Нет отменённых заявок",
        text: "Отменённые вручную или по истечении таймера заявки появятся здесь.",
      };
    case "all":
      return {
        title: "Заявок пока нет",
        text: "Создайте первый обмен — история заявок будет отображаться в этом разделе.",
      };
  }
}

export default function UserOrdersPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState({ active: 0, completed: 0 });

  useEffect(() => {
    if (!user?.id) {
      if (!isAuthLoading) setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadOrders() {
      try {
        const res = await fetch(`/api/orders/mine?scope=${activeTab}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Не удалось загрузить заявки");
        }
        if (!cancelled) {
          setOrders(json.orders || []);
          setStats({
            active: Number(json.stats?.active) || 0,
            completed: Number(json.stats?.completed) || 0,
          });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Ошибка загрузки");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    void (async () => {
      await loadOrders();
      if (cancelled) return;

      channel = supabase
        .channel(`user-orders-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
          },
          (payload) => {
            if (payload.eventType === "DELETE") {
              const oldId = (payload.old as { id?: string })?.id;
              if (oldId) {
                setOrders((prev) => prev.filter((o) => o.id !== oldId));
              }
              return;
            }

            const next = payload.new as Order;
            if (!next?.id || next.user_id !== user.id) return;

            setOrders((prev) => {
              const without = prev.filter((o) => o.id !== next.id);
              if (!matchesTab(next, activeTab)) return without;
              return [next, ...without].sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime(),
              );
            });
          },
        );

      await subscribeWithAuth(supabase, channel);
    })();

    const stopPoll = startPolling(() => void loadOrders(), 5000);

    return () => {
      cancelled = true;
      stopPoll();
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, isAuthLoading, activeTab]);

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrders = orders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const showPagination = orders.length > PAGE_SIZE;
  const empty = emptyCopy(activeTab);

  if (isAuthLoading && !user) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFDD2D]" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 sm:space-y-6 lg:space-y-8 pb-8 sm:pb-12 text-zinc-900 font-sans">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2A2A2A]">
          Мои заявки
        </h1>
        <p className="text-sm font-medium text-zinc-400 mt-1">
          История обменов и заявки в работе
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500">Мои заявки</p>
            <p className="text-xl font-bold text-zinc-900">{stats.active}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500">Успешные обмены</p>
            <p className="text-xl font-bold text-zinc-900">{stats.completed}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-500">Аккаунт</p>
            <p className="text-sm font-semibold text-zinc-900 truncate max-w-[200px]">
              {user?.email || "Пользователь"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 bg-zinc-100/70 p-1 rounded-2xl w-fit">
        {(
          [
            { id: "all", label: "Все" },
            { id: "pending", label: "Новые" },
            { id: "in_progress", label: "В работе" },
            { id: "completed", label: "Выполненные" },
            { id: "cancelled", label: "Отменённые" },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            size="sm"
            onClick={() => {
              setActiveTab(tab.id);
              setPage(1);
            }}
            className={`text-xs font-bold rounded-xl h-8 px-4 transition-all cursor-pointer ${
              activeTab === tab.id
                ? "bg-white text-zinc-900 shadow-xs hover:bg-white"
                : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <Card className="rounded-[32px] border border-dashed border-zinc-200 bg-white shadow-none overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFDD2D]" />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-10 md:p-14 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400">
              <ClipboardList className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-zinc-900">{empty.title}</h2>
              <p className="text-sm text-zinc-500 font-medium max-w-md mx-auto">
                {empty.text}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#FFF4C2] text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                    <th className={TABLE_HEAD_CELL}>№</th>
                    <th className={TABLE_HEAD_CELL}>Дата</th>
                    <th className={TABLE_HEAD_CELL}>Отдаёте</th>
                    <th className={TABLE_HEAD_CELL}>Получаете</th>
                    <th className={TABLE_HEAD_CELL}>Курс</th>
                    <th className={TABLE_HEAD_CELL}>Статус</th>
                    <th className={`${TABLE_HEAD_CELL} text-right`}> </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => {
                    const isActive = [
                      "pending",
                      "processing",
                      "awaiting_payment",
                      "paid",
                    ].includes(order.status);

                    return (
                      <tr
                        key={order.id}
                        className="border-b border-zinc-200 hover:bg-zinc-50/80"
                      >
                        <td className={TABLE_CELL}>
                          <div className="font-bold text-zinc-900 whitespace-nowrap">
                            {orderPublicTitle(order)}
                          </div>
                          {order.status === "completed" &&
                          order.operator_receipt_url ? (
                            <a
                              href={`/api/orders/${order.id}/operator-receipt`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                            >
                              <FileText className="w-3 h-3" />
                              Подтверждение
                            </a>
                          ) : null}
                        </td>
                        <td
                          className={`${TABLE_CELL} whitespace-nowrap font-medium text-zinc-500`}
                        >
                          {formatOrderCreatedAt(order.created_at)}
                        </td>
                        <td className={TABLE_CELL}>
                          <AmountCell
                            amount={order.amount_from}
                            orderCode={order.currency_from}
                          />
                        </td>
                        <td className={TABLE_CELL}>
                          <AmountCell
                            amount={order.amount_to}
                            orderCode={order.currency_to}
                          />
                        </td>
                        <td className={TABLE_CELL}>
                          <span className="font-semibold tabular-nums text-zinc-800 whitespace-nowrap">
                            {formatLockedOrderRate(
                              order.amount_from,
                              order.amount_to,
                              order.currency_from,
                              order.currency_to,
                            )}
                          </span>
                        </td>
                        <td className={TABLE_CELL}>
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${orderStatusBadgeClass(order.status)}`}
                          >
                            {statusLabel(order.status)}
                          </span>
                        </td>
                        <td className={`${TABLE_CELL} text-right`}>
                          <Button
                            asChild
                            size="sm"
                            className={`rounded-full h-8 px-4 text-xs font-bold shadow-none cursor-pointer ${
                              isActive
                                ? "bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900"
                                : "bg-zinc-100 hover:bg-zinc-200 text-zinc-800"
                            }`}
                          >
                            <Link href={`/order/${order.id}`}>
                              {isActive ? "Открыть" : "Подробнее"}
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {showPagination && (
              <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3">
                <p className="text-xs font-semibold text-zinc-400">
                  {(currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, orders.length)} из{" "}
                  {orders.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 rounded-full px-3 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs font-bold text-zinc-700 min-w-[4.5rem] text-center">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 rounded-full px-3 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
