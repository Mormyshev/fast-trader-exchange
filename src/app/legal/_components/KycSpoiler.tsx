"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function KycSpoiler({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="kyc-spoiler border-b border-zinc-200 dark:border-zinc-800 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-open={open}
        className={`kyc-spoiler-title group w-full flex items-center justify-between gap-4 px-5 md:px-6 py-4 md:py-5 text-left text-sm md:text-base font-bold text-zinc-900 dark:text-zinc-100 transition-colors ${
          open
            ? "bg-[#FFF3B0] dark:bg-amber-500/20"
            : "bg-[#FFFEEB] dark:bg-amber-950/15 hover:bg-[#FFF3B0] dark:hover:bg-amber-500/20"
        }`}
      >
        <span>{title}</span>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
            open
              ? "bg-[#FFDD2D] text-zinc-900"
              : "bg-white dark:bg-zinc-900 text-amber-500 border border-amber-200/60 dark:border-amber-900/40"
          }`}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      <div
        className={`kyc-spoiler-content overflow-hidden transition-all ${
          open ? "show" : "hidden"
        }`}
      >
        <div className="bg-white dark:bg-zinc-950 px-5 md:px-6 py-5 md:py-6">
          <div className="space-y-4 text-sm md:text-[15px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
