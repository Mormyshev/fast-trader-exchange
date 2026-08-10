"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeWithAuth } from "@/src/utils/supabase/realtime";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Check,
  ArrowLeft,
} from "lucide-react";
import {
  formatOrderTimeLeft,
  isOrderExpiredByTtl,
  ORDER_TTL_STATUSES,
} from "@/src/utils/orders/ttl";

interface OrderStatusClientProps {
  initialOrder: any;
}

export default function OrderStatusClient({
  initialOrder,
}: OrderStatusClientProps) {
  const [order, setOrder] = useState<any>(initialOrder);
  const [timeLeft, setTimeLeft] = useState<string>(() =>
    formatOrderTimeLeft(initialOrder.created_at),
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(
    Boolean(initialOrder?.receipt_url),
  );
  const cancelInFlight = useRef(false);

  const canCancel = (ORDER_TTL_STATUSES as readonly string[]).includes(
    order.status,
  );

  const cancelOrder = async (reason: "manual" | "timeout" = "manual") => {
    if (!canCancel || cancelInFlight.current) return;
    cancelInFlight.current = true;
    setIsCancelling(true);

    const prevStatus = order.status;
    setOrder((prev: any) => ({ ...prev, status: "cancelled" }));

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOrder((prev: any) => ({ ...prev, status: prevStatus }));
        throw new Error(json.error || "Не удалось отменить заявку");
      }
      if (json.order) setOrder(json.order);
      if (reason === "timeout") {
        alert("Время жизни заявки истекло. Заявка автоматически отменена.");
      }
    } catch (err: unknown) {
      cancelInFlight.current = false;
      const message =
        err instanceof Error ? err.message : "Не удалось отменить заявку";
      if (reason === "manual") alert(message);
      console.error("Cancel order error:", err);
    } finally {
      setIsCancelling(false);
    }
  };

  // BFF + Realtime
  useEffect(() => {
    let cancelled = false;
    const client = createClient();
    let channel: ReturnType<typeof client.channel> | null = null;

    const refreshOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.order) {
          setOrder(json.order);
          if (json.order.receipt_url) setUploadSuccess(true);
        }
      } catch {
        // ignore
      }
    };

    void (async () => {
      await refreshOrder();
      if (cancelled) return;

      channel = client
        .channel(`order-status-${order.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `id=eq.${order.id}`,
          },
          (payload) => {
            setOrder(payload.new);
            if ((payload.new as any)?.receipt_url) setUploadSuccess(true);
          },
        );

      await subscribeWithAuth(client, channel);
    })();

    return () => {
      cancelled = true;
      if (channel) client.removeChannel(channel);
    };
  }, [order.id]);

  useEffect(() => {
    if (!(ORDER_TTL_STATUSES as readonly string[]).includes(order.status)) {
      return;
    }

    const tick = () => {
      setTimeLeft(formatOrderTimeLeft(order.created_at));
      if (isOrderExpiredByTtl(order.created_at)) {
        void cancelOrder("timeout");
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cancel only when timer hits zero
  }, [order.status, order.created_at, order.id]);

  const handleCancelClick = () => {
    if (
      !confirm(
        "Отменить заявку? Это действие нельзя будет отменить.",
      )
    ) {
      return;
    }
    void cancelOrder("manual");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Пожалуйста, загрузите чек в формате PDF!");
      return;
    }

    setIsUploading(true);
    setUploadSuccess(false);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`/api/orders/${order.id}/receipt`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось сохранить чек");

      if (json.order) {
        setOrder(json.order);
      } else {
        setOrder((prev: any) => ({
          ...prev,
          receipt_url: json.order?.receipt_url || prev.receipt_url,
        }));
      }
      setUploadSuccess(true);
    } catch (err: any) {
      console.error("Ошибка загрузки чека:", err);
      alert(`Ошибка загрузки чека: ${err.message || "попробуйте позже"}`);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleConfirmPayment = async () => {
    if (!order.receipt_url && !uploadSuccess) {
      alert("Пожалуйста, сначала прикрепите PDF-чек об оплате!");
      return;
    }

    setIsConfirming(true);
    // мгновенный UI, не ждём Realtime
    setOrder((prev: any) => ({ ...prev, status: "paid" }));

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOrder((prev: any) => ({ ...prev, status: "awaiting_payment" }));
        throw new Error(json.error || "Не удалось обновить статус");
      }

      if (json.order) setOrder(json.order);
      alert("Заявка отправлена оператору на проверку! Ожидайте подтверждения.");
    } catch (err: any) {
      console.error("Ошибка смены статуса:", err);
      alert(`Не удалось отправить уведомление: ${err.message}`);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="p-0 md:p-4 w-full transition-all">
      <div className="mb-4">
        <Link
          href="/user/orders"
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />К моим заявкам
        </Link>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-5 md:p-8 space-y-6 shadow-xs border border-zinc-100 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Заявка на обмен
            </h1>
            <p className="text-xs font-medium text-zinc-400 mt-1">
              Создана{" "}
              {new Date(order.created_at).toLocaleString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Статус:
            </span>
            <span
              className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-xs border ${
                order.status === "pending"
                  ? "bg-amber-400 text-zinc-900 border-amber-500"
                  : order.status === "processing"
                    ? "bg-blue-500 text-white border-blue-600"
                    : order.status === "awaiting_payment"
                      ? "bg-purple-500 text-white border-purple-600"
                      : order.status === "paid"
                        ? "bg-indigo-500 text-white border-indigo-600"
                        : order.status === "completed"
                          ? "bg-emerald-500 text-white border-emerald-600"
                          : "bg-rose-500 text-white border-rose-600"
              }`}
            >
              {order.status === "pending" && "В ожидании"}
              {order.status === "processing" && "В обработке"}
              {order.status === "awaiting_payment" && "На оплате"}
              {order.status === "paid" && "Проверка оплаты"}
              {order.status === "completed" && "Выполнена"}
              {order.status === "cancelled" && "Отменена"}
            </span>
          </div>
        </div>

        <div className="py-2">
          {order.status === "pending" && (
            <div className="flex flex-col items-center text-center space-y-5 bg-amber-400/25 dark:bg-amber-500/15 border border-amber-400/60 p-8 md:p-12 rounded-[24px] shadow-sm">
              <div className="w-14 h-14 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center shadow-sm animate-pulse border border-amber-300">
                <Clock className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                  Ожидаем реквизиты от мерчанта
                </h3>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 max-w-lg leading-relaxed">
                  Ваша заявка успешно создана и передана в систему распределения.
                  Первый освободившийся оператор отправит реквизиты для оплаты.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center space-x-2.5 text-sm font-bold text-zinc-800 dark:text-zinc-200 bg-white/80 dark:bg-zinc-800/80 px-4 py-2 rounded-full border border-amber-300 shadow-xs">
                  <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                  <span>Обычно это занимает не более 5 минут...</span>
                </div>
                <div className="font-mono font-black text-base text-zinc-950 dark:text-zinc-50 bg-white dark:bg-zinc-800 px-4 py-2 rounded-full border border-amber-300">
                  {timeLeft}
                </div>
              </div>
            </div>
          )}

          {order.status === "processing" && (
            <div className="flex flex-col items-center text-center space-y-5 bg-blue-500/15 dark:bg-blue-500/10 border border-blue-400/40 p-8 md:p-12 rounded-[24px] shadow-sm">
              <div className="w-14 h-14 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center shadow-sm border border-blue-300">
                <Loader2 className="w-7 h-7 animate-spin stroke-[2.5]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                  Заявка принята оператором
                </h3>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 max-w-lg leading-relaxed">
                  Оператор взял ваш ордер в обработку. Пожалуйста, не закрывайте
                  страницу, реквизиты появятся здесь в течение 1–2 минут.
                </p>
                <p className="font-mono font-black text-lg text-zinc-900 dark:text-zinc-50">
                  Осталось: {timeLeft}
                </p>
              </div>
            </div>
          )}

          {order.status === "awaiting_payment" && (
            <div className="flex flex-col space-y-6 bg-purple-500/15 dark:bg-purple-500/10 border border-purple-400/40 p-6 md:p-10 rounded-[24px] shadow-sm animate-fade-in text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-300/30 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white dark:bg-zinc-800 text-purple-600 rounded-full flex items-center justify-center shadow-xs border border-purple-300">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                      Заявка ожидает вашей оплаты
                    </h3>
                    <p className="text-xs text-zinc-500 font-medium">
                      Переведите точную сумму по указанным реквизитам.
                    </p>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-800 px-4 py-2 rounded-2xl border-2 border-purple-400 shadow-sm flex items-center space-x-2 shrink-0 self-start sm:self-center">
                  <span className="text-xs font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">
                    Осталось:
                  </span>
                  <span className="font-mono font-black text-lg text-zinc-950 dark:text-zinc-50 tracking-wide">
                    {timeLeft}
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-purple-300 shadow-xs space-y-2">
                <span className="block text-[11px] font-black uppercase text-purple-500 tracking-wider">
                  Инструкция и реквизиты мерчанта:
                </span>
                <p className="text-sm font-mono whitespace-pre-wrap font-bold text-zinc-900 dark:text-zinc-50 leading-relaxed bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  {order.payment_details}
                </p>
              </div>

              <div className="space-y-2">
                <span className="block text-[11px] font-black uppercase text-purple-500 tracking-wider">
                  Подтверждение платежа:
                </span>
                <label className="relative flex flex-col items-center justify-center border-2 border-dashed border-purple-400/60 bg-white dark:bg-zinc-800 hover:bg-purple-50/50 dark:hover:bg-purple-950/10 rounded-2xl p-6 text-center cursor-pointer transition-all group">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    disabled={isUploading || isConfirming}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />

                  {isUploading ? (
                    <div className="space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto" />
                      <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                        Загрузка файла чека в систему...
                      </p>
                    </div>
                  ) : order.receipt_url || uploadSuccess ? (
                    <div className="space-y-2 text-emerald-600 dark:text-emerald-400">
                      <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-400">
                        <Check className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-black uppercase tracking-wider">
                        Чек успешно прикреплен!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-purple-400 group-hover:text-purple-600 mx-auto transition-colors" />
                      <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
                        Нажмите, чтобы прикрепить чек оплаты
                      </p>
                      <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                        Принимаются только файлы в формате PDF
                      </p>
                    </div>
                  )}
                </label>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleConfirmPayment}
                  disabled={isUploading || isConfirming || isCancelling}
                  className="w-full sm:max-w-xs bg-purple-500 hover:bg-purple-600 disabled:bg-zinc-200 text-white font-bold py-4 rounded-full shadow-md transition-all text-sm cursor-pointer tracking-wide uppercase text-center inline-flex items-center justify-center gap-2"
                >
                  {isConfirming && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  Я оплатил, проверить транзакцию
                </button>
                <button
                  type="button"
                  onClick={handleCancelClick}
                  disabled={isUploading || isConfirming || isCancelling}
                  className="w-full sm:w-auto px-6 py-4 rounded-full border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {isCancelling && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  Отменить заявку
                </button>
              </div>
            </div>
          )}

          {(order.status === "pending" || order.status === "processing") && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleCancelClick}
                disabled={isCancelling}
                className="px-6 py-3 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isCancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                Отменить заявку
              </button>
            </div>
          )}

          {order.status === "completed" && (
            <div className="flex flex-col items-center text-center space-y-5 bg-emerald-500/15 dark:bg-emerald-500/10 border border-emerald-400/40 p-8 md:p-12 rounded-[24px] shadow-sm">
              <div className="w-14 h-14 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center shadow-sm border border-emerald-300">
                <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                  Обмен успешно завершен!
                </h3>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 max-w-lg leading-relaxed">
                  Средства были успешно отправлены на указанные вами реквизиты.
                  Спасибо, что выбрали Aurum Swap!
                </p>
              </div>
            </div>
          )}

          {order.status === "cancelled" && (
            <div className="flex flex-col items-center text-center space-y-5 bg-rose-500/15 dark:bg-rose-500/10 border border-rose-400/40 p-8 md:p-12 rounded-[24px] shadow-sm">
              <div className="w-14 h-14 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-full flex items-center justify-center shadow-sm border border-rose-300">
                <XCircle className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                  Заявка отменена
                </h3>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 max-w-lg leading-relaxed">
                  Обмен отменён. Если средства уже были отправлены или остались
                  вопросы — напишите в поддержку.
                </p>
              </div>
            </div>
          )}
        </div>

        {order.status === "paid" && (
          <div className="flex flex-col items-center text-center space-y-5 bg-indigo-500/15 dark:bg-indigo-500/10 border border-indigo-400/40 p-8 md:p-12 rounded-[24px] shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <h3 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
              Платёж проверяется
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md">
              Оператор проверяет ваш чек. Статус обновится автоматически.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
