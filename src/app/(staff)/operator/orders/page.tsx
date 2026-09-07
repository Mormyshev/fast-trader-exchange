"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Search,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeWithAuth } from "@/src/utils/supabase/realtime";
import { subscribeOrdersInbox } from "@/src/utils/supabase/orders-inbox";
import { useAuth } from "@/src/app/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import CurrencyIcon from "@/src/components/CurrencyIcon/CurrencyIcon";
import {
  hasOrderTtl,
  OrderTtlBadge,
  useNowTick,
} from "@/src/components/OrderTtlBadge/OrderTtlBadge";
import StaffScrollTabs from "@/src/components/staff/StaffScrollTabs";
import StaffPageHeader from "@/src/components/staff/StaffPageHeader";
import StaffClientInfo from "@/src/components/StaffClientInfo/StaffClientInfo";
import StaffOperatorLabel from "@/src/components/StaffOperatorLabel/StaffOperatorLabel";
import { formatOrderMoney } from "@/src/components/staff/OrderExchangePair";
import { isOrderExpiredByTtl, orderTtlStartedAt } from "@/src/utils/orders/ttl";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";
import type { OrderClient } from "@/src/utils/orders/client-info";
import { formatClientName, mergeOrderClient } from "@/src/utils/orders/client-info";
import {
  orderPublicNumber,
  orderPublicTitle,
} from "@/src/utils/orders/public-number";
import { STAFF_INACTIVE_ERROR } from "@/src/utils/staff/duty";
import { ttlStartedAtFromDetails } from "@/src/utils/orders/payment-details";
import {
  findCurrencyByOrderCode,
  formatLockedOrderRate,
} from "@/src/utils/exchange-currencies";
import { orderStatusBadgeClass } from "@/src/utils/orders/status-style";

interface Order {
  id: string;
  created_at: string;
  status:
    | "pending"
    | "processing"
    | "awaiting_payment"
    | "paid"
    | "completed"
    | "cancelled";
  user_id: string | null;
  operator_id: string | null;
  currency_from: string;
  currency_to: string;
  amount_from: number;
  amount_to: number;
  wallet_from: string | null;
  wallet_to: string;
  tx_hash: string | null;
  payment_details: string | null;
  receipt_url: string | null;
  operator_receipt_url?: string | null;
  operator_pseudonym_snapshot?: string | null;
  client?: OrderClient | null;
  order_number?: number | null;
  payment_issued_at?: string | null;
  updated_at?: string | null;
}

type TabId =
  | "new"
  | "in_work"
  | "awaiting"
  | "review"
  | "completed"
  | "cancelled";

const PAGE_SIZE = 10;
const TABLE_HEAD_CELL =
  "border-r border-zinc-200 px-2 py-2 whitespace-nowrap last:border-r-0";
const TABLE_CELL =
  "border-r border-zinc-200 px-2 py-2 align-top last:border-r-0";
const ACTION_BTN =
  "rounded-lg h-auto min-h-7 w-full px-2 py-1 text-[11px] font-bold leading-tight whitespace-normal shadow-none cursor-pointer";

function statusLabel(status: Order["status"]) {
  switch (status) {
    case "pending":
      return "Новая";
    case "processing":
      return "В обработке";
    case "awaiting_payment":
      return "Ожидает оплаты";
    case "paid":
      return "На проверке";
    case "completed":
      return "Выполнена";
    case "cancelled":
      return "Отменена";
  }
}

function formatOrderCreatedAt(iso: string) {
  const date = new Date(iso);
  return {
    date: date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
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
    <div className="flex items-center gap-1.5 min-w-0">
      <CurrencyIcon
        src={iconSrc}
        alt={code}
        size={22}
        className="rounded-md border border-zinc-200"
      />
      <div className="min-w-0">
        <p className="text-xs font-bold tabular-nums text-zinc-900 leading-tight">
          {formatOrderMoney(amount, orderCode)}
        </p>
        <p className="text-[10px] font-semibold text-zinc-400 leading-tight">
          {code}
          {network && network !== code ? ` · ${network}` : ""}
        </p>
      </div>
    </div>
  );
}

export default function OperatorOrdersPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, staffActive, role, canReassignOrders, isLoading: isAuthLoading } =
    useAuth();
  const { confirm, ConfirmDialogHost } = useConfirmDialog();

  const [newOrders, setNewOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("new");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const userIdRef = useRef<string | null>(null);
  const canReassignRef = useRef(canReassignOrders);
  const clientCacheRef = useRef(new Map<string, OrderClient>());
  const listsRef = useRef({
    newOrders: [] as Order[],
    myOrders: [] as Order[],
    cancelledOrders: [] as Order[],
    completedOrders: [] as Order[],
  });
  if (user?.id) {
    userIdRef.current = user.id;
  }
  canReassignRef.current = canReassignOrders;
  listsRef.current = {
    newOrders,
    myOrders,
    cancelledOrders,
    completedOrders,
  };

  const now = useNowTick(!loading && !!user?.id);
  const expiredHandledRef = useRef<Set<string>>(new Set());

  const rememberClient = (order: Order): Order =>
    mergeOrderClient(clientCacheRef.current, order);

  const mergeIncomingOrder = (updated: Order): Order => {
    const lists = listsRef.current;
    const prev =
      lists.myOrders.find((item) => item.id === updated.id) ||
      lists.cancelledOrders.find((item) => item.id === updated.id) ||
      lists.newOrders.find((item) => item.id === updated.id) ||
      lists.completedOrders.find((item) => item.id === updated.id);

    const incomingIssued = updated.payment_issued_at ?? null;
    const prevIssued = prev?.payment_issued_at ?? null;
    const incomingTtl = ttlStartedAtFromDetails(updated.payment_details);
    const prevTtl = ttlStartedAtFromDetails(prev?.payment_details);
    const keepPrevDetails =
      Boolean(prevTtl) &&
      (!incomingTtl ||
        new Date(prevTtl).getTime() > new Date(incomingTtl).getTime());

    return rememberClient({
      ...prev,
      ...updated,
      operator_id:
        updated.operator_id !== undefined && updated.operator_id !== null
          ? String(updated.operator_id)
          : (prev?.operator_id ?? null),
      operator_pseudonym_snapshot:
        updated.operator_pseudonym_snapshot?.trim() ||
        prev?.operator_pseudonym_snapshot ||
        null,
      payment_issued_at:
        incomingIssued && prevIssued
          ? new Date(incomingIssued).getTime() >= new Date(prevIssued).getTime()
            ? incomingIssued
            : prevIssued
          : incomingIssued || prevIssued,
      payment_details: keepPrevDetails
        ? (prev?.payment_details ?? null)
        : (updated.payment_details ?? prev?.payment_details ?? null),
      client: updated.client ?? prev?.client ?? null,
    } as Order);
  };

  const applyOrderUpdate = (updated: Order) => {
    const next = mergeIncomingOrder(updated);
    const status = String(next.status);
    const isOpen = ["processing", "awaiting_payment", "paid"].includes(status);
    const isMine =
      !!next.operator_id && next.operator_id === userIdRef.current;

    setNewOrders((prev) => {
      const without = prev.filter((o) => o.id !== next.id);
      return status === "pending" ? [next, ...without] : without;
    });
    setMyOrders((prev) => {
      const without = prev.filter((o) => o.id !== next.id);
      if (isOpen && (canReassignRef.current || isMine)) {
        return [next, ...without];
      }
      return without;
    });
    setCancelledOrders((prev) => {
      const without = prev.filter((o) => o.id !== next.id);
      if (
        status === "cancelled" &&
        (canReassignRef.current || isMine || next.operator_id == null)
      ) {
        return [next, ...without];
      }
      return without;
    });
    setCompletedOrders((prev) => {
      const without = prev.filter((o) => o.id !== next.id);
      if (status === "completed" && (canReassignRef.current || isMine)) {
        return [next, ...without];
      }
      return without;
    });
  };

  const applyOrderUpdateRef = useRef(applyOrderUpdate);
  applyOrderUpdateRef.current = applyOrderUpdate;

  useEffect(() => {
    const live = [...newOrders, ...myOrders];
    const candidates = live.filter(
      (o) => hasOrderTtl(o.status) && isOrderExpiredByTtl(orderTtlStartedAt(o), now),
    );
    const liveKeys = new Set(
      live.map((o) => `${o.id}:${orderTtlStartedAt(o)}`),
    );
    for (const key of expiredHandledRef.current) {
      if (!liveKeys.has(key)) expiredHandledRef.current.delete(key);
    }
    for (const order of candidates) {
      const key = `${order.id}:${orderTtlStartedAt(order)}`;
      if (expiredHandledRef.current.has(key)) continue;
      expiredHandledRef.current.add(key);
      void (async () => {
        try {
          const res = await fetch(`/api/orders/${order.id}`, {
            cache: "no-store",
          });
          const json = await res.json();
          if (json.order) applyOrderUpdate(json.order as Order);
        } catch {
          // ignore
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick-driven expire
  }, [now, newOrders, myOrders]);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user?.id) {
      setLoading(false);
      return;
    }

    async function fetchInitialOrders() {
      try {
        const res = await fetch("/api/orders/staff", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Ошибка загрузки");
        const pending = ((json.pending || []) as Order[]).map(rememberClient);
        const mine = ((json.mine || []) as Order[]).map(rememberClient);
        const team = ((json.teamInProgress || []) as Order[]).map(rememberClient);
        const inWork = canReassignRef.current
          ? (() => {
              const byId = new Map(mine.map((order) => [order.id, order]));
              for (const order of team) byId.set(order.id, order);
              return [...byId.values()];
            })()
          : mine;
        const cancelled = ((json.cancelled || []) as Order[]).map(rememberClient);
        const completed = ((json.completed || []) as Order[]).map(rememberClient);
        setNewOrders(pending);
        setMyOrders(inWork);
        setCancelledOrders(cancelled);
        setCompletedOrders(completed);
      } catch (err) {
        console.error("Ошибка:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchInitialOrders();
  }, [user?.id, isAuthLoading, role, canReassignOrders]);

  useEffect(() => {
    if (!user?.id) return;

    let pgChannel: ReturnType<typeof supabase.channel> | null = null;

    const upsertPending = (order: Order) => {
      const next = rememberClient(order);
      setNewOrders((prev) => {
        const without = prev.filter((item) => item.id !== next.id);
        return next.status === "pending" ? [next, ...without] : without;
      });
    };

    const inbox = subscribeOrdersInbox(supabase, (order, event) => {
      if (event === "created" && order.status === "pending") {
        upsertPending(order as Order);
        return;
      }
      applyOrderUpdateRef.current(order as Order);
    });

    void (async () => {
      pgChannel = supabase
        .channel(`live-orders-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          (payload) => {
            const currentUserId = userIdRef.current;
            if (!currentUserId) return;

            if (payload.eventType === "INSERT") {
              const inserted = payload.new as Order;
              if (inserted.status === "pending") {
                upsertPending(inserted);
              }
            } else if (payload.eventType === "UPDATE") {
              applyOrderUpdateRef.current(payload.new as Order);
            } else if (payload.eventType === "DELETE") {
              setNewOrders((prev) =>
                prev.filter((o) => o.id !== payload.old.id),
              );
              setMyOrders((prev) =>
                prev.filter((o) => o.id !== payload.old.id),
              );
              setCancelledOrders((prev) =>
                prev.filter((o) => o.id !== payload.old.id),
              );
              setCompletedOrders((prev) =>
                prev.filter((o) => o.id !== payload.old.id),
              );
            }
          },
        );

      await subscribeWithAuth(supabase, pgChannel);
    })();

    return () => {
      inbox.unsubscribe();
      if (pgChannel) supabase.removeChannel(pgChannel);
    };
  }, [user?.id, supabase]);

  const inWorkOrders = useMemo(
    () => myOrders.filter((o) => o.status === "processing"),
    [myOrders],
  );
  const awaitingOrders = useMemo(
    () => myOrders.filter((o) => o.status === "awaiting_payment"),
    [myOrders],
  );
  const reviewOrders = useMemo(
    () => myOrders.filter((o) => o.status === "paid"),
    [myOrders],
  );

  const q = searchQuery.trim().toLowerCase();
  const matchesSearch = (order: Order) => {
    if (!q) return true;
    return [
      order.id,
      orderPublicNumber(order),
      order.wallet_to,
      order.wallet_from,
      order.payment_details,
      order.currency_from,
      order.currency_to,
      order.operator_pseudonym_snapshot,
      order.client?.email,
      order.client?.phone,
      order.client?.telegram,
      order.client?.first_name,
      order.client?.last_name,
      order.client?.middle_name,
      formatClientName(order.client),
      String(order.amount_from ?? ""),
      String(order.amount_to ?? ""),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  };

  const visibleNewOrders = newOrders.filter(matchesSearch);
  const visibleInWorkOrders = inWorkOrders.filter(matchesSearch);
  const visibleAwaitingOrders = awaitingOrders.filter(matchesSearch);
  const visibleReviewOrders = reviewOrders.filter(matchesSearch);
  const visibleCompletedOrders = completedOrders.filter(matchesSearch);
  const visibleCancelledOrders = cancelledOrders.filter(matchesSearch);

  const tabOrders =
    activeTab === "new"
      ? visibleNewOrders
      : activeTab === "in_work"
        ? visibleInWorkOrders
        : activeTab === "awaiting"
          ? visibleAwaitingOrders
          : activeTab === "review"
            ? visibleReviewOrders
            : activeTab === "completed"
              ? visibleCompletedOrders
              : visibleCancelledOrders;

  const totalPages = Math.max(1, Math.ceil(tabOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrders = tabOrders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const showPagination = tabOrders.length > PAGE_SIZE;

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery]);

  const openOrder = (orderId: string) => {
    router.push(`/operator/orders/${orderId}`);
  };

  const handleClaimOrder = async (orderId: string) => {
    if (!user?.id) return;
    if (!staffActive) {
      alert(STAFF_INACTIVE_ERROR);
      return;
    }

    const ok = await confirm({
      title: "Взять заявку в работу?",
      description:
        "Заявка будет закреплена за вами. Клиент получит уведомление о начале обработки.",
      confirmLabel: "Взять в работу",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operator_id: user.id,
          status: "processing",
        }),
      });
      const json = await res.json();
      if (res.status === 409) {
        alert(json.error || "Эту заявку уже забрал другой оператор.");
        setNewOrders((prev) => prev.filter((o) => o.id !== orderId));
        return;
      }
      if (!res.ok) {
        alert("Ошибка при взятии заявки: " + (json.error || res.status));
        return;
      }
      if (json.order) applyOrderUpdate(json.order as Order);
      openOrder(orderId);
    } catch (err) {
      console.error(err);
      alert("Произошла системная ошибка.");
    }
  };

  const handleRestoreToWork = async (orderId: string) => {
    if (!user?.id) return;
    if (!canReassignOrders) return;
    if (!staffActive) {
      alert(STAFF_INACTIVE_ERROR);
      return;
    }

    const ok = await confirm({
      title: "Вернуть заявку в работу?",
      description:
        "Заявка снова станет активной и закрепится за вами. Таймер жизни заявки начнётся заново.",
      confirmLabel: "Вернуть в работу",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operator_id: user.id,
          status: "processing",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Не удалось вернуть заявку в работу");
        return;
      }
      if (json.order) applyOrderUpdate(json.order as Order);
      openOrder(orderId);
    } catch (err) {
      console.error(err);
      alert("Произошла системная ошибка.");
    }
  };

  const handleJoinOrder = async (orderId: string) => {
    if (!user?.id) return;
    if (!staffActive) {
      alert(STAFF_INACTIVE_ERROR);
      return;
    }

    const target = myOrders.find((order) => order.id === orderId);
    const operatorName = target?.operator_pseudonym_snapshot?.trim();
    const ok = await confirm({
      title: "Подключиться к сделке?",
      description: operatorName
        ? `Заявка сейчас у ${operatorName}. Вы станете исполнителем и сможете вести её дальше с текущего этапа.`
        : "Вы станете исполнителем этой заявки и сможете вести её дальше с текущего этапа.",
      confirmLabel: "Подключиться",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator_id: user.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Не удалось подключиться к заявке");
        return;
      }
      if (json.order) applyOrderUpdate(json.order as Order);
      openOrder(orderId);
    } catch (err) {
      console.error(err);
      alert("Произошла системная ошибка.");
    }
  };

  if (isAuthLoading || loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFDD2D]" />
      </div>
    );
  }

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "new", label: "Новые", count: newOrders.length },
    { id: "in_work", label: "В работе", count: inWorkOrders.length },
    { id: "awaiting", label: "Ожидают оплаты", count: awaitingOrders.length },
    { id: "review", label: "На проверке", count: reviewOrders.length },
    { id: "completed", label: "Выполненные", count: completedOrders.length },
    { id: "cancelled", label: "Отменённые", count: cancelledOrders.length },
  ];

  const emptyCopy = () => {
    if (q) {
      return {
        title: "Ничего не найдено",
        text: "Измените запрос или очистите поиск.",
      };
    }
    switch (activeTab) {
      case "new":
        return {
          title: "Нет новых заявок",
          text: "Сейчас очередь пуста. Новые обмены появятся здесь мгновенно.",
        };
      case "in_work":
        return {
          title: "Нет заявок в работе",
          text: canReassignOrders
            ? "Нет заявок в работе у команды."
            : "Возьмите ордер из вкладки «Новые».",
        };
      case "awaiting":
        return {
          title: "Нет заявок, ожидающих оплаты",
          text: "Когда клиенту отправят реквизиты, заявка появится здесь.",
        };
      case "review":
        return {
          title: "Нет заявок на проверке",
          text: "Оплаченные клиентом заявки появятся в этом разделе.",
        };
      case "completed":
        return {
          title: "Нет выполненных заявок",
          text: "Завершённые обмены будут храниться здесь.",
        };
      case "cancelled":
        return {
          title: "Нет отменённых заявок",
          text: "Сюда попадают заявки после ручной отмены или истечения таймера.",
        };
    }
  };

  const empty = emptyCopy();
  const isActiveStatus = (status: Order["status"]) =>
    ["pending", "processing", "awaiting_payment", "paid"].includes(status);

  const renderRowActions = (order: Order) => {
    const isForeign =
      canReassignOrders &&
      !!order.operator_id &&
      order.operator_id !== user?.id;
    const openLabel = isActiveStatus(order.status) ? "Открыть" : "Подробнее";
    const openButton = (
      <Button
        asChild
        size="sm"
        className={`${ACTION_BTN} ${
          isActiveStatus(order.status)
            ? "bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900"
            : "bg-zinc-100 hover:bg-zinc-200 text-zinc-800"
        }`}
      >
        <Link href={`/operator/orders/${order.id}`}>{openLabel}</Link>
      </Button>
    );

    if (activeTab === "new") {
      return (
        <div className="flex flex-col items-stretch gap-1 w-full">
          <Button
            asChild
            size="sm"
            variant="outline"
            className={ACTION_BTN}
          >
            <Link href={`/operator/orders/${order.id}`}>Открыть</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!staffActive}
            onClick={() => void handleClaimOrder(order.id)}
            className={`${ACTION_BTN} bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 disabled:cursor-not-allowed`}
          >
            Взять в работу
          </Button>
        </div>
      );
    }

    if (
      (activeTab === "in_work" ||
        activeTab === "awaiting" ||
        activeTab === "review") &&
      isForeign
    ) {
      return (
        <div className="flex flex-col items-stretch gap-1 w-full">
          <Button
            asChild
            size="sm"
            variant="outline"
            className={ACTION_BTN}
          >
            <Link href={`/operator/orders/${order.id}`}>Открыть</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!staffActive}
            onClick={() => void handleJoinOrder(order.id)}
            className={`${ACTION_BTN} bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 disabled:cursor-not-allowed`}
          >
            Подключиться
          </Button>
        </div>
      );
    }

    if (activeTab === "cancelled" && canReassignOrders) {
      return (
        <div className="flex flex-col items-stretch gap-1 w-full">
          <Button
            asChild
            size="sm"
            variant="outline"
            className={ACTION_BTN}
          >
            <Link href={`/operator/orders/${order.id}`}>Открыть</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!staffActive}
            onClick={() => void handleRestoreToWork(order.id)}
            className={`${ACTION_BTN} bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 disabled:cursor-not-allowed`}
          >
            Вернуть в работу
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-stretch w-full">
        {openButton}
      </div>
    );
  };

  return (
    <div className="w-full max-w-none space-y-3 text-zinc-900 font-sans antialiased">
      <StaffPageHeader
        title="Активные ордера"
        description={
          canReassignOrders
            ? "Все заявки команды. Можно передать ордер другому оператору или подключиться к сделке"
            : "Очередь и ваши заявки по этапам"
        }
      />

      <div className="flex flex-col md:flex-row md:items-center gap-2.5 min-w-0">
        <StaffScrollTabs className="min-w-0 flex-1">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className={`text-xs font-bold rounded-xl h-8 px-3 sm:px-4 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-[#FFF4C2] text-zinc-900 hover:bg-[#FFF4C2]"
                  : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 inline-flex min-w-5 h-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black ${
                  tab.count > 0
                    ? activeTab === tab.id
                      ? "bg-[#FFDD2D] text-zinc-900"
                      : "bg-zinc-200 text-zinc-600"
                    : "bg-transparent text-zinc-300"
                }`}
              >
                {tab.count}
              </span>
            </Button>
          ))}
        </StaffScrollTabs>
        <div className="relative w-full md:w-64 lg:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input
            type="search"
            placeholder="Номер, клиент, кошелёк"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-2xl bg-white border-zinc-200/80 shadow-[0_4px_24px_rgba(15,23,42,0.04)] focus-visible:ring-[#FFDD2D] text-sm font-medium"
          />
        </div>
      </div>

      <Card className="rounded-2xl border border-zinc-200 bg-white shadow-none overflow-hidden p-0">
        {tabOrders.length === 0 ? (
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
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <colgroup>
                  <col className="w-[7.5%]" />
                  <col className="w-[9.5%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[11%]" />
                  <col className="w-[22%]" />
                  <col className="w-[11%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead>
                  <tr className="bg-[#FFF4C2] text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                    <th className={TABLE_HEAD_CELL}>№</th>
                    <th className={TABLE_HEAD_CELL}>Дата</th>
                    <th className={TABLE_HEAD_CELL}>Отдаёт</th>
                    <th className={TABLE_HEAD_CELL}>Получает</th>
                    <th className={TABLE_HEAD_CELL}>Курс</th>
                    <th className={TABLE_HEAD_CELL}>Клиент</th>
                    <th className={TABLE_HEAD_CELL}>Статус</th>
                    <th className={`${TABLE_HEAD_CELL} text-right`}> </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => {
                    const created = formatOrderCreatedAt(order.created_at);
                    return (
                    <tr
                      key={order.id}
                      className="border-b border-zinc-200 hover:bg-zinc-50/80"
                    >
                      <td className={TABLE_CELL}>
                        <div className="text-xs font-bold text-zinc-900 leading-tight break-words">
                          {orderPublicTitle(order)}
                        </div>
                      </td>
                      <td className={TABLE_CELL}>
                        <p className="text-xs font-medium text-zinc-700 leading-tight">
                          {created.date}
                        </p>
                        <p className="text-[11px] font-medium text-zinc-400 leading-tight">
                          {created.time}
                        </p>
                        <div className="mt-1">
                          <OrderTtlBadge
                            createdAt={orderTtlStartedAt(order)}
                            status={order.status}
                            now={now}
                            compact
                          />
                        </div>
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
                        <span className="text-xs font-semibold tabular-nums text-zinc-800 break-words leading-tight">
                          {formatLockedOrderRate(
                            order.amount_from,
                            order.amount_to,
                            order.currency_from,
                            order.currency_to,
                          )}
                        </span>
                      </td>
                      <td className={TABLE_CELL}>
                        <div className="min-w-0 space-y-1">
                          <StaffClientInfo
                            client={order.client}
                            stacked
                            hideLabel
                          />
                          <StaffOperatorLabel
                            className="whitespace-normal break-words"
                            snapshot={order.operator_pseudonym_snapshot}
                            emptyLabel="Нет оператора"
                          />
                        </div>
                      </td>
                      <td className={TABLE_CELL}>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold leading-tight ${orderStatusBadgeClass(order.status)}`}
                        >
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className={TABLE_CELL}>
                        {renderRowActions(order)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {showPagination && (
              <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-3 py-2">
                <p className="text-xs font-semibold text-zinc-400">
                  {(currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, tabOrders.length)} из{" "}
                  {tabOrders.length}
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
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
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
      <ConfirmDialogHost />
    </div>
  );
}
