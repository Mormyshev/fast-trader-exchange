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
  ChevronLeft,
  ChevronRight,
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
import { subscribeWithAuth } from "@/src/utils/supabase/realtime";
import { subscribeOrdersInbox } from "@/src/utils/supabase/orders-inbox";
import StaffOperatorLabel from "@/src/components/StaffOperatorLabel/StaffOperatorLabel";
import StaffClientInfo from "@/src/components/StaffClientInfo/StaffClientInfo";
import StaffScrollTabs from "@/src/components/staff/StaffScrollTabs";
import StaffPageHeader from "@/src/components/staff/StaffPageHeader";
import { useAuth } from "@/src/app/context/AuthContext";
import {
  formatClientName,
  type OrderClient,
} from "@/src/utils/orders/client-info";
import {
  OrderTtlBadge,
  useNowTick,
} from "@/src/components/OrderTtlBadge/OrderTtlBadge";

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
  operator_pseudonym_snapshot?: string | null;
  client?: OrderClient | null;
}

type TabId = "all" | "pending" | "in_progress" | "completed" | "cancelled";

const PAGE_SIZE = 10;

const IN_PROGRESS_STATUSES: OrderStatus[] = [
  "processing",
  "awaiting_payment",
  "paid",
];

function formatCreatedAt(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
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
  const { user, role, isLoading: isAuthLoading } = useAuth();

  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<Order[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const now = useNowTick(!loading && !!user?.id);

  const userIdRef = useRef<string | null>(null);
  const roleRef = useRef(role);
  if (user?.id) {
    userIdRef.current = user.id;
  }
  roleRef.current = role;

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
        setCancelledOrders((json.cancelled || []) as Order[]);
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

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const applyLiveOrder = (order: Order) => {
      const currentUserId = userIdRef.current;
      if (!currentUserId) return;

      const withClient = (prev: Order[], incoming: Order): Order => ({
        ...incoming,
        client:
          incoming.client ??
          prev.find((item) => item.id === incoming.id)?.client ??
          null,
      });

      setPendingOrders((prev) => {
        const next = withClient(prev, order);
        const without = prev.filter((o) => o.id !== next.id);
        return next.status === "pending" ? [next, ...without] : without;
      });

      setMyOrders((prev) => {
        const next = withClient(prev, order);
        const without = prev.filter((o) => o.id !== next.id);
        const mine =
          IN_PROGRESS_STATUSES.includes(next.status) &&
          next.operator_id === currentUserId;
        return mine ? [next, ...without] : without;
      });

      setCompletedOrders((prev) => {
        const next = withClient(prev, order);
        const without = prev.filter((o) => o.id !== next.id);
        const isAdmin = roleRef.current === "admin";
        const visibleCompleted =
          next.status === "completed" &&
          (isAdmin || next.operator_id === currentUserId);
        return visibleCompleted ? [next, ...without].slice(0, 50) : without;
      });

      setCancelledOrders((prev) => {
        const next = withClient(prev, order);
        const without = prev.filter((o) => o.id !== next.id);
        const visible =
          next.status === "cancelled" &&
          (next.operator_id === currentUserId || next.operator_id == null);
        return visible ? [next, ...without].slice(0, 100) : without;
      });
    };

    const inbox = subscribeOrdersInbox(supabase, (order) => {
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
              setCancelledOrders((prev) => prev.filter((o) => o.id !== id));
            }
          },
        );

      await subscribeWithAuth(supabase, channel);
    })();

    return () => {
      inbox.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, supabase]);

  const orderMap = new Map<string, Order>();
  for (const order of [
    ...pendingOrders,
    ...myOrders,
    ...completedOrders,
    ...cancelledOrders,
  ]) {
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
      (activeTab === "completed" && order.status === "completed") ||
      (activeTab === "cancelled" && order.status === "cancelled");

    const matchesSearch =
      !q ||
      [
        order.id,
        order.client?.email,
        order.client?.phone,
        order.client?.telegram,
        order.client?.first_name,
        order.client?.last_name,
        order.client?.middle_name,
        formatClientName(order.client),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    return matchesTab && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const showPagination = filteredOrders.length > PAGE_SIZE;

  if (isAuthLoading || loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFDD2D]" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 text-zinc-900 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <StaffPageHeader
          title="Панель оператора"
          description="Мониторинг заявок Aurum Swap Demo"
        />

        <div className="flex items-center space-x-2.5 bg-emerald-50 border border-emerald-100 px-3 sm:px-4 py-1.5 rounded-full self-start">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] sm:text-xs font-bold text-emerald-700">
            Live-обновление
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="rounded-[24px] sm:rounded-[32px] border-none bg-[#FFDD2D] p-5 sm:p-6 shadow-none flex flex-col justify-between min-h-[7rem] sm:h-36">
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

        <Card className="rounded-[24px] sm:rounded-[32px] border border-zinc-200 bg-white p-5 sm:p-6 shadow-none flex flex-col justify-between min-h-[7rem] sm:h-36">
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

        <Card className="rounded-[24px] sm:rounded-[32px] border border-zinc-200 bg-white p-5 sm:p-6 shadow-none flex flex-col justify-between min-h-[7rem] sm:h-36 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-400 uppercase tracking-wide">
              {role === "admin" ? "Выполнено" : "Выполнено мной"}
            </span>
            <CheckCircle2 className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="text-4xl font-bold text-zinc-900">
            {completedCount}
          </div>
        </Card>
      </div>

      <Card className="rounded-[24px] sm:rounded-[32px] border border-[#FFDD2D] bg-white shadow-none p-3 sm:p-4 md:p-6">
        <div className="flex flex-col gap-4 pb-4 sm:pb-6 border-b border-zinc-100">
          <StaffScrollTabs>
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
                className={`text-xs font-bold rounded-xl h-8 px-3 sm:px-4 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-white text-zinc-900 shadow-xs hover:bg-white"
                    : "text-zinc-400 hover:text-zinc-600"
                }`}
              >
                {tab.label}
              </Button>
            ))}
          </StaffScrollTabs>

          <div className="relative w-full md:w-80 md:ml-auto">
            <Search className="absolute left-4 top-3 w-4 h-4 text-zinc-400" />
            <Input
              type="text"
              placeholder="Поиск по ID заявки..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
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
                    ID / Дата
                  </TableHead>
                  <TableHead className="font-bold text-xs text-zinc-400 uppercase px-4 h-10">
                    Направление обмена
                  </TableHead>
                  <TableHead className="font-bold text-xs text-zinc-400 uppercase px-4 h-10">
                    Клиент
                  </TableHead>
                  <TableHead className="font-bold text-xs text-zinc-400 uppercase px-4 h-10">
                    Статус
                  </TableHead>
                  <TableHead className="font-bold text-xs text-zinc-400 uppercase px-4 h-10">
                    Оператор
                  </TableHead>
                  <TableHead className="font-bold text-xs text-zinc-400 uppercase px-4 h-10 text-right">
                    Управление
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-sm font-medium">
                {paginatedOrders.length > 0 ? (
                  paginatedOrders.map((order) => {
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
                            {formatCreatedAt(order.created_at)}
                          </div>
                          <div className="mt-1.5">
                            <OrderTtlBadge
                              createdAt={order.created_at}
                              status={order.status}
                              now={now}
                              compact
                            />
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

                        <TableCell className="py-4 px-4 align-top">
                          <StaffClientInfo client={order.client} compact />
                        </TableCell>

                        <TableCell className="py-4 px-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${statusClass(order.status)}`}
                          >
                            {statusLabel(order.status)}
                          </span>
                        </TableCell>

                        <TableCell className="py-4 px-4">
                          <StaffOperatorLabel
                            snapshot={order.operator_pseudonym_snapshot}
                          />
                          {!order.operator_pseudonym_snapshot &&
                            order.operator_id && (
                              <span className="text-[11px] text-zinc-400 font-medium">
                                Без подписи
                              </span>
                            )}
                        </TableCell>

                        <TableCell className="py-4 px-4 text-right">
                          <Button
                            asChild
                            size="sm"
                            className="rounded-full h-9 px-5 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none text-xs transition-colors cursor-pointer"
                          >
                            <Link href={`/operator/orders/${order.id}`}>
                              Открыть
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
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
            {paginatedOrders.length > 0 ? (
              paginatedOrders.map((order) => {
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
                          {formatCreatedAt(order.created_at)}
                        </div>
                        <div className="mt-1.5">
                          <OrderTtlBadge
                            createdAt={order.created_at}
                            status={order.status}
                            now={now}
                            compact
                          />
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${statusClass(order.status)}`}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </div>

                    <StaffOperatorLabel snapshot={order.operator_pseudonym_snapshot} />
                    <StaffClientInfo client={order.client} compact />

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
                      <Link href={`/operator/orders/${order.id}`}>
                        Открыть заявку
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

          {showPagination && (
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
              <p className="text-xs font-semibold text-zinc-400">
                {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filteredOrders.length)} из{" "}
                {filteredOrders.length}
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
      </Card>
    </div>
  );
}
