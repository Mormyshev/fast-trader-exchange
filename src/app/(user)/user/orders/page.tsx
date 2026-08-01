"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  Clock,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/src/app/context/AuthContext";

type OrderStatus =
  | "pending"
  | "processing"
  | "awaiting_payment"
  | "paid"
  | "completed"
  | "cancelled"
  | "failed";

type TabId = "active" | "all";

interface Order {
  id: string;
  created_at: string;
  status: OrderStatus;
  currency_from: string;
  currency_to: string;
  amount_from: number;
  amount_to: number;
  wallet_to: string;
}

function statusLabel(status: OrderStatus) {
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
      return "bg-indigo-100 text-indigo-800";
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "cancelled":
    case "failed":
      return "bg-rose-100 text-rose-800";
  }
}

function formatCurrency(value: number, currency: string) {
  const num = Number(value || 0);
  const formatted = Number.isInteger(num)
    ? num.toLocaleString("ru-RU")
    : num.toLocaleString("ru-RU", { maximumFractionDigits: 8 });
  return `${formatted} ${currency.replace(/_/g, " ")}`;
}

export default function UserOrdersPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("active");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadOrders() {
      try {
        const res = await fetch(`/api/orders/mine?scope=${activeTab}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Не удалось загрузить заявки");
        }
        if (!cancelled) {
          setOrders(json.orders || []);
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

    setLoading(true);
    loadOrders();
    const interval = setInterval(loadOrders, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.id, isAuthLoading, activeTab]);

  if (isAuthLoading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFDD2D]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 text-zinc-900 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2A2A2A]">
            Мои заявки
          </h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">
            История обменов и заявки в работе
          </p>
        </div>
        <Button
          asChild
          className="rounded-full h-10 px-6 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none self-start sm:self-auto"
        >
          <Link href="/user/exchange">Создать обмен</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 bg-zinc-100/70 p-1 rounded-2xl self-start w-fit">
        {(
          [
            { id: "active", label: "Активные" },
            { id: "all", label: "Все заявки" },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className={`text-xs font-bold rounded-xl h-8 px-4 transition-all cursor-pointer ${
              activeTab === tab.id
                ? "bg-white text-zinc-900 shadow-xs hover:bg-white"
                : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#FFDD2D]" />
        </div>
      ) : orders.length === 0 ? (
        <Card className="rounded-[32px] border border-dashed border-zinc-200 bg-white shadow-none p-10 md:p-14 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400">
            <ClipboardList className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-zinc-900">
              {activeTab === "active"
                ? "Нет активных заявок"
                : "Заявок пока нет"}
            </h2>
            <p className="text-sm text-zinc-500 font-medium max-w-md mx-auto">
              {activeTab === "active"
                ? "Когда вы создадите обмен, он появится здесь. Вы сможете открыть его снова в любой момент."
                : "Создайте первый обмен — история заявок будет отображаться в этом разделе."}
            </p>
          </div>
          <Button
            asChild
            className="rounded-full h-10 px-6 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none"
          >
            <Link href="/user/exchange">Перейти к обмену</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isActive = [
              "pending",
              "processing",
              "awaiting_payment",
              "paid",
            ].includes(order.status);

            return (
              <Card
                key={order.id}
                className="rounded-[28px] border border-zinc-200 bg-white shadow-none p-5 md:p-6"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-5">
                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {new Date(order.created_at).toLocaleString("ru-RU")}
                        </span>
                        <span className="font-mono text-zinc-500">
                          #{order.id.slice(0, 8)}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${statusClass(order.status)}`}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-900">
                      <span>
                        {formatCurrency(order.amount_from, order.currency_from)}
                      </span>
                      <ArrowRightLeft className="w-4 h-4 text-zinc-300 shrink-0" />
                      <span>
                        {formatCurrency(order.amount_to, order.currency_to)}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-zinc-400 truncate">
                      Кошелёк:{" "}
                      <span className="font-mono text-zinc-600">
                        {order.wallet_to}
                      </span>
                    </p>
                  </div>

                  <Button
                    asChild
                    className={`rounded-full h-11 px-6 font-bold shadow-none shrink-0 w-full md:w-auto ${
                      isActive
                        ? "bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900"
                        : "bg-zinc-100 hover:bg-zinc-200 text-zinc-800"
                    }`}
                  >
                    <Link href={`/order/${order.id}`}>
                      {isActive ? "Открыть заявку" : "Подробнее"}
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
