"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeWithAuth } from "@/src/utils/supabase/realtime";
import { subscribeOrdersInbox } from "@/src/utils/supabase/orders-inbox";
import { Loader2, CheckCircle2, Upload, Check } from "lucide-react";
import { useAuth } from "@/src/app/context/AuthContext";
import { isRubPayout } from "@/src/utils/exchange-currencies";
import { Button } from "@/components/ui/button";
import {
  hasOrderTtl,
  useNowTick,
} from "@/src/components/OrderTtlBadge/OrderTtlBadge";
import StaffScrollTabs from "@/src/components/staff/StaffScrollTabs";
import StaffPageHeader from "@/src/components/staff/StaffPageHeader";
import OperatorOrderCard from "@/src/components/staff/OperatorOrderCard";
import { isOrderExpiredByTtl } from "@/src/utils/orders/ttl";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";
import type { OrderClient } from "@/src/utils/orders/client-info";
import { mergeOrderClient } from "@/src/utils/orders/client-info";
import {
  buildOperatorPaymentDetails,
  clientPaysWithCrypto,
} from "@/src/utils/orders/payment-details";
import OperatorPayInForm from "@/src/components/PaymentRequisites/OperatorPayInForm";
import PaymentRequisitesView from "@/src/components/PaymentRequisites/PaymentRequisitesView";

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
}

type TabId = "new" | "in_work" | "awaiting" | "review" | "completed" | "cancelled";

export default function OperatorOrdersPage() {
  const supabase = createClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { confirm, ConfirmDialogHost } = useConfirmDialog();

  const [newOrders, setNewOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("new");
  const [detailsInput, setDetailsInput] = useState<{
    [key: string]: { bankId: string; phone: string; wallet: string };
  }>({});

  const userIdRef = useRef<string | null>(null);
  const clientCacheRef = useRef(new Map<string, OrderClient>());
  if (user?.id) {
    userIdRef.current = user.id;
  }

  const now = useNowTick(!loading && !!user?.id);
  const expiredHandledRef = useRef<Set<string>>(new Set());

  const rememberClient = (order: Order): Order =>
    mergeOrderClient(clientCacheRef.current, order);

  const applyOrderUpdate = (updated: Order) => {
    const next = rememberClient(updated);

    setNewOrders((prev) => prev.filter((o) => o.id !== next.id));
    setMyOrders((prev) => prev.filter((o) => o.id !== next.id));
    setCancelledOrders((prev) => prev.filter((o) => o.id !== next.id));
    setCompletedOrders((prev) => prev.filter((o) => o.id !== next.id));

    if (next.status === "pending") {
      setNewOrders((prev) => [next, ...prev]);
      return;
    }

    if (
      ["processing", "awaiting_payment", "paid"].includes(next.status) &&
      next.operator_id === userIdRef.current
    ) {
      setMyOrders((prev) => [next, ...prev]);
      return;
    }

    if (
      next.status === "completed" &&
      next.operator_id === userIdRef.current
    ) {
      setCompletedOrders((prev) => [next, ...prev].slice(0, 50));
      return;
    }

    if (
      next.status === "cancelled" &&
      (next.operator_id === userIdRef.current || next.operator_id == null)
    ) {
      setCancelledOrders((prev) => [next, ...prev].slice(0, 100));
    }
  };

  const applyOrderUpdateRef = useRef(applyOrderUpdate);
  applyOrderUpdateRef.current = applyOrderUpdate;

  // Когда таймер истёк — подтверждаем отмену через API (сервер сам переведёт в cancelled)
  useEffect(() => {
    const candidates = [...newOrders, ...myOrders].filter(
      (o) => hasOrderTtl(o.status) && isOrderExpiredByTtl(o.created_at, now),
    );
    for (const order of candidates) {
      if (expiredHandledRef.current.has(order.id)) continue;
      expiredHandledRef.current.add(order.id);
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
        const cancelled = ((json.cancelled || []) as Order[]).map(rememberClient);
        const completed = ((json.completed || []) as Order[]).map(rememberClient);
        setNewOrders(pending);
        setMyOrders(mine);
        setCancelledOrders(cancelled);
        setCompletedOrders(completed);
      } catch (err) {
        console.error("Ошибка:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchInitialOrders();
  }, [user?.id, isAuthLoading]);

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

  const handleClaimOrder = async (orderId: string) => {
    if (!user?.id) return;

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
      setActiveTab("in_work");
    } catch (err) {
      console.error(err);
      alert("Произошла системная ошибка.");
    }
  };

  const handleSendDetails = async (orderId: string) => {
    const target = myOrders.find((o) => o.id === orderId);
    if (!target) return;
    const current = detailsInput[orderId] ?? {
      bankId: "",
      phone: "",
      wallet: "",
    };
    const check = buildOperatorPaymentDetails(target.currency_from, current);
    if (!check.ok) {
      alert(check.error);
      return;
    }

    const paysCrypto = clientPaysWithCrypto(target.currency_from);
    const ok = await confirm({
      title: "Отправить реквизиты клиенту?",
      description: paysCrypto
        ? `Клиент отправит ${target.currency_from.replace(/_/g, " ")} на адрес ${check.summary}.`
        : `${check.summary}. Клиент увидит эти реквизиты и сможет оплатить заявку.`,
      confirmLabel: "Отправить",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_details: check.payload,
          status: "awaiting_payment",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert("Не удалось отправить реквизиты: " + (json.error || res.status));
        return;
      }
      if (json.order) applyOrderUpdate(json.order as Order);
      setDetailsInput((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      setActiveTab("awaiting");
    } catch (err) {
      console.error(err);
      alert("Произошла системная ошибка.");
    }
  };

  const handleCloseOrder = async (
    orderId: string,
    status: "completed" | "cancelled",
  ) => {
    const target = myOrders.find((o) => o.id === orderId);
    if (
      status === "completed" &&
      target &&
      isRubPayout(target.currency_to) &&
      !target.operator_receipt_url
    ) {
      alert("Прикрепите PDF-чек выплаты рублей клиенту перед завершением.");
      return;
    }

    const ok = await confirm(
      status === "completed"
        ? {
            title: "Закрыть заявку как успешную?",
            description:
              "Вы подтверждаете получение средств и завершение обмена.",
            confirmLabel: "Завершить",
          }
        : {
            title: "Отклонить заявку?",
            description: "Деньги не пришли или чек недействителен.",
            confirmLabel: "Отклонить",
            variant: "destructive",
          },
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert("Не удалось обновить заявку: " + (json.error || res.status));
        return;
      }
      if (json.order) {
        applyOrderUpdate(json.order as Order);
      } else {
        setNewOrders((prev) => prev.filter((o) => o.id !== orderId));
        setMyOrders((prev) => prev.filter((o) => o.id !== orderId));
        if (status === "cancelled" && target) {
          setCancelledOrders((prev) => [
            { ...target, status: "cancelled" },
            ...prev,
          ]);
        }
      }
      setActiveTab(status === "cancelled" ? "cancelled" : "completed");
    } catch (err) {
      console.error(err);
      alert("Произошла системная ошибка.");
    }
  };

  const handleOperatorReceiptUpload = async (
    orderId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Нужен файл PDF");
      e.target.value = "";
      return;
    }

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/orders/${orderId}/operator-receipt`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось загрузить чек");
      if (json.order) applyOrderUpdate(json.order as Order);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      e.target.value = "";
    }
  };

  // Если заявка перешла в paid — открываем таб проверки
  useEffect(() => {
    if (reviewOrders.length > 0 && activeTab === "awaiting") {
      setActiveTab("review");
    }
  }, [reviewOrders.length, activeTab]);

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

  const renderEmpty = (text: string) => (
    <div className="px-5 py-12 sm:py-16 text-center bg-white rounded-2xl text-zinc-400 text-sm font-medium border border-dashed border-zinc-200">
      {text}
    </div>
  );

  const renderMyOrderCard = (order: Order) => {
    const tone =
      order.status === "paid"
        ? "review"
        : order.status === "processing"
          ? "processing"
          : "awaiting";
    const statusText =
      order.status === "processing"
        ? "В обработке"
        : order.status === "awaiting_payment"
          ? "Ожидает оплаты"
          : "Клиент оплатил";

    return (
      <OperatorOrderCard
        key={order.id}
        order={order}
        now={now}
        tone={tone}
        statusText={statusText}
        walletLabel="Куда отправить клиенту"
      >
        {order.payment_details && (
          <div className="rounded-xl bg-zinc-50/80 border border-zinc-100 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Выданные реквизиты
            </p>
            <PaymentRequisitesView value={order.payment_details} compact />
          </div>
        )}
        {order.receipt_url && (
          <a
            href={order.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:underline"
          >
            Чек клиента (PDF)
          </a>
        )}
        {order.status === "processing" && (
          <div className="space-y-2.5">
            <label className="block text-[11px] font-semibold text-zinc-500">
              {clientPaysWithCrypto(order.currency_from)
                ? "Адрес для оплаты клиентом"
                : "Реквизиты СБП для оплаты клиентом"}
            </label>
            <OperatorPayInForm
              currencyFrom={order.currency_from}
              bankId={detailsInput[order.id]?.bankId ?? ""}
              phone={detailsInput[order.id]?.phone ?? ""}
              wallet={detailsInput[order.id]?.wallet ?? ""}
              onBankChange={(bankId) =>
                setDetailsInput((prev) => ({
                  ...prev,
                  [order.id]: {
                    bankId,
                    phone: prev[order.id]?.phone ?? "",
                    wallet: prev[order.id]?.wallet ?? "",
                  },
                }))
              }
              onPhoneChange={(phone) =>
                setDetailsInput((prev) => ({
                  ...prev,
                  [order.id]: {
                    bankId: prev[order.id]?.bankId ?? "",
                    phone,
                    wallet: prev[order.id]?.wallet ?? "",
                  },
                }))
              }
              onWalletChange={(wallet) =>
                setDetailsInput((prev) => ({
                  ...prev,
                  [order.id]: {
                    bankId: prev[order.id]?.bankId ?? "",
                    phone: prev[order.id]?.phone ?? "",
                    wallet,
                  },
                }))
              }
            />
            <button
              onClick={() => handleSendDetails(order.id)}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
            >
              Отправить реквизиты
            </button>
          </div>
        )}
        {order.status === "awaiting_payment" && (
          <div className="flex items-start gap-3 rounded-xl bg-violet-50/80 border border-violet-100 px-3.5 py-3">
            <CheckCircle2 className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-violet-800">
                Реквизиты отправлены
              </p>
              <p className="text-[12px] text-violet-700/70 mt-0.5">
                Ждём оплату и чек от клиента
              </p>
            </div>
          </div>
        )}
        {order.status === "paid" && (
          <div className="rounded-xl bg-teal-50/80 border border-teal-200 px-3.5 py-3 space-y-3">
            <p className="text-sm font-semibold text-teal-800">
              Проверьте поступление и чек
            </p>
            {order.receipt_url ? (
              <a
                href={order.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-semibold text-teal-800 hover:underline"
              >
                Открыть чек клиента
              </a>
            ) : (
              <p className="text-xs text-zinc-500">Файл чека клиента не найден</p>
            )}

            {isRubPayout(order.currency_to) && (
              <div className="space-y-2 border-t border-teal-200 pt-3">
                <p className="text-[11px] font-semibold text-zinc-600">
                  Чек выплаты RUB
                </p>
                {order.operator_receipt_url ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800">
                      <Check className="w-3.5 h-3.5" />
                      Прикреплён
                    </span>
                    <a
                      href={`/api/orders/${order.id}/operator-receipt`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-zinc-600 hover:underline"
                    >
                      Открыть PDF
                    </a>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 border border-dashed border-teal-300 bg-white rounded-xl px-3 py-2.5 cursor-pointer hover:bg-teal-50/50">
                    <input
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      onChange={(e) => handleOperatorReceiptUpload(order.id, e)}
                    />
                    <Upload className="w-4 h-4 text-teal-600" />
                    <span className="text-xs font-semibold text-zinc-700">
                      Прикрепить PDF
                    </span>
                  </label>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleCloseOrder(order.id, "completed")}
                disabled={
                  isRubPayout(order.currency_to) && !order.operator_receipt_url
                }
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-semibold py-2.5 rounded-xl text-sm cursor-pointer transition-colors disabled:cursor-not-allowed"
              >
                Успешно
              </button>
              <button
                onClick={() => handleCloseOrder(order.id, "cancelled")}
                className="bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold py-2.5 rounded-xl text-sm cursor-pointer transition-colors"
              >
                Отклонить
              </button>
            </div>
          </div>
        )}
      </OperatorOrderCard>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-5 lg:space-y-6 text-zinc-900 font-sans antialiased">
      <StaffPageHeader
        title="Активные ордера"
        description="Очередь и ваши заявки по этапам"
      />

      <StaffScrollTabs>
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className={`text-xs font-bold rounded-xl h-8 px-3 sm:px-4 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white text-zinc-900 shadow-xs hover:bg-white"
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

      {activeTab === "new" && (
        <div className="space-y-3 sm:space-y-4">
          {newOrders.length === 0
            ? renderEmpty(
                "Сейчас очередь пуста. Новые обмены появятся здесь мгновенно.",
              )
            : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
                {newOrders.map((order) => (
                  <OperatorOrderCard
                    key={order.id}
                    order={order}
                    now={now}
                    tone="new"
                    statusText="Новая"
                    actions={
                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href={`/operator/orders/${order.id}`}
                          className="inline-flex items-center justify-center border border-zinc-200 hover:border-zinc-300 hover:bg-white text-zinc-800 font-semibold py-2.5 px-2 rounded-xl text-xs min-[380px]:text-sm cursor-pointer transition-colors text-center leading-snug"
                        >
                          Открыть
                        </Link>
                        <button
                          onClick={() => handleClaimOrder(order.id)}
                          className="bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-950 font-semibold py-2.5 px-2 rounded-xl text-xs min-[380px]:text-sm cursor-pointer transition-colors leading-snug"
                        >
                          Взять в работу
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            )}
        </div>
      )}

      {activeTab === "in_work" && (
        inWorkOrders.length === 0
          ? renderEmpty(
              "Нет заявки в работе. Возьмите ордер из вкладки «Новые».",
            )
          : (
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3 sm:gap-4">
              {inWorkOrders.map(renderMyOrderCard)}
            </div>
          )
      )}

      {activeTab === "awaiting" && (
        awaitingOrders.length === 0
          ? renderEmpty("Нет заявок, ожидающих оплаты клиента.")
          : (
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3 sm:gap-4">
              {awaitingOrders.map(renderMyOrderCard)}
            </div>
          )
      )}

      {activeTab === "review" && (
        reviewOrders.length === 0
          ? renderEmpty("Нет заявок на проверке оплаты.")
          : (
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3 sm:gap-4">
              {reviewOrders.map(renderMyOrderCard)}
            </div>
          )
      )}

      {activeTab === "completed" && (
        completedOrders.length === 0
          ? renderEmpty("Нет выполненных заявок.")
          : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
              {completedOrders.map((order) => (
                <OperatorOrderCard
                  key={order.id}
                  order={order}
                  now={now}
                  tone="completed"
                  statusText="Выполнена"
                  showOperator
                  walletLabel="Реквизиты клиента"
                />
              ))}
            </div>
          )
      )}

      {activeTab === "cancelled" && (
        cancelledOrders.length === 0
          ? renderEmpty(
              "Нет отменённых заявок. Сюда попадают заявки после ручной отмены или истечения таймера.",
            )
          : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
              {cancelledOrders.map((order) => (
                <OperatorOrderCard
                  key={order.id}
                  order={order}
                  now={now}
                  tone="cancelled"
                  statusText="Отменена"
                  walletLabel="Реквизиты клиента"
                />
              ))}
            </div>
          )
      )}
      <ConfirmDialogHost />
    </div>
  );
}
