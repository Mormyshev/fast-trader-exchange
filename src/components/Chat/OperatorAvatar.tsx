"use client";

import { cn } from "@/lib/utils";

export default function OperatorAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const initial = (name.trim()[0] || "О").toUpperCase();
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";

  return (
    <div
      className={cn(
        "rounded-full bg-[#FFDD2D] border border-amber-200/80 flex items-center justify-center font-bold text-zinc-900 shrink-0",
        sizeClass,
        className,
      )}
      aria-hidden
    >
      {initial}
    </div>
  );
}
