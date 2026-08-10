"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import {
  formatOrderTimeLeft,
  isOrderExpiredByTtl,
  orderExpiresAt,
  ORDER_TTL_STATUSES,
} from "@/src/utils/orders/ttl";

type Props = {
  createdAt: string;
  status: string;
  /** Shared clock tick from parent (ms). If omitted, ticks locally. */
  now?: number;
  className?: string;
  compact?: boolean;
};

export function hasOrderTtl(status: string): boolean {
  return (ORDER_TTL_STATUSES as readonly string[]).includes(status);
}

export function OrderTtlBadge({
  createdAt,
  status,
  now: nowProp,
  className = "",
  compact = false,
}: Props) {
  const [localNow, setLocalNow] = useState(() => Date.now());
  const active = hasOrderTtl(status);

  useEffect(() => {
    if (!active || nowProp != null) return;
    const id = setInterval(() => setLocalNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, nowProp]);

  if (!active) return null;

  const now = nowProp ?? localNow;
  const left = formatOrderTimeLeft(createdAt, now);
  const expired = isOrderExpiredByTtl(createdAt, now);
  const urgent = !expired && orderExpiresAt(createdAt) - now < 60_000;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-black tracking-wide rounded-full border ${
        expired || urgent
          ? "bg-rose-50 text-rose-700 border-rose-200"
          : "bg-zinc-900 text-white border-zinc-900"
      } ${compact ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"} ${className}`}
      title="До автоотмены заявки"
    >
      <Clock className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {compact ? left : `Осталось ${left}`}
    </span>
  );
}

/** Single shared second-ticker for list pages. */
export function useNowTick(enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}
