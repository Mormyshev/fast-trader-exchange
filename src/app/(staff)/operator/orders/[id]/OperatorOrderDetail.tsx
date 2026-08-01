"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/src/utils/supabase/client";
import { useAuth } from "@/src/app/context/AuthContext";

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

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

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

    void load();

    const channel = supabase
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
          setOrder(payload.new as Order);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [orderId, user?.id, isAuthLoading, supabase]);

  const handleClaim = async () => {
    if (!user?.id || !order) return;
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
    if (!details.trim()) {
      alert("Введите реквизиты для оплаты!");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_details: details.trim(),
          status: "awaiting_payment",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось отправить");
      setOrder(json.order);
      setDetails("");
    } catch (err: any) {
      alert(err.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (status: "completed" | "cancelled") => {
    if (!order) return;
    const ok = confirm(
      status === "completed"
        ? "Подтвердить получение и закрыть заявку как успешную?"
        : "Отклонить заявку?",
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
    <div className="max-w-4xl mx-auto space-y-6 text-zinc-900 font-sans">
      <Link
        href="/operator/dashboard"
        className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />К дашборду оператора
      </Link>

      <div className="rounded-[32px] border border-zinc-200 bg-white p-6 md:p-8 space-y-6 shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-zinc-100 pb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Заявка оператора
            </h1>
            <p className="text-xs font-mono font-semibold text-zinc-400 mt-1 break-all">
              ID: {order.id}
            </p>
            <p className="text-xs font-medium text-zinc-400 mt-1">
              Создана: {new Date(order.created_at).toLocaleString("ru-RU")}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border ${statusClass(order.status)}`}
          >
            {statusLabel(order.status)}
          </span>
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

          <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Реквизиты для клиента
            </p>
            <p className="font-mono text-xs font-bold break-all bg-white border border-zinc-200 rounded-xl px-3 py-2 min-h-12">
              {order.payment_details || "Ещё не выданы"}
            </p>
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
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Например: Сбербанк 2202..."
                className="w-full h-28 p-3 text-sm bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-hidden focus:border-[#FFDD2D] text-zinc-900 resize-none"
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
                    Открыть PDF чек
                  </a>
                ) : (
                  <p className="text-xs text-zinc-500 mt-2">
                    Файл чека не найден
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  disabled={saving}
                  onClick={() => handleComplete("completed")}
                  className="rounded-xl h-10 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none"
                >
                  Успешно
                </Button>
                <Button
                  disabled={saving}
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
    </div>
  );
}
