"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function StaffSearchInput({
  value,
  onChange,
  placeholder = "Поиск",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 h-10 rounded-2xl bg-white border-zinc-200/80 shadow-none focus-visible:ring-[#FFDD2D] text-sm font-medium"
      />
    </div>
  );
}

export function matchesSearchQuery(
  query: string,
  ...parts: Array<string | null | undefined>
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}
