"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

type CbrStatus = "loading" | "online" | "offline";

export default function StaffCbrOfflineBadge() {
  const [status, setStatus] = useState<CbrStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/crypto-rates", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const header = res.headers.get("X-Cbr-Offline");
        const data = await res.json().catch(() => null);
        const usdt = Array.isArray(data)
          ? data.find(
              (row: { symbol?: string; cbr_offline?: boolean }) =>
                row.symbol === "USDTUSDT",
            )
          : null;
        const offline =
          header === "1" || Boolean(usdt?.cbr_offline);
        if (!cancelled) setStatus(offline ? "offline" : "online");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };

    void load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (status === "loading") {
    return (
      <span
        title="Проверяем связь с ЦБ РФ"
        className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-[10px] sm:text-[11px] font-bold text-zinc-500 shrink-0"
      >
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
        <span className="hidden min-[420px]:inline">ЦБ РФ…</span>
      </span>
    );
  }

  if (status === "offline") {
    return (
      <span
        title="Связь с ресурсами ЦБ РФ потеряна. Используется последний известный курс или значение, заданное админом."
        className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[10px] sm:text-[11px] font-bold text-rose-700 shrink-0"
      >
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
        <span className="hidden min-[420px]:inline whitespace-nowrap">
          ЦБ РФ нет связи
        </span>
      </span>
    );
  }

  return (
    <span
      title="Связь с ресурсами ЦБ РФ есть. Курс USDT берётся с официального сайта."
      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] sm:text-[11px] font-bold text-emerald-700 shrink-0"
    >
      <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
      <span className="hidden min-[420px]:inline whitespace-nowrap">
        ЦБ РФ на связи
      </span>
    </span>
  );
}
