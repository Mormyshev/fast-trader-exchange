"use client";

import { Info } from "lucide-react";
import {
  formatOrderTimeLeft,
  orderTtlProgress,
} from "@/src/utils/orders/ttl";
import { hasOrderTtl } from "@/src/components/OrderTtlBadge/OrderTtlBadge";

export default function RateFixationBar({
  createdAt,
  status,
  now,
  embedded = false,
}: {
  createdAt: string;
  status: string;
  now: number;
  embedded?: boolean;
}) {
  if (!hasOrderTtl(status)) return null;

  const left = formatOrderTimeLeft(createdAt, now);
  const progress = orderTtlProgress(createdAt, now);
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div
      className={
        embedded
          ? "flex items-center justify-between gap-3 rounded-2xl bg-[#F4F5F7] px-3.5 py-3"
          : "flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[0_4px_24px_rgba(15,23,42,0.04)]"
      }
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <p className="text-sm font-semibold text-zinc-800">
          Период фиксации курса
        </p>
        <span
          className="flex h-4 w-4 items-center justify-center rounded-full bg-[#FFF4C2] text-[#C9A227] shrink-0"
          title="Курс зафиксирован на это время. Если не оплатить заявку до конца таймера, она будет отменена."
        >
          <Info className="h-3 w-3" />
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-mono text-base font-black tabular-nums text-zinc-900">
          {left}
        </span>
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 -rotate-90"
          aria-hidden
        >
          <circle
            cx="12"
            cy="12"
            r={radius}
            fill="none"
            className="stroke-zinc-200"
            strokeWidth="2.5"
          />
          <circle
            cx="12"
            cy="12"
            r={radius}
            fill="none"
            className="stroke-[#FFDD2D]"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
      </div>
    </div>
  );
}
