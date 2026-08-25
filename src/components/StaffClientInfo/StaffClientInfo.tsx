"use client";

import { Mail, Phone, Send, User } from "lucide-react";
import {
  formatClientName,
  type OrderClient,
} from "@/src/utils/orders/client-info";

export default function StaffClientInfo({
  client,
  compact = false,
  hideLabel = false,
}: {
  client: OrderClient | null | undefined;
  compact?: boolean;
  hideLabel?: boolean;
}) {
  const name = formatClientName(client);

  if (compact) {
    const initials = name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "К";
    const contacts = [client?.phone, client?.telegram, client?.email]
      .filter(Boolean)
      .join(" · ");

    return (
        <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-8 h-8 rounded-full bg-[#FFF4C2] text-[10px] font-bold text-[#C9A227] flex items-center justify-center shrink-0">
          {initials}
        </span>
        <div className="min-w-0">
          {!hideLabel && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Клиент
            </p>
          )}
          <p className="text-sm font-semibold text-zinc-900 break-words">
            {name}
          </p>
          <p className="text-[11px] text-zinc-600 break-all">
            {contacts || "Нет контактов"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#F4F5F7] p-4 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
        Клиент
      </p>
      <div className="flex items-start gap-2">
        <User className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
        <p className="text-sm font-bold text-zinc-900 break-words">{name}</p>
      </div>
      <div className="space-y-1.5 text-xs text-zinc-600">
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="break-all">{client?.email || "—"}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="break-all">{client?.phone || "—"}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Send className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="break-all">{client?.telegram || "—"}</span>
        </div>
      </div>
    </div>
  );
}
