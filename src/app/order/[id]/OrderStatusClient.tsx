"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/src/utils/supabase/client";
import { startPolling, subscribeWithAuth } from "@/src/utils/supabase/realtime";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Check,
  ArrowLeft,
  FileText,
} from "lucide-react";
import {
  isOrderExpiredByTtl,
  ORDER_TTL_STATUSES,
} from "@/src/utils/orders/ttl";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";
import PaymentRequisitesView from "@/src/components/PaymentRequisites/PaymentRequisitesView";
import {
  clientPaysWithCrypto,
  parsePaymentDetails,
} from "@/src/utils/orders/payment-details";
import OrderExchangePair from "@/src/components/staff/OrderExchangePair";
import { useNowTick } from "@/src/components/OrderTtlBadge/OrderTtlBadge";
import RateFixationBar from "@/src/components/OrderTtlBadge/RateFixationBar";
import OrderProgressStepper from "@/src/components/OrderProgress/OrderProgressStepper";
import OrderNumberTitle from "@/src/components/OrderNumberTitle/OrderNumberTitle";
import {
  orderStatusBadgeClass,
  orderStatusBannerClass,
} from "@/src/utils/orders/status-style";
import { Button } from "@/components/ui/button";

type OrderStatus =
  | "pending"
  | "processing"
  | "awaiting_payment"
  | "paid"
  | "completed"
  | "cancelled"
  | "failed";

function statusLabel(status: string) {
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
    default:
      return status;
  }
}

interface OrderStatusClientProps {
  initialOrder: any;
}

export default function OrderStatusClient({
  initialOrder,
}: OrderStatusClientProps) {
  const [order, setOrder] = useState<any>(initialOrder);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(
    Boolean(initialOrder?.receipt_url),
  );
  const cancelInFlight = useRef(false);
  const { confirm, ConfirmDialogHost } = useConfirmDialog();
  const now = useNowTick(
    (ORDER_TTL_STATUSES as readonly string[]).includes(order.status),
  );

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

    const stopPoll = startPolling(() => void refreshOrder(), 4000);

    return () => {
      cancelled = true;
      stopPoll();
      if (channel) client.removeChannel(channel);
    };
  }, [order.id]);

  useEffect(() => {
    if (!(ORDER_TTL_STATUSES as readonly string[]).includes(order.status)) {
      return;
    }

    const tick = () => {
      if (isOrderExpiredByTtl(order.created_at)) {
        void cancelOrder("timeout");
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cancel only when timer hits zero
  }, [order.status, order.created_at, order.id]);

  const handleCancelClick = async () => {
    const ok = await confirm({
      title: "Отменить заявку?",
      description: "Это действие нельзя будет отменить.",
      confirmLabel: "Отменить заявку",
      variant: "destructive",
    });
    if (!ok) return;
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

    const ok = await confirm({
      title: "Подтвердить оплату?",
      description:
        "Заявка будет отправлена оператору на проверку чека. Убедитесь, что перевод уже выполнен.",
      confirmLabel: "Да, я оплатил",
    });
    if (!ok) return;

    setIsConfirming(true);
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
    } catch (err: any) {
      console.error("Ошибка смены статуса:", err);
      alert(`Не удалось отправить уведомление: ${err.message}`);
    } finally {
      setIsConfirming(false);
    }
  };

  const payInIsCrypto =
    parsePaymentDetails(order.payment_details).kind === "crypto";
  const receiptReady = Boolean(order.receipt_url || uploadSuccess);
  const status = order.status as OrderStatus;

  return (
    <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4 text-zinc-900 dark:text-zinc-50 font-sans">
      <Link
        href="/user/orders"
        className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />К моим заявкам
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <OrderNumberTitle order={order} />
        <span
          className={`inline-flex self-start items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${orderStatusBadgeClass(status, true)}`}
        >
          {statusLabel(status)}
        </span>
      </div>

      <RateFixationBar
        createdAt={order.created_at}
        status={status}
        now={now}
      />
      <OrderProgressStepper status={status} />

      <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)] dark:bg-zinc-900">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 space-y-5 sm:space-y-6">
          <p className="text-[11px] sm:text-xs font-medium text-zinc-500">
            {new Date(order.created_at).toLocaleString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>

          <div className="rounded-2xl bg-[#FFF8D6] px-3.5 sm:px-5 py-4">
            <OrderExchangePair
              amountFrom={order.amount_from}
              amountTo={order.amount_to}
              currencyFrom={order.currency_from}
              currencyTo={order.currency_to}
              fromCaption="Отдаёте"
              toCaption="Получаете"
            />
          </div>

          <div className="rounded-2xl bg-zinc-100 border border-zinc-200 p-4 space-y-2 dark:bg-zinc-800/70 dark:border-zinc-700">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {clientPaysWithCrypto(order.currency_from)
                ? "Куда зачислим"
                : "Ваш кошелёк для получения"}
            </p>
            <p className="font-mono text-xs font-semibold break-all leading-relaxed">
              {order.wallet_to}
            </p>
          </div>

          {status === "pending" && (
            <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50 space-y-3 dark:bg-amber-500/10 dark:border-amber-400/30">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Ожидаем реквизиты от оператора
                </p>
              </div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                Заявка в очереди. Первый свободный оператор отправит реквизиты
                для оплаты — обычно это занимает не больше 5 минут.
              </p>
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Страница обновляется автоматически
              </div>
            </div>
          )}

          {status === "processing" && (
            <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50 space-y-3 dark:bg-blue-500/10 dark:border-blue-400/30">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <p className="text-sm font-bold text-blue-900 dark:text-blue-200">
                  Заявка принята оператором
                </p>
              </div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                Оператор готовит реквизиты. Они появятся на этой странице в
                течение 1–2 минут.
              </p>
            </div>
          )}

          {status === "awaiting_payment" && (
            <div className="p-5 rounded-2xl border border-violet-200 bg-violet-50 space-y-4 dark:bg-violet-500/10 dark:border-violet-400/30">
              <div>
                <p className="text-sm font-bold text-violet-900 dark:text-violet-200">
                  {payInIsCrypto
                    ? "Отправьте крипту на указанный адрес"
                    : "Оплатите заявку через СБП"}
                </p>
                <p className="text-xs font-medium text-zinc-500 mt-1">
                  {payInIsCrypto
                    ? "Переведите точную сумму на адрес кошелька мерчанта."
                    : "Переведите точную сумму на указанный номер телефона в выбранный банк."}
                </p>
              </div>

              <div className="rounded-2xl bg-white border border-violet-200 p-4 space-y-2 dark:bg-zinc-900 dark:border-violet-400/30">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {payInIsCrypto ? "Реквизиты для оплаты" : "Реквизиты СБП"}
                </p>
                <PaymentRequisitesView value={order.payment_details} />
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Чек об оплате (PDF)
                </p>
                <label className="relative flex flex-col items-center justify-center border-2 border-dashed border-violet-300 bg-white hover:bg-violet-50/60 rounded-2xl p-5 text-center cursor-pointer transition-all dark:bg-zinc-900 dark:border-violet-400/40 dark:hover:bg-violet-950/20">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    disabled={isUploading || isConfirming}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {isUploading ? (
                    <div className="space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin text-violet-600 mx-auto" />
                      <p className="text-xs font-semibold text-zinc-600">
                        Загрузка чека...
                      </p>
                    </div>
                  ) : receiptReady ? (
                    <div className="space-y-1.5 text-emerald-700 dark:text-emerald-400">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 mx-auto">
                        <Check className="w-4 h-4" />
                      </span>
                      <p className="text-xs font-bold">Чек прикреплён</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Upload className="w-6 h-6 text-violet-500 mx-auto" />
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                        Нажмите, чтобы прикрепить PDF-чек
                      </p>
                    </div>
                  )}
                </label>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => void handleConfirmPayment()}
                  disabled={isUploading || isConfirming || isCancelling}
                  className="rounded-full h-11 px-6 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none"
                >
                  {isConfirming && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  Я оплатил
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleCancelClick()}
                  disabled={isUploading || isConfirming || isCancelling}
                  className="rounded-full h-11 px-6 font-bold border-rose-200 text-rose-700 hover:bg-rose-50"
                >
                  {isCancelling && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  Отменить заявку
                </Button>
              </div>
            </div>
          )}

          {status === "paid" && (
            <div className="p-5 rounded-2xl border border-teal-200 bg-teal-50 space-y-3 dark:bg-teal-500/10 dark:border-teal-400/30">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                <p className="text-sm font-bold text-teal-900 dark:text-teal-200">
                  Платёж проверяется
                </p>
              </div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                Оператор проверяет ваш чек. Статус обновится автоматически.
              </p>
              {order.operator_receipt_url && (
                <a
                  href={`/api/orders/${order.id}/operator-receipt`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Подтверждение перевода (PDF)
                </a>
              )}
            </div>
          )}

          {status === "completed" && (
            <div
              className={`p-5 rounded-2xl border space-y-3 ${orderStatusBannerClass("completed")}`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <p className="text-sm font-bold">Обмен успешно завершён</p>
              </div>
              <p className="text-sm font-medium">
                Средства отправлены на указанные вами реквизиты.
              </p>
              {order.operator_receipt_url && (
                <a
                  href={`/api/orders/${order.id}/operator-receipt`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Скачать подтверждение перевода (PDF)
                </a>
              )}
            </div>
          )}

          {(status === "cancelled" || status === "failed") && (
            <div
              className={`p-5 rounded-2xl border space-y-2 ${orderStatusBannerClass("cancelled")}`}
            >
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-700" />
                <p className="text-sm font-bold">Заявка отменена</p>
              </div>
              <p className="text-sm font-medium">
                Если средства уже были отправлены или остались вопросы —
                напишите в поддержку.
              </p>
            </div>
          )}

          {(status === "pending" || status === "processing") && (
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleCancelClick()}
                disabled={isCancelling}
                className="rounded-full h-11 px-6 font-bold border-rose-200 text-rose-700 hover:bg-rose-50"
              >
                {isCancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                Отменить заявку
              </Button>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialogHost />
    </div>
  );
}
