"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import StaffPageHeader from "@/src/components/staff/StaffPageHeader";

export default function SettingsPage() {
  return (
    <div className="w-full space-y-4 sm:space-y-6 lg:space-y-8 text-zinc-900 font-sans">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
          <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <StaffPageHeader
          title="Настройки системы"
          description="Системные параметры и конфигурация обменника"
        />
      </div>

      <div className="rounded-2xl bg-white p-5 sm:p-8 md:p-10 shadow-[0_4px_24px_rgba(15,23,42,0.04)] min-h-[16rem] flex flex-col justify-center">
        <p className="text-sm font-medium leading-relaxed text-zinc-500 max-w-xl">
          Раздел в разработке. Здесь появятся системные параметры и конфигурация
          обменника.
        </p>
        <Button
          asChild
          className="mt-6 w-fit rounded-full h-10 px-6 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none"
        >
          <Link href="/operator/dashboard">Вернуться на дашборд</Link>
        </Button>
      </div>
    </div>
  );
}
