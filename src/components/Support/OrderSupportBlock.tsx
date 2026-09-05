"use client";

import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateSupportAppealDialog, {
  type SupportAppealOrder,
} from "./CreateSupportAppealDialog";

export default function OrderSupportBlock({
  order,
}: {
  order: SupportAppealOrder;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="rounded-2xl bg-white px-4 sm:px-6 py-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)] dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
          <LifeBuoy className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            Возникла проблема?
          </p>
          <p className="mt-0.5 text-sm font-medium text-zinc-500">
            Напишите в службу поддержки — данные заявки подставятся сами.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="h-11 rounded-full bg-[#FFDD2D] px-5 font-bold text-zinc-900 shadow-none hover:bg-[#e6c628] shrink-0"
        >
          Создать обращение в службу поддержки
        </Button>
      </div>
      <CreateSupportAppealDialog
        open={open}
        order={order}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
