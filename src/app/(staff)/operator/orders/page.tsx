"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/src/utils/supabase/client";
import {
  bindRealtimeFallback,
  subscribeWithAuth,
} from "@/src/utils/supabase/realtime";
import { useAuth } from "@/src/app/context/AuthContext";
import { Loader2, CheckCircle2 } from "lucide-react";

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
}

export default function OperatorOrdersPage() {
  const supabase = createClient();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [newOrders, setNewOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsInput, setDetailsInput] = useState<{ [key: string]: string }>(
    {},
  );

  const userIdRef = useRef<string | null>(null);
  if (user?.id) {
    userIdRef.current = user.id;
  }

  // Первоначальный разовый запрос данных из базы
  useEffect(() => {
    if (isAuthLoading) return;

    // СУПЕР-ЗАЩИТА: Если пользователя нет (сборка на Vercel),
    // эффект сразу завершается, не допуская краша Node.js
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
      } catch (err) {
        console.error("Ошибка:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchInitialOrders();
  }, [user?.id, isAuthLoading]);

  // Realtime (+ редкий BFF-poll, если WS не подписался)
  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function refreshFromBff() {
      try {
        const res = await fetch("/api/orders/staff", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || cancelled) return;
        setNewOrders((json.pending || []) as Order[]);
        setMyOrders((json.mine || []) as Order[]);
      } catch {
        // ignore
      }
    }

    const fallback = bindRealtimeFallback(
      () => {},
      () => void refreshFromBff(),
    );

    void (async () => {
      channel = supabase
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
              const updated = payload.new as Order;

              setNewOrders((prev) => prev.filter((o) => o.id !== updated.id));
              setMyOrders((prev) => prev.filter((o) => o.id !== updated.id));

              if (updated.status === "pending") {
                setNewOrders((prev) => [updated, ...prev]);
              } else if (
                ["processing", "awaiting_payment", "paid"].includes(
                  updated.status,
                ) &&
                updated.operator_id === currentUserId
              ) {
                setMyOrders((prev) => [updated, ...prev]);
              }
            } else if (payload.eventType === "DELETE") {
              setNewOrders((prev) =>
                prev.filter((o) => o.id !== payload.old.id),
              );
              setMyOrders((prev) =>
                prev.filter((o) => o.id !== payload.old.id),
              );
            }
          },
        );

      await subscribeWithAuth(supabase, channel, fallback.onStatus);
    })();

    return () => {
      cancelled = true;
      fallback.clear();
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, supabase]);

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
        alert("Эту заявку уже забрал другой оператор!");
        return;
      }
      if (!res.ok) {
        alert("Ошибка при взятии заявки: " + (json.error || res.status));
      }
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
      setDetailsInput((prev) => ({ ...prev, [orderId]: "" }));
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

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-12 text-zinc-900 font-sans antialiased">
      {/* СЕКЦИЯ 1: СВОБОДНЫЕ ЗАЯВКИ (ОЖИДАЮТ ОПЕРАТОРА) */}
      <div className="space-y-4">
        <h2 className="text-xl font-black uppercase tracking-wider text-amber-500 flex items-center gap-2 select-none">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          Новые заявки в очереди ({newOrders.length})
        </h2>

        {newOrders.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50 rounded-[24px] text-zinc-400 text-sm font-medium border border-dashed border-zinc-200">
            Сейчас очередь пуста. Новые обмены появятся здесь мгновенно.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {newOrders.map((order) => (
              <div
                key={order.id}
                className="p-6 bg-white rounded-[32px] border border-zinc-200 shadow-none flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono font-bold text-zinc-400">
                      ID: ...{order.id.slice(0, 8)}
                    </span>
                    <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-bold">
                      Ожидает
                    </span>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    <p className="text-sm font-semibold text-zinc-600">
                      Клиент отдает:{" "}
                      <span className="font-bold text-base text-zinc-900">
                        {Number(order.amount_from || 0).toLocaleString("ru-RU")}{" "}
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
      {/* СЕКЦИЯ 2: ЗАЯВКИ В РАБОТЕ У ТЕКУЩЕГО ОПЕРАТОРА */}
      <div className="space-y-4 pt-6 border-t border-zinc-100">
        <h2 className="text-xl font-black uppercase tracking-wider text-blue-500 flex items-center gap-2 select-none">
          Мои активные задачи ({myOrders.length})
        </h2>

        {myOrders.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50 rounded-[24px] text-zinc-400 text-sm font-medium border border-dashed border-zinc-200">
            У вас нет взятых заявок. Заберите активные обмены из верхней
            очереди!
          </div>
        ) : (
          <div className="space-y-4">
            {myOrders.map((order) => (
              <div
                key={order.id}
                className={`p-6 bg-white rounded-[32px] border-2 shadow-none grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 items-center transition-all ${
                  order.status === "paid"
                    ? "border-emerald-400 bg-emerald-50/20"
                    : "border-zinc-200 focus-within:border-[#FFDD2D]"
                }`}
              >
                {/* Левая часть: Подробная информация */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-zinc-400">
                      ID: {order.id}
                    </span>

                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        order.status === "processing"
                          ? "bg-blue-50 text-blue-700 border border-blue-100"
                          : order.status === "awaiting_payment"
                            ? "bg-purple-50 text-purple-700 border border-purple-100"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      }`}
                    >
                      {order.status === "processing" && "В обработке"}
                      {order.status === "awaiting_payment" &&
                        "Выданы реквизиты"}
                      {order.status === "paid" &&
                        "Клиент оплатил! Проверьте чек"}
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
                        {order.payment_details || "Не указаны реквизиты в БД"}
                      </span>
                    </div>
                  </div>

                  {/* Ссылка на документ об оплате */}
                  {order.receipt_url && (
                    <div className="pt-1">
                      <a
                        href={order.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                      >
                        📎 Прикрепленный документ об оплате (PDF / Чек)
                      </a>
                    </div>
                  )}
                </div>

                {/* Правая часть: Управление логикой работы оператора */}
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
                            📄 Открыть PDF чек в новой вкладке
                          </a>
                        ) : (
                          <p className="text-[11px] text-zinc-400 font-medium">
                            Файл чека не найден в базе данных
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={async () => {
                            if (
                              confirm(
                                "Вы подтверждаете получение и закрываете заявку как Успешную?",
                              )
                            ) {
                              await fetch(`/api/orders/${order.id}`, {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ status: "completed" }),
                              });
                            }
                          }}
                          className="bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-950 font-bold py-2 rounded-xl text-xs cursor-pointer transition-colors"
                        >
                          Успешно
                        </button>
                        <button
                          onClick={async () => {
                            if (
                              confirm(
                                "Отклонить заявку? (Деньги не пришли / фейк чек)",
                              )
                            ) {
                              await fetch(`/api/orders/${order.id}`, {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ status: "cancelled" }),
                              });
                            }
                          }}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl text-xs cursor-pointer transition-colors"
                        >
                          Отклонить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
