"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from "lucide-react";

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
import OperatorOrderCard from "@/src/components/staff/OperatorOrderCard";
import type { OperatorOrderCardTone } from "@/src/components/staff/OperatorOrderCard";
import OrderExchangePair from "@/src/components/staff/OrderExchangePair";
import StaffDutyToggle from "@/src/components/staff/StaffDutyToggle";
import StaffRoster from "@/src/components/staff/StaffRoster";
import { useAuth } from "@/src/app/context/AuthContext";
import {
  formatClientName,
  mergeOrderClient,
  type OrderClient,
} from "@/src/utils/orders/client-info";
import { orderPublicTitle } from "@/src/utils/orders/public-number";
import {
  OrderTtlBadge,
  useNowTick,
} from "@/src/components/OrderTtlBadge/OrderTtlBadge";
import {
  orderStatusAccentClass,
  orderStatusBadgeClass,
  orderStatusRowClass,
} from "@/src/utils/orders/status-style";

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
  order_number?: number | null;
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
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function dashboardTone(status: OrderStatus): OperatorOrderCardTone {
  switch (status) {
    case "pending":
      return "new";
    case "processing":
      return "processing";
    case "awaiting_payment":
      return "awaiting";
    case "paid":
      return "review";
    case "completed":
      return "completed";
    default:
      return "cancelled";
  }
}

const ACTIVE_STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "awaiting_payment",
  "paid",
];

export default function OperatorDashboard() {
  const supabase = createClient();
  const { user, role, canReassignOrders, isLoading: isAuthLoading } = useAuth();

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
  const canReassignRef = useRef(canReassignOrders);
  const clientCacheRef = useRef(new Map<string, OrderClient>());
  if (user?.id) {
    userIdRef.current = user.id;
  }
  roleRef.current = role;
  canReassignRef.current = canReassignOrders;

  const rememberClient = (order: Order): Order =>
    mergeOrderClient(clientCacheRef.current, order);

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
        setPendingOrders(((json.pending || []) as Order[]).map(rememberClient));
        const inWork = canReassignRef.current
          ? ((json.teamInProgress || json.mine || []) as Order[])
          : ((json.mine || []) as Order[]);
        setMyOrders(inWork.map(rememberClient));
        setCompletedOrders(((json.completed || []) as Order[]).map(rememberClient));
        setCancelledOrders(((json.cancelled || []) as Order[]).map(rememberClient));
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
  }, [user?.id, isAuthLoading, role, canReassignOrders]);

  useEffect(() => {
    if (!canReassignOrders || !user?.id) return;

    const timer = window.setInterval(() => {
      void fetch("/api/orders/staff", { cache: "no-store" })
        .then((res) => res.json())
        .then((json) => {
          if (!Array.isArray(json.teamInProgress)) return;
          setMyOrders(
            ((json.teamInProgress || []) as Order[]).map(rememberClient),
          );
        })
        .catch(() => {});
    }, 15000);

    return () => window.clearInterval(timer);
  }, [canReassignOrders, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const applyLiveOrder = (order: Order) => {
      const currentUserId = userIdRef.current;
      if (!currentUserId) return;
      const next = rememberClient(order);

      setPendingOrders((prev) => {
        const without = prev.filter((o) => o.id !== next.id);
        return next.status === "pending" ? [next, ...without] : without;
      });

      setMyOrders((prev) => {
        const without = prev.filter((o) => o.id !== next.id);
        const canSeeTeam = canReassignRef.current;
        const inWork =
          IN_PROGRESS_STATUSES.includes(next.status) &&
          (canSeeTeam
            ? !!next.operator_id
            : next.operator_id === currentUserId);
        return inWork ? [next, ...without] : without;
      });

      setCompletedOrders((prev) => {
        const without = prev.filter((o) => o.id !== next.id);
        const isAdmin = roleRef.current === "admin";
        const visibleCompleted =
          next.status === "completed" &&
          (isAdmin || next.operator_id === currentUserId);
        return visibleCompleted ? [next, ...without].slice(0, 50) : without;
      });

      setCancelledOrders((prev) => {
        const without = prev.filter((o) => o.id !== next.id);
        const isAdmin = roleRef.current === "admin";
        const visible =
          next.status === "cancelled" &&
          (isAdmin ||
            next.operator_id === currentUserId ||
            next.operator_id == null);
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
    <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6 lg:space-y-8 text-zinc-900 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <StaffPageHeader
          title="Панель оператора"
          description={
            canReassignOrders
              ? "Мониторинг очереди и заявок в работе. Можно открыть карточку и передать ордер другому оператору."
              : "Мониторинг заявок Aurum Swap Demo"
          }
        />

        <div className="flex items-center space-x-2.5 bg-emerald-50 border border-emerald-100 px-3 sm:px-4 py-1.5 rounded-full self-start">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] sm:text-xs font-bold text-emerald-700">
            Live-обновление
          </span>
        </div>
      </div>

      <StaffDutyToggle />
      <StaffRoster />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
        <Card className="rounded-2xl border-none bg-white p-4 sm:p-5 lg:p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)] flex flex-col justify-between min-h-[6.5rem] sm:min-h-[7.5rem]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-500 uppercase tracking-wide">
              Новые заявки
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
              <Clock className="w-5 h-5" />
            </span>
          </div>
          <div className="text-4xl font-bold text-zinc-900">
            {pendingOrders.length}
          </div>
        </Card>

        <Card className="rounded-2xl border-none bg-white p-4 sm:p-5 lg:p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)] flex flex-col justify-between min-h-[6.5rem] sm:min-h-[7.5rem]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-500 uppercase tracking-wide">
              В работе
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
              <AlertCircle className="w-5 h-5" />
            </span>
          </div>
          <div>
            <div className="text-4xl font-bold text-zinc-900">
              {myOrders.length}
            </div>
            {canReassignOrders ? (
              <p className="mt-1 text-[11px] font-semibold text-zinc-400">
                все заявки команды в работе
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="rounded-2xl border-none bg-white p-4 sm:p-5 lg:p-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)] flex flex-col justify-between min-h-[6.5rem] sm:min-h-[7.5rem] sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-500 uppercase tracking-wide">
              {role === "admin" ? "Выполнено" : "Выполнено мной"}
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          </div>
          <div className="text-4xl font-bold text-zinc-900">
            {completedCount}
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border-none bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="flex items-center gap-2 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 pb-3 sm:pb-4 md:pb-5 border-b border-zinc-100">
          <StaffScrollTabs className="min-w-0 flex-1">
            {(
              [
                { id: "pending", label: "Новые", count: pendingOrders.length },
                { id: "in_progress", label: "В работе", count: myOrders.length },
                {
                  id: "completed",
                  label: "Выполненные",
                  count: completedOrders.length,
                },
                {
                  id: "cancelled",
                  label: "Отменённые",
                  count: cancelledOrders.length,
                },
                { id: "all", label: "Все", count: allOrders.length },
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
                    ? "bg-[#FFF4C2] text-zinc-900 hover:bg-[#FFF4C2]"
                    : "text-zinc-400 hover:text-zinc-600"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 tabular-nums ${
                    activeTab === tab.id ? "text-zinc-500" : "text-zinc-300"
                  }`}
                >
                  {tab.count}
                </span>
              </Button>
            ))}
          </StaffScrollTabs>

          <div className="relative w-[7.5rem] min-[400px]:w-44 sm:w-56 md:w-64 lg:w-72 shrink-0 self-center">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400" />
            <Input
              type="text"
              placeholder="Поиск"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-8 sm:pl-11 h-10 rounded-2xl bg-zinc-100/70 border-zinc-200/80 focus-visible:ring-[#FFDD2D] text-sm font-medium"
            />
          </div>
        </div>

        <div className="hidden md:block">
          {paginatedOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="bg-zinc-50/80 border-b border-zinc-100">
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Заявка
                    </th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Обмен
                    </th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Клиент
                    </th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Статус
                    </th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 text-right">
                      Действие
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => {
                    const active = ACTIVE_STATUSES.includes(order.status);
                    return (
                      <tr
                        key={order.id}
                        className={`border-b border-zinc-100 last:border-0 transition-colors ${orderStatusRowClass(order.status)}`}
                      >
                        <td className="relative px-5 py-4 align-top whitespace-nowrap">
                          <span
                            aria-hidden
                            className={`absolute inset-y-0 left-0 w-1 ${orderStatusAccentClass(order.status)}`}
                          />
                          <p className="text-[11px] font-semibold text-zinc-500">
                            {orderPublicTitle(order)}
                          </p>
                          <p className="text-sm font-semibold text-zinc-900 mt-0.5">
                            {formatCreatedAt(order.created_at)}
                          </p>
                          <div className="mt-1.5">
                            <OrderTtlBadge
                              createdAt={order.created_at}
                              status={order.status}
                              now={now}
                              compact
                            />
                          </div>
                        </td>
                        <td className="px-5 py-4 min-w-[240px]">
                          <OrderExchangePair
                            amountFrom={order.amount_from}
                            amountTo={order.amount_to}
                            currencyFrom={order.currency_from}
                            currencyTo={order.currency_to}
                            compact
                          />
                        </td>
                        <td className="px-5 py-4 align-top min-w-[180px]">
                          <StaffClientInfo
                            client={order.client}
                            compact
                            hideLabel
                          />
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex flex-col items-start gap-1.5">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${orderStatusBadgeClass(order.status, true)}`}
                            >
                              {statusLabel(order.status)}
                            </span>
                            <StaffOperatorLabel
                              snapshot={order.operator_pseudonym_snapshot}
                            />
                            {!order.operator_pseudonym_snapshot &&
                              order.operator_id && (
                                <span className="text-[11px] text-zinc-400 font-medium">
                                  Без подписи
                                </span>
                              )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right align-middle">
                          <Button
                            asChild
                            size="sm"
                            className={`rounded-full h-9 px-5 font-bold shadow-none text-xs cursor-pointer ${
                              active
                                ? "bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900"
                                : "bg-zinc-100 hover:bg-zinc-200 text-zinc-800"
                            }`}
                          >
                            <Link href={`/operator/orders/${order.id}`}>
                              {active ? "Открыть" : "Подробнее"}
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#FFF4C2] flex items-center justify-center text-[#C9A227] mb-3">
                <ClipboardList className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-zinc-700">Нет заявок</p>
              <p className="text-xs font-medium text-zinc-400 mt-1">
                {activeTab === "in_progress" && canReassignOrders
                  ? "Сейчас нет заявок в работе"
                  : "В этой вкладке пока пусто или ничего не нашлось по запросу"}
              </p>
            </div>
          )}
        </div>

        <div className="block md:hidden p-3 sm:p-4 space-y-3">
          {paginatedOrders.length > 0 ? (
            paginatedOrders.map((order) => (
              <OperatorOrderCard
                key={order.id}
                order={order}
                now={now}
                tone={dashboardTone(order.status)}
                statusText={statusLabel(order.status)}
                showWallet={false}
                showOperator
                actions={
                  <Button
                    asChild
                    className={`w-full rounded-xl h-10 font-semibold shadow-none text-sm cursor-pointer ${
                      ACTIVE_STATUSES.includes(order.status)
                        ? "bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900"
                        : "bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-800"
                    }`}
                  >
                    <Link href={`/operator/orders/${order.id}`}>
                      {ACTIVE_STATUSES.includes(order.status)
                        ? "Открыть заявку"
                        : "Подробнее"}
                    </Link>
                  </Button>
                }
              />
            ))
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-zinc-700">Нет заявок</p>
              <p className="text-xs font-medium text-zinc-400 mt-1">
                {activeTab === "in_progress" && canReassignOrders
                  ? "Сейчас нет заявок в работе"
                  : "В этой вкладке пока пусто"}
              </p>
            </div>
          )}
        </div>

          {showPagination && (
            <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-4 sm:px-5 py-4">
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
      </Card>
    </div>
  );
}
