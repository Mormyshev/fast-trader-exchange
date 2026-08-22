"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  Clock,
  Loader2,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/src/app/context/AuthContext";
import { createClient } from "@/src/utils/supabase/client";
import { startPolling, subscribeWithAuth } from "@/src/utils/supabase/realtime";
import {
  orderStatusBadgeClass,
  orderStatusCardClass,
} from "@/src/utils/orders/status-style";

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
}

const PAGE_SIZE = 10;

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

function formatCurrency(value: number, currency: string) {
  const num = Number(value || 0);
  const formatted = Number.isInteger(num)
    ? num.toLocaleString("ru-RU")
    : num.toLocaleString("ru-RU", { maximumFractionDigits: 8 });
  return `${formatted} ${currency.replace(/_/g, " ")}`;
}

function formatOrderCreatedAt(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
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
  const [activeTab, setActiveTab] = useState<TabId>("pending");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2A2A2A]">
            Мои заявки
          </h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">
            История обменов и заявки в работе
          </p>
        </div>
        <Button
          asChild
          className="rounded-full h-10 px-6 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none self-start sm:self-auto cursor-pointer"
        >
          <Link href="/user/exchange">Создать обмен</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 bg-zinc-100/70 p-1 rounded-2xl w-fit">
        {(
          [
            { id: "pending", label: "Новые" },
            { id: "in_progress", label: "В работе" },
            { id: "completed", label: "Выполненные" },
            { id: "cancelled", label: "Отменённые" },
            { id: "all", label: "Все" },
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

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#FFDD2D]" />
        </div>
      ) : orders.length === 0 ? (
        <Card className="rounded-[32px] border border-dashed border-zinc-200 bg-white shadow-none p-10 md:p-14 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400">
            <ClipboardList className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-zinc-900">{empty.title}</h2>
            <p className="text-sm text-zinc-500 font-medium max-w-md mx-auto">
              {empty.text}
            </p>
          </div>
          <Button
            asChild
            className="rounded-full h-10 px-6 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none cursor-pointer"
          >
            <Link href="/user/exchange">Перейти к обмену</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {paginatedOrders.map((order) => {
            const isActive = [
              "pending",
              "processing",
              "awaiting_payment",
              "paid",
            ].includes(order.status);

            return (
              <Card
                key={order.id}
                className={`rounded-[28px] border shadow-none p-4 sm:p-5 md:p-6 ${orderStatusCardClass(order.status)}`}
              >
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center gap-4 md:gap-6">
                  <div className="space-y-3 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-zinc-400">
                      <span className="inline-flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        {formatOrderCreatedAt(order.created_at)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-900">
                      <span>
                        {formatCurrency(order.amount_from, order.currency_from)}
                      </span>
                      <ArrowRightLeft className="w-4 h-4 text-zinc-300 shrink-0" />
                      <span>
                        {formatCurrency(order.amount_to, order.currency_to)}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-zinc-400 break-all">
                      Кошелёк:{" "}
                      <span className="font-mono text-zinc-600">
                        {order.wallet_to}
                      </span>
                    </p>
                    {order.status === "completed" &&
                      order.operator_receipt_url && (
                        <a
                          href={`/api/orders/${order.id}/operator-receipt`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Подтверждение перевода
                        </a>
                      )}
                  </div>

                  <div className="flex md:justify-center md:min-w-[11rem]">
                    <span
                      className={`inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${orderStatusBadgeClass(order.status)}`}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </div>

                  <div className="flex md:justify-end">
                    <Button
                      asChild
                      className={`rounded-full h-11 px-6 font-bold shadow-none w-full md:w-auto cursor-pointer ${
                        isActive
                          ? "bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900"
                          : order.status === "completed"
                            ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-900"
                            : order.status === "cancelled" ||
                                order.status === "failed"
                              ? "bg-rose-100 hover:bg-rose-200 text-rose-900"
                              : "bg-zinc-100 hover:bg-zinc-200 text-zinc-800"
                      }`}
                    >
                      <Link href={`/order/${order.id}`}>
                        {isActive ? "Открыть заявку" : "Подробнее"}
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}

          {showPagination && (
            <div className="flex items-center justify-between gap-3 pt-2">
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
                  className="h-9 rounded-full px-3 cursor-pointer disabled:cursor-not-allowed"
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
                  className="h-9 rounded-full px-3 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
