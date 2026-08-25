"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";
import { useAuth } from "@/src/app/context/AuthContext";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";
import {
  formatOpenOrdersCount,
  STAFF_HAS_OPEN_ORDERS_ERROR,
} from "@/src/utils/staff/duty";

export default function StaffDutyToggle({
  variant = "card",
}: {
  variant?: "card" | "compact";
}) {
  const router = useRouter();
  const { staffActive, setStaffActive } = useAuth();
  const { confirm, ConfirmDialogHost } = useConfirmDialog();
  const [pending, setPending] = useState(false);
  const [openOrdersCount, setOpenOrdersCount] = useState(0);

  const refreshOpenOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/duty", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) return;
      if (typeof json.open_orders_count === "number") {
        setOpenOrdersCount(json.open_orders_count);
      }
      if (typeof json.staff_active === "boolean") {
        setStaffActive(json.staff_active);
      }
    } catch {
      // ignore
    }
  }, [setStaffActive]);

  useEffect(() => {
    void refreshOpenOrders();
    const timer = window.setInterval(() => void refreshOpenOrders(), 15000);
    return () => window.clearInterval(timer);
  }, [refreshOpenOrders]);

  const apply = async (next: boolean) => {
    setPending(true);
    try {
      const res = await fetch("/api/operator/duty", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_active: next }),
      });
      const json = await res.json();
      if (typeof json.open_orders_count === "number") {
        setOpenOrdersCount(json.open_orders_count);
      }
      if (!res.ok) throw new Error(json.error || "Не удалось сменить статус");
      setStaffActive(Boolean(json.staff_active));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось сменить статус");
    } finally {
      setPending(false);
    }
  };

  const handleToggle = async () => {
    if (pending) return;
    const next = !staffActive;
    if (!next) {
      if (openOrdersCount > 0) {
        const goToOrders = await confirm({
          title: "Сначала закройте заявки",
          description: `У вас ${formatOpenOrdersCount(openOrdersCount)} в работе. Завершите их или попросите администратора сменить оператора.`,
          confirmLabel: "К заявкам",
          cancelLabel: "Закрыть",
        });
        if (goToOrders) router.push("/operator/orders");
        return;
      }
      const ok = await confirm({
        title: "Выключить активный режим?",
        description:
          "Вы не сможете брать заявки, чаты и выполнять рабочие действия, пока режим выключен.",
        confirmLabel: "Выключить",
        variant: "destructive",
      });
      if (!ok) return;
    }
    await apply(next);
  };

  const switchControl = (
    <button
      type="button"
      role="switch"
      aria-checked={staffActive}
      aria-label={staffActive ? "Активный режим включён" : "Активный режим выключен"}
      disabled={pending}
      title={
        staffActive && openOrdersCount > 0
          ? STAFF_HAS_OPEN_ORDERS_ERROR
          : undefined
      }
      onClick={() => void handleToggle()}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
        staffActive ? "bg-emerald-500" : "bg-zinc-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow-sm transition-transform ${
          staffActive ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );

  if (variant === "compact") {
    return (
      <>
        <div className="flex items-center gap-2">
          <span
            className={`hidden sm:inline text-[10px] font-bold uppercase tracking-wide ${
              staffActive ? "text-emerald-600" : "text-zinc-400"
            }`}
          >
            {staffActive ? "Активный" : "Неактивный"}
          </span>
          {switchControl}
        </div>
        <ConfirmDialogHost />
      </>
    );
  }

  return (
    <>
      <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)] flex flex-col sm:flex-row sm:items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            staffActive
              ? "bg-emerald-50 text-emerald-600"
              : "bg-[#FFF4C2] text-[#C9A227]"
          }`}
        >
          <Power className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-zinc-900">Режим работы</p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-zinc-500">
            {staffActive && openOrdersCount > 0
              ? `У вас ${formatOpenOrdersCount(openOrdersCount)} в работе. Сначала завершите их или попросите администратора сменить оператора.`
              : staffActive
                ? "Вы активны: можно брать заявки, чаты и выполнять рабочие действия."
                : "Вы неактивны. Заявки, чаты, проверки и остальные рабочие действия недоступны."}
          </p>
          {staffActive && openOrdersCount > 0 ? (
            <Link
              href="/operator/orders"
              className="mt-2 inline-flex text-sm font-bold text-[#C9A227] hover:underline"
            >
              К заявкам в работе
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-3 self-start sm:self-center">
          <span
            className={`text-sm font-bold ${
              staffActive ? "text-emerald-700" : "text-zinc-400"
            }`}
          >
            {staffActive ? "Активный" : "Неактивный"}
          </span>
          {switchControl}
        </div>
      </div>
      <ConfirmDialogHost />
    </>
  );
}
