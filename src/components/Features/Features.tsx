"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

const BANNER_ICONS = [
  {
    id: "usdt",
    src: "/icons/usdt.svg",
    label: "USDT",
    compact: false,
    delay: "0s",
    tilt: "12deg",
    tooltip: "top" as const,
    className:
      "left-0 top-[2%] z-10 h-14 w-14 sm:h-16 sm:w-16 lg:h-[4.5rem] lg:w-[4.5rem]",
  },
  {
    id: "btc",
    src: "/icons/btc.svg",
    label: "BTC",
    compact: false,
    delay: "0.2s",
    tilt: "-8deg",
    tooltip: "top" as const,
    className:
      "left-[24%] top-[8%] z-20 h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20 lg:h-24 lg:w-24",
  },
  {
    id: "eth",
    src: "/icons/eth.svg",
    label: "ETH",
    compact: false,
    delay: "0.45s",
    tilt: "6deg",
    tooltip: "top" as const,
    className:
      "right-0 top-[18%] z-[15] h-16 w-16 sm:h-[4.75rem] sm:w-[4.75rem] lg:h-[5.25rem] lg:w-[5.25rem]",
  },
  {
    id: "sbp",
    src: "/icons/sbp.svg",
    label: "СБП",
    compact: true,
    delay: "0.7s",
    tilt: "-6deg",
    tooltip: "bottom" as const,
    className:
      "bottom-[4%] left-[20%] z-10 h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16",
  },
  {
    id: "ton",
    src: "/icons/ton.svg",
    label: "TON",
    compact: false,
    delay: "0.95s",
    tilt: "14deg",
    tooltip: "bottom" as const,
    className:
      "left-[2%] top-[48%] z-[8] h-10 w-10 sm:h-12 sm:w-12 lg:h-[3.25rem] lg:w-[3.25rem]",
  },
  {
    id: "sol",
    src: "/icons/sol.svg",
    label: "SOL",
    compact: false,
    delay: "1.15s",
    tilt: "-12deg",
    tooltip: "bottom" as const,
    className:
      "bottom-[10%] right-[2%] z-[8] h-9 w-9 sm:h-11 sm:w-11 lg:h-12 lg:w-12",
  },
] as const;

function selectPair(id: (typeof BANNER_ICONS)[number]["id"]) {
  window.dispatchEvent(new CustomEvent("aurum:select-pair", { detail: { id } }));
  document.getElementById("exchange")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function BannerIcon({
  src,
  label,
  id,
  compact,
  delay,
  tilt,
  tooltip,
  className,
}: (typeof BANNER_ICONS)[number]) {
  return (
    <button
      type="button"
      onClick={() => selectPair(id)}
      aria-label={`Рассчитать обмен: ${label}`}
      className={`group absolute cursor-pointer hover:z-30 ${className}`}
    >
      <span
        className="banner-icon-float block h-full w-full"
        style={{ animationDelay: delay, ["--banner-tilt" as string]: tilt }}
      >
        <span className="flex h-full w-full items-center justify-center rounded-full bg-white shadow-[0_6px_18px_rgba(15,23,42,0.10)] transition-transform duration-200 group-hover:scale-110 group-hover:shadow-[0_10px_24px_rgba(15,23,42,0.16)] group-active:scale-95">
          <Image
            src={src}
            alt=""
            width={96}
            height={96}
            className={`object-contain ${compact ? "h-[56%] w-[56%]" : "h-[78%] w-[78%]"}`}
            unoptimized
          />
        </span>
      </span>
      <span
        className={`pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 ${
          tooltip === "top" ? "-top-6" : "-bottom-6"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export default function Features() {
  return (
    <section className="relative overflow-visible rounded-2xl bg-[#FFDD2D] px-5 py-6 shadow-[0_4px_24px_rgba(15,23,42,0.04)] sm:px-8 sm:py-8">
      <div className="relative flex items-center justify-between gap-3 sm:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-900/45">
              Demo Exchange
            </p>
            <h1 className="mt-1.5 text-2xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-[2rem]">
              Обмен криптовалюты за несколько минут
            </h1>
            <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-zinc-900/65">
              Рассчитайте сумму, оплатите по СБП — оператор проверит перевод и
              отправит выплату.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#exchange"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 text-sm font-bold text-white transition-colors hover:bg-zinc-800"
            >
              Рассчитать обмен
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/legal/verify-address"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white/70 px-5 text-sm font-semibold text-zinc-900 backdrop-blur-sm transition-colors hover:bg-white"
            >
              <ShieldCheck className="h-4 w-4 text-[#C9A227]" />
              Проверить адрес
            </Link>
          </div>
        </div>

        <div className="relative h-[10rem] w-[10.25rem] shrink-0 sm:h-[12rem] sm:w-[13rem] lg:h-[14rem] lg:w-[16rem]">
          {BANNER_ICONS.map((icon) => (
            <BannerIcon key={icon.id} {...icon} />
          ))}
        </div>
      </div>
    </section>
  );
}
