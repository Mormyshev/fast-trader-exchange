"use client";

import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StaffNativeSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          "w-full appearance-none rounded-2xl border bg-[#F4F5F7] h-12 pl-4 pr-12 text-sm font-semibold text-zinc-900 outline-none transition-colors focus:border-[#FFDD2D] focus:bg-white disabled:opacity-60",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
    </div>
  );
}
