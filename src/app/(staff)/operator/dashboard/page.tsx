"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowRightLeft,
  Loader2,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/src/utils/supabase/client";
import {
  bindRealtimeFallback,
  subscribeWithAuth,
} from "@/src/utils/supabase/realtime";
import { subscribeOrdersInbox } from "@/src/utils/supabase/orders-inbox";
import { useAuth } from "@/src/app/context/AuthContext";

type OrderStatus =
  | "pending"
  | "processing"
  | "awaiting_payment"
  | "paid"
  | "completed"
  | "cancelled";

interface Order {
  id: string;
  created_at: string;
  status: OrderStatus;
  user_id: string | null;
  operator_id: string | null;
  currency_from: string;
  currency_to: string;
  amount_from: number;
  amount_to: number;
}

type TabId = "all" | "pending" | "in_progress" | "completed";

const IN_PROGRESS_STATUSES: OrderStatus[] = [
  "processing",
  "awaiting_payment",
  "paid",
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(value: number, currency: string) {
  const num = Number(value || 0);
  const formatted = Number.isInteger(num)
    ? num.toLocaleString("ru-RU")
    : num.toLocaleString("ru-RU", { maximumFractionDigits: 8 });
  return { amount: formatted, currency };
}

function statusLabel(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "Новая";
    case "processing":
      return "В обработке";
    case "awaiting_payment":
      return "Ожидает оплаты";
    case "paid":
      return "Оплачена";
    case "completed":
      return "Выполнена";
    case "cancelled":
      return "Отменена";
  }
}

function statusClass(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "processing":
      return "bg-blue-100 text-blue-800";
    case "awaiting_payment":
      return "bg-purple-100 text-purple-800";
    case "paid":
      return "bg-emerald-100 text-emerald-800";
    case "completed":
      return "bg-zinc-100 text-zinc-700";
    case "cancelled":
      return "bg-red-100 text-red-700";
  }
}

function shortId(id: string) {
  return id.slice(0, 8);
}

export default function OperatorDashboard() {
  const supabase = createClient();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const userIdRef = useRef<string | null>(null);
  if (user?.id) {
    userIdRef.current = user.id;
  }

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user?.id) {
      setLoading(false);
      return;
    }

    async function fetchOrders() {
      try {
        const res = await fetch("/api/orders/staff", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Ошибка загрузки");
        setPendingOrders((json.pending || []) as Order[]);
        setMyOrders((json.mine || []) as Order[]);
        setCompletedOrders((json.completed || []) as Order[]);
        setCompletedCount(
          typeof json.completedCount === "number" ? json.completedCount : 0,
        );
      } catch (err) {
        console.error("Ошибка загрузки дашборда:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchOrders();
  }, [user?.id, isAuthLoading]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function refreshFromBff() {
      try {
        const res = await fetch("/api/orders/staff", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || cancelled) return;
        setPendingOrders((json.pending || []) as Order[]);
        setMyOrders((json.mine || []) as Order[]);
        setCompletedOrders((json.completed || []) as Order[]);
        setCompletedCount(
          typeof json.completedCount === "number" ? json.completedCount : 0,
        );
      } catch {
        // ignore
      }
    }

    const applyLiveOrder = (order: Order) => {
      const currentUserId = userIdRef.current;
      if (!currentUserId) return;

      setPendingOrders((prev) => {
        const without = prev.filter((o) => o.id !== order.id);
        return order.status === "pending" ? [order, ...without] : without;
      });

      setMyOrders((prev) => {
        const without = prev.filter((o) => o.id !== order.id);
        const mine =
          IN_PROGRESS_STATUSES.includes(order.status) &&
          order.operator_id === currentUserId;
        return mine ? [order, ...without] : without;
      });

      setCompletedOrders((prev) => {
        const without = prev.filter((o) => o.id !== order.id);
        const mineCompleted =
          order.status === "completed" && order.operator_id === currentUserId;
        return mineCompleted ? [order, ...without].slice(0, 50) : without;
      });
    };

    const fallback = bindRealtimeFallback(
      () => {},
      () => void refreshFromBff(),
      2000,
    );
    const listPoll = setInterval(() => void refreshFromBff(), 2500);

    const inboxChannel = subscribeOrdersInbox(supabase, (order) => {
      applyLiveOrder(order as Order);
    });

    void (async () => {
      channel = supabase
        .channel(`dashboard-orders-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          (payload) => {
            const currentUserId = userIdRef.current;
            if (!currentUserId) return;

            if (
              payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE"
            ) {
              applyLiveOrder(payload.new as Order);
            } else if (payload.eventType === "DELETE") {
              const id = payload.old.id as string;
              setPendingOrders((prev) => prev.filter((o) => o.id !== id));
              setMyOrders((prev) => prev.filter((o) => o.id !== id));
              setCompletedOrders((prev) => prev.filter((o) => o.id !== id));
            }
          },
        );

      await subscribeWithAuth(supabase, channel, fallback.onStatus);
    })();

    return () => {
      cancelled = true;
      fallback.clear();
      clearInterval(listPoll);
      supabase.removeChannel(inboxChannel);
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, supabase]);

  const orderMap = new Map<string, Order>();
  for (const order of [...pendingOrders, ...myOrders, ...completedOrders]) {
    orderMap.set(order.id, order);
  }
  const allOrders = Array.from(orderMap.values()).sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const q = searchQuery.trim().toLowerCase();
  const filteredOrders = allOrders.filter((order) => {
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "pending" && order.status === "pending") ||
      (activeTab === "in_progress" &&
        IN_PROGRESS_STATUSES.includes(order.status)) ||
      (activeTab === "completed" && order.status === "completed");

    const matchesSearch = !q || order.id.toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  if (isAuthLoading || loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFDD2D]" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 text-zinc-900 font-sans">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pl-14 md:pl-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2A2A2A]">
            Панель оператора
          </h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">
            Мониторинг заявок Aurum Swap Demo
          </p>
        </div>

        <div className="flex items-center space-x-2.5 bg-emerald-50 border border-emerald-100 px-4 py-1.5 rounded-full self-start md:self-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-emerald-700">
            Очередь обновляется в реальном времени
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="rounded-[32px] border-none bg-[#FFDD2D] p-6 shadow-none flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-800 uppercase tracking-wide">
              Новые заявки
            </span>
            <Clock className="w-5 h-5 text-zinc-800" />
          </div>
          <div className="text-4xl font-bold text-zinc-900">
            {pendingOrders.length}
          </div>
        </Card>

        <Card className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-none flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-400 uppercase tracking-wide">
              В работе
            </span>
            <AlertCircle className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="text-4xl font-bold text-zinc-900">
            {myOrders.length}
          </div>
        </Card>

        <Card className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-none flex flex-col justify-between h-36 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-400 uppercase tracking-wide">
              Выполнено мной
            </span>
            <CheckCircle2 className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="text-4xl font-bold text-zinc-900">
            {completedCount}
          </div>
        </Card>
      </div>

      <Card className="rounded-[32px] border border-[#FFDD2D] bg-white shadow-none p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-100">
          <div className="flex flex-wrap gap-1 bg-zinc-100/70 p-1 rounded-2xl self-start">
            {(
              [
                { id: "all", label: "Все" },
                { id: "pending", label: "Новые" },
                { id: "in_progress", label: "В работе" },
                { id: "completed", label: "Выполненные" },
              ] as const
            ).map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab(tab.id)}
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

          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-3 w-4 h-4 text-zinc-400" />
            <Input
              type="text"
              placeholder="Поиск по ID заявки..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-10 rounded-full bg-zinc-50 border-zinc-200 focus-visible:ring-[#FFDD2D] text-sm font-medium"
            />
          </div>
        </div>

        <div className="pt-4">
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="font-bold text-xs text-zinc-400 uppercase px-4 h-10">
                    ID / Время
                  </TableHead>
                  <TableHead className="font-bold text-xs text-zinc-400 uppercase px-4 h-10">
                    Направление обмена
                  </TableHead>
                  <TableHead className="font-bold text-xs text-zinc-400 uppercase px-4 h-10">
                    Статус
                  </TableHead>
                  <TableHead className="font-bold text-xs text-zinc-400 uppercase px-4 h-10 text-right">
                    Управление
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-sm font-medium">
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => {
                    const from = formatAmount(
                      order.amount_from,
                      order.currency_from,
                    );
                    const to = formatAmount(order.amount_to, order.currency_to);

                    return (
                      <TableRow
                        key={order.id}
                        className="hover:bg-zinc-50/50 border-zinc-100"
                      >
                        <TableCell className="py-4 px-4">
                          <div className="font-mono font-bold text-zinc-900">
                            {shortId(order.id)}
                          </div>
                          <div className="text-xs text-zinc-400 font-semibold mt-0.5">
                            {formatTime(order.created_at)}
                          </div>
                        </TableCell>

                        <TableCell className="py-4 px-4">
                          <div className="flex items-center space-x-2 text-zinc-900 font-bold">
                            <span>
                              {from.amount}{" "}
                              <span className="text-xs text-zinc-400 font-semibold">
                                {from.currency}
                              </span>
                            </span>
                            <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                            <span>
                              {to.amount}{" "}
                              <span className="text-xs text-zinc-400 font-semibold">
                                {to.currency}
                              </span>
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-4 px-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${statusClass(order.status)}`}
                          >
                            {statusLabel(order.status)}
                          </span>
                        </TableCell>

                        <TableCell className="py-4 px-4 text-right">
                          <Button
                            asChild
                            size="sm"
                            className="rounded-full h-9 px-5 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none text-xs transition-colors cursor-pointer"
                          >
                            <Link
                              href={
                                order.status === "pending"
                                  ? "/operator/orders"
                                  : `/operator/orders/${order.id}`
                              }
                            >
                              {order.status === "pending"
                                ? "Взять в работу"
                                : "Открыть"}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-32 text-center text-zinc-400 font-semibold"
                    >
                      Нет заявок
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="block md:hidden space-y-4">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => {
                const from = formatAmount(
                  order.amount_from,
                  order.currency_from,
                );
                const to = formatAmount(order.amount_to, order.currency_to);

                return (
                  <div
                    key={order.id}
                    className="p-5 bg-zinc-50/50 rounded-2xl border border-zinc-100 flex flex-col gap-4"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <div>
                        <div className="font-mono font-bold text-sm text-zinc-900">
                          {shortId(order.id)}
                        </div>
                        <div className="text-xs text-zinc-400 font-semibold mt-0.5">
                          {formatTime(order.created_at)}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${statusClass(order.status)}`}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-zinc-100 text-xs font-bold text-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 font-medium text-[11px]">
                          Отдает:
                        </span>
                        <span>
                          {from.amount}{" "}
                          <span className="text-[10px] font-semibold text-zinc-400">
                            {from.currency}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-zinc-50 pt-2">
                        <span className="text-zinc-400 font-medium text-[11px]">
                          Получает:
                        </span>
                        <span>
                          {to.amount}{" "}
                          <span className="text-[10px] font-semibold text-zinc-400">
                            {to.currency}
                          </span>
                        </span>
                      </div>
                    </div>

                    <Button
                      asChild
                      size="sm"
                      className="w-full rounded-xl h-10 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none text-xs transition-colors cursor-pointer"
                    >
                      <Link
                        href={
                          order.status === "pending"
                            ? "/operator/orders"
                            : `/operator/orders/${order.id}`
                        }
                      >
                        {order.status === "pending"
                          ? "Взять в работу"
                          : "Открыть заявку"}
                      </Link>
                    </Button>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-zinc-400 text-xs font-semibold">
                Нет заявок
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
