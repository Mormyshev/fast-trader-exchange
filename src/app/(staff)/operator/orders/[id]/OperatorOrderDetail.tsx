"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  Upload,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeWithAuth } from "@/src/utils/supabase/realtime";
import { useAuth } from "@/src/app/context/AuthContext";
import { isRubPayout } from "@/src/utils/exchange-currencies";
import { OrderTtlBadge, useNowTick } from "@/src/components/OrderTtlBadge/OrderTtlBadge";
import StaffOperatorLabel from "@/src/components/StaffOperatorLabel/StaffOperatorLabel";
import StaffClientInfo from "@/src/components/StaffClientInfo/StaffClientInfo";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";
import { isOrderExpiredByTtl, ORDER_TTL_STATUSES } from "@/src/utils/orders/ttl";
import type { OrderClient } from "@/src/utils/orders/client-info";
import {
  serializePaymentDetails,
  validatePaymentRequisites,
} from "@/src/utils/orders/payment-details";
import PaymentRequisitesForm from "@/src/components/PaymentRequisites/PaymentRequisitesForm";
import PaymentRequisitesView from "@/src/components/PaymentRequisites/PaymentRequisitesView";

type OrderStatus =
  | "pending"
  | "processing"
  | "awaiting_payment"
  | "paid"
  | "completed"
  | "cancelled"
  | "failed";

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
  wallet_to: string;
  payment_details: string | null;
  receipt_url: string | null;
  operator_receipt_url: string | null;
  operator_pseudonym_snapshot?: string | null;
  client?: OrderClient | null;
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
      return "Оплачена клиентом";
    case "completed":
      return "Выполнена";
    case "cancelled":
      return "Отменена";
    case "failed":
      return "Ошибка";
  }
}

function statusClass(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "processing":
      return "bg-blue-50 text-blue-700 border-blue-100";
    case "awaiting_payment":
      return "bg-purple-50 text-purple-700 border-purple-100";
    case "paid":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "completed":
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
    case "cancelled":
    case "failed":
      return "bg-rose-50 text-rose-700 border-rose-100";
  }
}

export default function OperatorOrderDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { confirm, ConfirmDialogHost } = useConfirmDialog();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPayout, setUploadingPayout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expireRequestedRef = useRef(false);
  const now = useNowTick(
    !!order &&
      (ORDER_TTL_STATUSES as readonly string[]).includes(order?.status ?? ""),
  );

  useEffect(() => {
    if (!user?.id) {
      if (!isAuthLoading) setLoading(false);
      return;
    }

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function load() {
      try {
        const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Заявка не найдена");
        if (!cancelled) {
          setOrder(json.order);
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

    void (async () => {
      await load();
      if (cancelled) return;

      channel = supabase
        .channel(`operator-order-${orderId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `id=eq.${orderId}`,
          },
          (payload) => {
            setOrder((prev) => ({
              ...(payload.new as Order),
              client: prev?.client,
            }));
          },
        );

      await subscribeWithAuth(supabase, channel);
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [orderId, user?.id, isAuthLoading, supabase]);

  useEffect(() => {
    if (!order) return;
    if (!(ORDER_TTL_STATUSES as readonly string[]).includes(order.status)) {
      return;
    }
    if (!isOrderExpiredByTtl(order.created_at, now)) return;
    if (expireRequestedRef.current) return;
    expireRequestedRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!cancelled && json.order) setOrder(json.order);
      } catch {
        expireRequestedRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [order, now]);

  const handleClaim = async () => {
    if (!user?.id || !order) return;

    const ok = await confirm({
      title: "Взять заявку в работу?",
      description:
        "Заявка будет закреплена за вами. Клиент получит уведомление о начале обработки.",
      confirmLabel: "Взять в работу",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
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
        router.push("/operator/orders");
        return;
      }
      if (!res.ok) throw new Error(json.error || "Не удалось взять заявку");
      setOrder(json.order as Order);
    } catch (err: any) {
      alert(err.message || "Не удалось взять заявку");
    } finally {
      setSaving(false);
    }
  };

  const handleSendDetails = async () => {
    if (!order) return;
    const check = validatePaymentRequisites(card, phone);
    if (!check.ok) {
      alert(check.error);
      return;
    }

    const ok = await confirm({
      title: "Отправить реквизиты клиенту?",
      description: `Карта ${check.card}, телефон ${check.phone}. Клиент увидит эти реквизиты и сможет оплатить заявку.`,
      confirmLabel: "Отправить",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_details: serializePaymentDetails(check.card, check.phone),
          status: "awaiting_payment",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось отправить");
      setOrder(json.order);
      setCard("");
      setPhone("");
    } catch (err: any) {
      alert(err.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (status: "completed" | "cancelled") => {
    if (!order) return;

    if (
      status === "completed" &&
      isRubPayout(order.currency_to) &&
      !order.operator_receipt_url
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

    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось обновить");
      setOrder(json.order);
    } catch (err: any) {
      alert(err.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const handleOperatorReceiptUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!order) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Нужен файл PDF");
      e.target.value = "";
      return;
    }

    setUploadingPayout(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/orders/${order.id}/operator-receipt`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось загрузить чек");
      if (json.order) setOrder(json.order);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploadingPayout(false);
      e.target.value = "";
    }
  };

  if (isAuthLoading || loading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFDD2D]" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Link
          href="/operator/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="w-4 h-4" />К дашборду
        </Link>
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-sm font-medium text-rose-700">
          {error || "Заявка не найдена"}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 text-zinc-900 font-sans">
      <Link
        href="/operator/dashboard"
        className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />К дашборду оператора
      </Link>

      <div className="rounded-[24px] sm:rounded-[32px] border border-zinc-200 bg-white p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 shadow-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-zinc-100 pb-4 sm:pb-5">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">
              Заявка оператора
            </h1>
            <p className="text-[11px] sm:text-xs font-mono font-semibold text-zinc-400 mt-1 break-all">
              ID: {order.id}
            </p>
            <p className="text-[11px] sm:text-xs font-medium text-zinc-500 mt-1">
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
          <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 flex-wrap">
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border ${statusClass(order.status)}`}
            >
              {statusLabel(order.status)}
            </span>
            <StaffOperatorLabel snapshot={order.operator_pseudonym_snapshot} />
            <OrderTtlBadge
              createdAt={order.created_at}
              status={order.status}
              now={now}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Обмен
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
              <span>
                {Number(order.amount_from || 0).toLocaleString("ru-RU")}{" "}
                {order.currency_from}
              </span>
              <ArrowRightLeft className="w-4 h-4 text-zinc-300" />
              <span>
                {Number(order.amount_to || 0).toLocaleString("ru-RU", {
                  maximumFractionDigits: 8,
                })}{" "}
                {order.currency_to.replace(/_/g, " ")}
              </span>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-zinc-400 mb-1">
                Кошелёк клиента
              </p>
              <p className="font-mono text-xs font-bold break-all bg-white border border-zinc-200 rounded-xl px-3 py-2">
                {order.wallet_to}
              </p>
            </div>
          </div>

          <StaffClientInfo client={order.client} />

          <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Реквизиты для клиента
            </p>
            <PaymentRequisitesView value={order.payment_details} />
            {order.receipt_url && (
              <a
                href={order.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-xs font-bold text-emerald-600 hover:underline"
              >
                Открыть чек клиента (PDF)
              </a>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            Управление заявкой
          </h2>

          {order.status === "pending" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600 font-medium">
                Заявка ещё в общей очереди. Возьмите её в работу, чтобы выдать
                реквизиты.
              </p>
              <Button
                disabled={saving}
                onClick={handleClaim}
                className="rounded-full h-11 px-6 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none"
              >
                {saving ? "..." : "Взять в работу"}
              </Button>
            </div>
          )}

          {order.status === "processing" && (
            <div className="space-y-3 max-w-xl">
              <label className="block text-xs font-bold text-zinc-500 uppercase">
                Реквизиты для оплаты клиенту
              </label>
              <PaymentRequisitesForm
                card={card}
                phone={phone}
                onCardChange={setCard}
                onPhoneChange={setPhone}
              />
              <Button
                disabled={saving}
                onClick={handleSendDetails}
                className="rounded-full h-11 px-6 font-bold bg-zinc-900 hover:bg-zinc-800 text-white shadow-none"
              >
                {saving ? "..." : "Отправить реквизиты клиенту"}
              </Button>
            </div>
          )}

          {order.status === "awaiting_payment" && (
            <div className="p-5 bg-purple-50 rounded-2xl border border-purple-200 space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600" />
                <p className="text-sm font-bold text-purple-700">
                  Реквизиты отправлены клиенту
                </p>
              </div>
              <p className="text-xs text-zinc-500 font-medium">
                Ожидаем оплату и загрузку чека. Страница обновляется
                автоматически.
              </p>
              <Link
                href="/operator/orders"
                className="inline-flex text-xs font-bold text-zinc-600 hover:text-zinc-900 underline-offset-2 hover:underline"
              >
                К списку активных ордеров
              </Link>
            </div>
          )}

          {order.status === "paid" && (
            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-4 max-w-xl">
              <div>
                <p className="text-sm font-bold text-emerald-700 uppercase tracking-wider">
                  Клиент оплатил — проверьте чек
                </p>
                {order.receipt_url ? (
                  <a
                    href={order.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs font-bold text-blue-600 hover:underline"
                  >
                    Открыть PDF чек клиента
                  </a>
                ) : (
                  <p className="text-xs text-zinc-500 mt-2">
                    Файл чека клиента не найден
                  </p>
                )}
              </div>

              {isRubPayout(order.currency_to) && (
                <div className="space-y-2 border-t border-emerald-200 pt-4">
                  <p className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Чек выплаты RUB клиенту (обязательно)
                  </p>
                  {order.operator_receipt_url ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                        <Check className="w-3.5 h-3.5" />
                        Чек выплаты прикреплён
                      </span>
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
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-emerald-300 bg-white hover:bg-emerald-50/50 rounded-2xl p-5 text-center cursor-pointer transition-all">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleOperatorReceiptUpload}
                        disabled={uploadingPayout || saving}
                        className="sr-only"
                      />
                      {uploadingPayout ? (
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-emerald-600 mb-2" />
                          <span className="text-xs font-bold text-zinc-700">
                            Прикрепить PDF-чек перевода рублей
                          </span>
                        </>
                      )}
                    </label>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  disabled={
                    saving ||
                    uploadingPayout ||
                    (isRubPayout(order.currency_to) &&
                      !order.operator_receipt_url)
                  }
                  onClick={() => handleComplete("completed")}
                  className="rounded-xl h-10 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none disabled:opacity-50"
                >
                  Успешно
                </Button>
                <Button
                  disabled={saving || uploadingPayout}
                  onClick={() => handleComplete("cancelled")}
                  className="rounded-xl h-10 font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-none"
                >
                  Отклонить
                </Button>
              </div>
            </div>
          )}

          {(order.status === "completed" || order.status === "cancelled") && (
            <div className="p-5 rounded-2xl border border-zinc-200 bg-zinc-50 text-sm font-medium text-zinc-600">
              Заявка закрыта со статусом «{statusLabel(order.status)}».
            </div>
          )}
        </div>
      </div>
      <ConfirmDialogHost />
    </div>
  );
}
