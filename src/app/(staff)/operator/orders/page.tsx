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
  OrderTtlBadge,
  hasOrderTtl,
  useNowTick,
} from "@/src/components/OrderTtlBadge/OrderTtlBadge";
import StaffOperatorLabel from "@/src/components/StaffOperatorLabel/StaffOperatorLabel";
import StaffScrollTabs from "@/src/components/staff/StaffScrollTabs";
import StaffPageHeader from "@/src/components/staff/StaffPageHeader";
import { isOrderExpiredByTtl } from "@/src/utils/orders/ttl";

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
}

type TabId = "new" | "in_work" | "awaiting" | "review" | "completed" | "cancelled";

function formatCreatedAt(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OperatorOrdersPage() {
  const supabase = createClient();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [newOrders, setNewOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("new");
  const [detailsInput, setDetailsInput] = useState<{ [key: string]: string }>(
    {},
  );

  const userIdRef = useRef<string | null>(null);
  if (user?.id) {
    userIdRef.current = user.id;
  }

  const now = useNowTick(!loading && !!user?.id);
  const expiredHandledRef = useRef<Set<string>>(new Set());

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
        setNewOrders((json.pending || []) as Order[]);
        setMyOrders((json.mine || []) as Order[]);
        setCancelledOrders((json.cancelled || []) as Order[]);
        setCompletedOrders((json.completed || []) as Order[]);
      } catch (err) {
        console.error("Ошибка:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchInitialOrders();
  }, [user?.id, isAuthLoading]);

  const applyOrderUpdate = (updated: Order) => {
    setNewOrders((prev) => prev.filter((o) => o.id !== updated.id));
    setMyOrders((prev) => prev.filter((o) => o.id !== updated.id));
    setCancelledOrders((prev) => prev.filter((o) => o.id !== updated.id));
    setCompletedOrders((prev) => prev.filter((o) => o.id !== updated.id));

    if (updated.status === "pending") {
      setNewOrders((prev) => [updated, ...prev]);
      return;
    }

    if (
      ["processing", "awaiting_payment", "paid"].includes(updated.status) &&
      updated.operator_id === userIdRef.current
    ) {
      setMyOrders((prev) => [updated, ...prev]);
      return;
    }

    if (
      updated.status === "completed" &&
      updated.operator_id === userIdRef.current
    ) {
      setCompletedOrders((prev) => [updated, ...prev].slice(0, 50));
      return;
    }

    if (
      updated.status === "cancelled" &&
      (updated.operator_id === userIdRef.current || updated.operator_id == null)
    ) {
      setCancelledOrders((prev) => [updated, ...prev].slice(0, 100));
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    let pgChannel: ReturnType<typeof supabase.channel> | null = null;

    const inboxChannel = subscribeOrdersInbox(supabase, (order, event) => {
      if (event === "created" && order.status === "pending") {
        setNewOrders((prev) => {
          if (prev.some((o) => o.id === order.id)) return prev;
          return [order as Order, ...prev];
        });
        return;
      }
      applyOrderUpdate(order as Order);
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
                setNewOrders((prev) => {
                  if (prev.some((o) => o.id === inserted.id)) return prev;
                  return [inserted, ...prev];
                });
              }
            } else if (payload.eventType === "UPDATE") {
              applyOrderUpdate(payload.new as Order);
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
      supabase.removeChannel(inboxChannel);
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
    const details = detailsInput[orderId];
    if (!details || details.trim() === "") {
      alert("Введите реквизиты для оплаты!");
      return;
    }

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_details: details,
          status: "awaiting_payment",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert("Не удалось отправить реквизиты: " + (json.error || res.status));
        return;
      }
      if (json.order) applyOrderUpdate(json.order as Order);
      setDetailsInput((prev) => ({ ...prev, [orderId]: "" }));
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

    const ok = confirm(
      status === "completed"
        ? "Вы подтверждаете получение и закрываете заявку как Успешную?"
        : "Отклонить заявку? (Деньги не пришли / фейк чек)",
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
    <div className="p-10 text-center bg-zinc-50 rounded-[24px] text-zinc-400 text-sm font-medium border border-dashed border-zinc-200">
      {text}
    </div>
  );

  const renderMyOrderCard = (order: Order) => (
    <div
      key={order.id}
      className={`p-4 sm:p-6 bg-white rounded-[24px] sm:rounded-[32px] border-2 shadow-none grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-4 sm:gap-6 items-start xl:items-center transition-all ${
        order.status === "paid"
          ? "border-emerald-400 bg-emerald-50/20"
          : order.status === "processing"
            ? "border-[#FFDD2D] ring-2 ring-[#FFDD2D]/30"
            : "border-zinc-200 focus-within:border-[#FFDD2D]"
      }`}
    >
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span className="text-sm font-mono font-bold text-zinc-400 break-all">
            ID: {order.id}
          </span>
          <span className="text-xs font-semibold text-zinc-500">
            {formatCreatedAt(order.created_at)}
          </span>
          <OrderTtlBadge
            createdAt={order.created_at}
            status={order.status}
            now={now}
            compact
          />
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full w-fit ${
              order.status === "processing"
                ? "bg-blue-50 text-blue-700 border border-blue-100"
                : order.status === "awaiting_payment"
                  ? "bg-purple-50 text-purple-700 border border-purple-100"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-100"
            }`}
          >
            {order.status === "processing" && "В обработке"}
            {order.status === "awaiting_payment" && "Выданы реквизиты"}
            {order.status === "paid" && "Клиент оплатил! Проверьте чек"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-[20px] text-sm">
          <div>
            <span className="text-zinc-400 block text-xs font-bold mb-1">
              КЛИЕНТ ОТДАЕТ:
            </span>
            <span className="font-black text-zinc-900 text-base">
              {Number(order.amount_from || 0).toLocaleString("ru-RU")}{" "}
              {order.currency_from}
            </span>
          </div>
          <div>
            <span className="text-zinc-400 block text-xs font-bold mb-1">
              РЕКВИЗИТЫ ПОЛУЧЕНИЯ КЛИЕНТА:
            </span>
            <span className="font-mono text-xs font-bold block break-all bg-white px-3 py-1.5 rounded-xl border border-zinc-200">
              {order.wallet_to || "Не указаны"}
            </span>
          </div>
        </div>

        {order.payment_details && (
          <div className="text-xs font-medium text-zinc-500">
            Выданные реквизиты:{" "}
            <span className="font-mono text-zinc-800">{order.payment_details}</span>
          </div>
        )}

        {order.receipt_url && (
          <a
            href={order.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
          >
            Прикрепленный документ об оплате (PDF)
          </a>
        )}
      </div>

      <div className="space-y-3">
        {order.status === "processing" && (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-500 uppercase pl-1">
              Реквизиты для оплаты клиенту:
            </label>
            <textarea
              value={detailsInput[order.id] || ""}
              onChange={(e) =>
                setDetailsInput({
                  ...detailsInput,
                  [order.id]: e.target.value,
                })
              }
              placeholder="Например: Сбербанк 2202..."
              className="w-full h-20 p-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-hidden focus:border-[#FFDD2D] text-zinc-900 resize-none"
            />
            <button
              onClick={() => handleSendDetails(order.id)}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-2.5 rounded-full transition-all text-xs cursor-pointer"
            >
              Отправить реквизиты клиенту
            </button>
          </div>
        )}

        {order.status === "awaiting_payment" && (
          <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 text-center space-y-1">
            <CheckCircle2 className="w-4 h-4 text-purple-600 mx-auto" />
            <p className="text-xs font-bold text-purple-700">
              Реквизиты отправлены
            </p>
            <p className="text-[11px] text-zinc-400 font-medium">
              Ожидаем подтверждения оплаты от пользователя...
            </p>
          </div>
        )}

        {order.status === "paid" && (
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3">
            <div className="text-center space-y-1">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                Клиент оплатил!
              </p>
              {order.receipt_url ? (
                <a
                  href={order.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Чек клиента (PDF)
                </a>
              ) : (
                <p className="text-[11px] text-zinc-400 font-medium">
                  Файл чека клиента не найден
                </p>
              )}
            </div>

            {isRubPayout(order.currency_to) && (
              <div className="space-y-2 border-t border-emerald-200 pt-3">
                <p className="text-[11px] font-bold text-zinc-600 uppercase text-center">
                  Чек выплаты RUB (обязательно)
                </p>
                {order.operator_receipt_url ? (
                  <div className="text-center space-y-1">
                    <p className="text-xs font-bold text-emerald-700 inline-flex items-center gap-1 justify-center w-full">
                      <Check className="w-3.5 h-3.5" />
                      Чек выплаты прикреплён
                    </p>
                    <a
                      href={order.operator_receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Открыть PDF
                    </a>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-1 border border-dashed border-emerald-300 bg-white rounded-xl p-3 cursor-pointer hover:bg-emerald-50/40">
                    <input
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      onChange={(e) =>
                        handleOperatorReceiptUpload(order.id, e)
                      }
                    />
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span className="text-[11px] font-bold text-zinc-700">
                      Прикрепить PDF
                    </span>
                  </label>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => handleCloseOrder(order.id, "completed")}
                disabled={
                  isRubPayout(order.currency_to) && !order.operator_receipt_url
                }
                className="bg-[#FFDD2D] hover:bg-[#e6c628] disabled:bg-zinc-200 disabled:text-zinc-400 text-zinc-950 font-bold py-2 rounded-xl text-xs cursor-pointer transition-colors disabled:cursor-not-allowed"
              >
                Успешно
              </button>
              <button
                onClick={() => handleCloseOrder(order.id, "cancelled")}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl text-xs cursor-pointer transition-colors"
              >
                Отклонить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6 text-zinc-900 font-sans antialiased">
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
            className={`text-xs font-bold rounded-xl h-9 px-3 sm:px-4 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
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
        <div className="space-y-4">
          {newOrders.length === 0
            ? renderEmpty(
                "Сейчас очередь пуста. Новые обмены появятся здесь мгновенно.",
              )
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {newOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 sm:p-6 bg-white rounded-[24px] sm:rounded-[32px] border border-zinc-200 shadow-none flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0 space-y-1">
                          <span className="text-xs font-mono font-bold text-zinc-400">
                            ID: ...{order.id.slice(0, 8)}
                          </span>
                          <p className="text-xs font-semibold text-zinc-500">
                            {formatCreatedAt(order.created_at)}
                          </p>
                          <OrderTtlBadge
                            createdAt={order.created_at}
                            status={order.status}
                            now={now}
                            compact
                          />
                        </div>
                        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-bold shrink-0">
                          Ожидает
                        </span>
                      </div>
                      <div className="mt-4 space-y-1.5">
                        <p className="text-sm font-semibold text-zinc-600">
                          Клиент отдает:{" "}
                          <span className="font-bold text-base text-zinc-900">
                            {Number(order.amount_from || 0).toLocaleString(
                              "ru-RU",
                            )}{" "}
                            {order.currency_from}
                          </span>
                        </p>
                        <p className="text-sm font-semibold text-zinc-400">
                          Должен получить:{" "}
                          <span className="font-bold text-zinc-800">
                            {Number(order.amount_to || 0).toFixed(4)}{" "}
                            {order.currency_to}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleClaimOrder(order.id)}
                      className="w-full bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-950 font-bold py-3 rounded-full text-sm cursor-pointer transition-colors shadow-none"
                    >
                      Взять в работу
                    </button>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {activeTab === "in_work" && (
        <div className="space-y-4">
          {inWorkOrders.length === 0
            ? renderEmpty(
                "Нет заявки в работе. Возьмите ордер из вкладки «Новые».",
              )
            : inWorkOrders.map(renderMyOrderCard)}
        </div>
      )}

      {activeTab === "awaiting" && (
        <div className="space-y-4">
          {awaitingOrders.length === 0
            ? renderEmpty("Нет заявок, ожидающих оплаты клиента.")
            : awaitingOrders.map(renderMyOrderCard)}
        </div>
      )}

      {activeTab === "review" && (
        <div className="space-y-4">
          {reviewOrders.length === 0
            ? renderEmpty("Нет заявок на проверке оплаты.")
            : reviewOrders.map(renderMyOrderCard)}
        </div>
      )}

      {activeTab === "completed" && (
        <div className="space-y-4">
          {completedOrders.length === 0
            ? renderEmpty("Нет выполненных заявок.")
            : completedOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 sm:p-6 bg-white rounded-[24px] sm:rounded-[32px] border border-emerald-200 shadow-none space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <span className="text-sm font-mono font-bold text-zinc-400 break-all">
                      ID: {order.id}
                    </span>
                    <span className="text-xs font-semibold text-zinc-500">
                      {formatCreatedAt(order.created_at)}
                    </span>
                    <span className="text-xs font-bold px-3 py-1 rounded-full w-fit bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Выполнена
                    </span>
                    <StaffOperatorLabel snapshot={order.operator_pseudonym_snapshot} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-[20px] text-sm">
                    <div>
                      <span className="text-zinc-400 block text-xs font-bold mb-1">
                        КЛИЕНТ ОТДАЕТ:
                      </span>
                      <span className="font-black text-zinc-900 text-base">
                        {Number(order.amount_from || 0).toLocaleString("ru-RU")}{" "}
                        {order.currency_from}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-xs font-bold mb-1">
                        КЛИЕНТ ПОЛУЧИЛ:
                      </span>
                      <span className="font-black text-zinc-800 text-base">
                        {Number(order.amount_to || 0).toFixed(4)}{" "}
                        {order.currency_to}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/operator/orders/${order.id}`}
                    className="inline-flex text-xs font-bold text-zinc-600 hover:text-zinc-900 underline-offset-2 hover:underline"
                  >
                    Открыть заявку
                  </Link>
                </div>
              ))}
        </div>
      )}

      {activeTab === "cancelled" && (
        <div className="space-y-4">
          {cancelledOrders.length === 0
            ? renderEmpty(
                "Нет отменённых заявок. Сюда попадают заявки после ручной отмены или истечения таймера.",
              )
            : cancelledOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 sm:p-6 bg-white rounded-[24px] sm:rounded-[32px] border border-rose-200 shadow-none space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <span className="text-sm font-mono font-bold text-zinc-400 break-all">
                      ID: {order.id}
                    </span>
                    <span className="text-xs font-semibold text-zinc-500">
                      {formatCreatedAt(order.created_at)}
                    </span>
                    <span className="text-xs font-bold px-3 py-1 rounded-full w-fit bg-rose-50 text-rose-700 border border-rose-100">
                      Отменена
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-[20px] text-sm">
                    <div>
                      <span className="text-zinc-400 block text-xs font-bold mb-1">
                        КЛИЕНТ ОТДАЕТ:
                      </span>
                      <span className="font-black text-zinc-900 text-base">
                        {Number(order.amount_from || 0).toLocaleString("ru-RU")}{" "}
                        {order.currency_from}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-xs font-bold mb-1">
                        ДОЛЖЕН ПОЛУЧИТЬ:
                      </span>
                      <span className="font-black text-zinc-800 text-base">
                        {Number(order.amount_to || 0).toFixed(4)}{" "}
                        {order.currency_to}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
        </div>
      )}
    </div>
  );
}
