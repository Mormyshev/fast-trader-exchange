"use client";

import { Mail, Phone, Send, User } from "lucide-react";
import {
  formatClientName,
  type OrderClient,
} from "@/src/utils/orders/client-info";

export default function StaffClientInfo({
  client,
  compact = false,
}: {
  client: OrderClient | null | undefined;
  compact?: boolean;
}) {
  const name = formatClientName(client);

  if (compact) {
    return (
      <div className="rounded-xl bg-white border border-zinc-200 px-3 py-2.5 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Клиент
        </p>
        <p className="text-xs font-bold text-zinc-900 break-words">{name}</p>
        <p className="text-xs text-zinc-600 truncate">{client?.email || "—"}</p>
        <p className="text-xs text-zinc-600">{client?.phone || "—"}</p>
        <p className="text-xs text-zinc-600 truncate">{client?.telegram || "—"}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4 space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
        Клиент
      </p>
      <div className="flex items-start gap-2">
        <User className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
        <p className="text-sm font-bold text-zinc-900 break-words">{name}</p>
      </div>
      <div className="space-y-1.5 text-xs text-zinc-600">
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="truncate">{client?.email || "—"}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span>{client?.phone || "—"}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Send className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="truncate">{client?.telegram || "—"}</span>
        </div>
      </div>
    </div>
  );
}
