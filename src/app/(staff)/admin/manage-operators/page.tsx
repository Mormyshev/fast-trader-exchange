"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ManageOperators() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 text-zinc-900 font-sans">
      <div className="rounded-[32px] border border-zinc-200 bg-white p-8 md:p-10 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-500">
          <Users className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          Управление персоналом
        </h1>
        <p className="text-sm text-zinc-500 font-medium leading-relaxed">
          Раздел в разработке. Здесь появится назначение ролей операторам и
          управление доступом.
        </p>
        <Button
          asChild
          className="rounded-full h-10 px-6 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none"
        >
          <Link href="/operator/dashboard">Вернуться на дашборд</Link>
        </Button>
      </div>
    </div>
  );
}
