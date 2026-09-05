"use client";

import { AlertTriangle, Ban } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function ReasonDialog({
  open,
  title,
  description,
  placeholder,
  confirmLabel,
  value,
  error,
  variant = "destructive",
  icon = "ban",
  onChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  placeholder: string;
  confirmLabel: string;
  value: string;
  error?: string | null;
  variant?: "destructive" | "default";
  icon?: "ban" | "alert";
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isDestructive = variant === "destructive";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent showCloseButton className="sm:max-w-[420px]">
        <div>
          <div
            className={`flex size-12 items-center justify-center rounded-xl ${
              isDestructive
                ? "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                : "bg-[#FFF4C2] text-[#C9A227]"
            }`}
          >
            {icon === "alert" ? (
              <AlertTriangle className="size-6" />
            ) : (
              <Ban className="size-6" />
            )}
          </div>
          <DialogHeader className="mt-4 gap-1.5 pr-0">
            <DialogTitle className="text-xl">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
        </div>

        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          maxLength={1000}
          placeholder={placeholder}
          className={`w-full rounded-2xl border bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#FFDD2D] focus:bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 ${
            error ? "border-rose-400" : "border-zinc-200 dark:border-zinc-700"
          }`}
        />
        {error ? (
          <p className="text-xs font-medium text-rose-600">{error}</p>
        ) : null}

        <DialogFooter className="flex-col-reverse gap-2.5 sm:flex-col-reverse sm:justify-stretch">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-11 w-full rounded-xl border-zinc-200 px-5 font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200"
          >
            Отмена
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className={
              isDestructive
                ? "h-11 w-full rounded-xl bg-rose-600 px-5 font-bold text-white shadow-none hover:bg-rose-700"
                : "h-11 w-full rounded-xl bg-[#FFDD2D] px-5 font-bold text-zinc-900 shadow-none hover:bg-[#e6c628]"
            }
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
