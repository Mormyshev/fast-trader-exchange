"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrintReceiptButton() {
  return (
    <Button
      type="button"
      onClick={() => window.print()}
      className="rounded-full h-10 px-5 text-sm font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none cursor-pointer print:hidden"
    >
      <Printer className="w-4 h-4" />
      Скачать / распечатать
    </Button>
  );
}
