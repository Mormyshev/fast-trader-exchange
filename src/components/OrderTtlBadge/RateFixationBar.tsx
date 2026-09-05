"use client";

import { useEffect, useState } from "react";
import {
  formatOrderTimeLeft,
  isOrderExpiredByTtl,
  ORDER_TTL_MS,
  orderExpiresAt,
  orderRemainingMs,
  orderTtlProgress,
} from "@/src/utils/orders/ttl";
import { hasOrderTtl } from "@/src/components/OrderTtlBadge/OrderTtlBadge";

type Tone = "normal" | "warning" | "danger";

function timerTone(remainingMs: number, expired: boolean): Tone {
  if (expired || remainingMs <= 60_000) return "danger";
  if (remainingMs <= 3 * 60_000) return "warning";
  return "normal";
}

const TONE_RING: Record<Tone, { track: string; progress: string; glow: string }> =
  {
    normal: {
      track: "stroke-zinc-200",
      progress: "stroke-[#FFDD2D]",
      glow: "drop-shadow-[0_0_10px_rgba(255,221,45,0.35)]",
    },
    warning: {
      track: "stroke-orange-100",
      progress: "stroke-orange-500",
      glow: "drop-shadow-[0_0_10px_rgba(249,115,22,0.28)]",
    },
    danger: {
      track: "stroke-rose-100",
      progress: "stroke-rose-500",
      glow: "drop-shadow-[0_0_10px_rgba(244,63,94,0.28)]",
    },
  };

const TONE_TEXT: Record<Tone, string> = {
  normal: "text-zinc-900",
  warning: "text-orange-600",
  danger: "text-rose-600",
};

function formatDeadline(createdAt: string) {
  return new Date(orderExpiresAt(createdAt)).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timerCopy(status: string, expired: boolean) {
  if (expired) {
    return {
      title: "Время сделки истекло",
      hint: "Заявка будет отменена автоматически.",
    };
  }
  if (status === "awaiting_payment") {
    return {
      title: "Время на оплату",
      hint: "Переведите точную сумму до конца таймера — иначе заявка отменится.",
    };
  }
  return {
    title: "Время на сделку",
    hint: "Курс зафиксирован. Завершите обмен до конца таймера, иначе заявка отменится.",
  };
}

function CountdownRing({
  progress,
  size,
  stroke,
  tone,
  expired,
}: {
  progress: number;
  size: number;
  stroke: number;
  tone: Tone;
  expired: boolean;
}) {
  const colors = TONE_RING[tone];
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  const pulse = tone === "danger" && !expired;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={`-rotate-90 ${colors.glow} ${pulse ? "animate-pulse" : ""}`}
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className={colors.track}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className={`${colors.progress} transition-[stroke-dashoffset] duration-100 ease-linear`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function SplitClock({
  time,
  now,
  className,
}: {
  time: string;
  now: number;
  className: string;
}) {
  const blink = Math.floor(now / 500) % 2 === 0;
  const parts = time.split(":");
  return (
    <span className={`inline-flex items-baseline font-mono font-black tabular-nums tracking-tight ${className}`}>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-baseline">
          {index > 0 ? (
            <span className={`px-0.5 ${blink ? "opacity-100" : "opacity-25"}`}>
              :
            </span>
          ) : null}
          {part}
        </span>
      ))}
    </span>
  );
}

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
  const active = hasOrderTtl(status);
  const [smoothNow, setSmoothNow] = useState(now);

  useEffect(() => {
    if (!active) return;
    setSmoothNow(Date.now());
    const id = window.setInterval(() => setSmoothNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [active, createdAt, status]);

  if (!active) return null;

  const clock = Math.max(now, smoothNow);
  const remainingMs = orderRemainingMs(createdAt, clock);
  const expired = isOrderExpiredByTtl(createdAt, clock);
  const progress = orderTtlProgress(createdAt, clock);
  const left = formatOrderTimeLeft(createdAt, clock);
  const tone = timerTone(remainingMs, expired);
  const copy = timerCopy(status, expired);
  const deadline = formatDeadline(createdAt);
  const elapsedLabel = `${Math.ceil((ORDER_TTL_MS - remainingMs) / 1000)} / ${Math.ceil(ORDER_TTL_MS / 1000)} с`;

  if (embedded) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-[#F4F5F7] px-3.5 py-3">
        <div className="relative shrink-0">
          <CountdownRing
            progress={progress}
            size={72}
            stroke={5}
            tone={tone}
            expired={expired}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <SplitClock
              time={left}
              now={clock}
              className={`text-[13px] leading-none ${TONE_TEXT[tone]}`}
            />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-zinc-500">{copy.title}</p>
          <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-zinc-400">
            до {deadline}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white px-4 py-4 shadow-[0_4px_24px_rgba(15,23,42,0.04)] sm:px-5 sm:py-5">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-sm font-bold text-zinc-900">{copy.title}</p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-zinc-500">
            {copy.hint}
          </p>
          <p className="mt-2 text-xs font-semibold tabular-nums text-zinc-400">
            Дедлайн {deadline}
          </p>
        </div>

        <div className="relative shrink-0">
          <CountdownRing
            progress={progress}
            size={112}
            stroke={7}
            tone={tone}
            expired={expired}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <SplitClock
              time={left}
              now={clock}
              className={`text-[1.65rem] leading-none ${TONE_TEXT[tone]}`}
            />
            <span
              className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${
                tone === "danger" ? "text-rose-500" : "text-zinc-400"
              }`}
            >
              {expired ? "истекло" : "осталось"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
            tone === "danger"
              ? "bg-rose-500"
              : tone === "warning"
                ? "bg-orange-500"
                : "bg-[#FFDD2D]"
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <p className="sr-only">{elapsedLabel}</p>
    </div>
  );
}
