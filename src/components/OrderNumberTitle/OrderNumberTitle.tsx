"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  orderPublicNumber,
  orderPublicTitle,
} from "@/src/utils/orders/public-number";

export default function OrderNumberTitle({
  order,
  className = "",
}: {
  order: { id: string; order_number?: number | null };
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const number = orderPublicNumber(order);
  const title = orderPublicTitle(order);
  const copyValue = number ?? order.id;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <h1 className="text-xl sm:text-2xl lg:text-[28px] font-bold tracking-tight text-zinc-900 truncate">
        {title}
      </h1>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
        aria-label="Скопировать номер заявки"
        title="Скопировать номер"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
