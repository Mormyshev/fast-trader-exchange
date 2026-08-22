"use client";

import { useCallback, useRef, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

function ConfirmDialogView({
  options,
  onClose,
}: {
  options: ConfirmDialogOptions | null;
  onClose: (result: boolean) => void;
}) {
  if (!options) return null;

  const {
    title,
    description,
    confirmLabel = "Подтвердить",
    cancelLabel = "Отмена",
    variant = "default",
  } = options;

  const isDestructive = variant === "destructive";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose(false);
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-[420px]">
        <div className="flex items-start gap-3.5">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${
              isDestructive
                ? "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                : "bg-[#FFDD2D]/50 text-zinc-900"
            }`}
          >
            {isDestructive ? (
              <AlertTriangle className="size-5" />
            ) : (
              <HelpCircle className="size-5" />
            )}
          </div>
          <DialogHeader className="flex-1 gap-1.5 pr-0">
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onClose(false)}
            className="h-11 rounded-full border-zinc-200 px-5 font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={() => onClose(true)}
            className={
              isDestructive
                ? "h-11 rounded-full bg-rose-600 px-5 font-bold text-white shadow-none hover:bg-rose-700"
                : "h-11 rounded-full bg-[#FFDD2D] px-5 font-bold text-zinc-900 shadow-none hover:bg-[#e6c628]"
            }
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (dialogOptions: ConfirmDialogOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setOptions(dialogOptions);
      });
    },
    [],
  );

  const close = useCallback((result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setOptions(null);
    document.body.style.removeProperty("pointer-events");
  }, []);

  const ConfirmDialogHost = useCallback(
    () => <ConfirmDialogView options={options} onClose={close} />,
    [options, close],
  );

  return { confirm, ConfirmDialogHost };
}
