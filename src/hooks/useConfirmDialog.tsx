"use client";

import { useCallback, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowLeftRight, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import CurrencyIcon from "@/src/components/CurrencyIcon/CurrencyIcon";

export type ConfirmDialogSummaryItem = {
  label: string;
  amount: string;
  currency: string;
  caption?: string;
  iconSrc?: string;
  iconAlt?: string;
};

export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  summary?: ConfirmDialogSummaryItem[];
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
    summary,
  } = options;

  const isDestructive = variant === "destructive";
  const hasSummary = Boolean(summary?.length);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose(false);
      }}
    >
      <DialogContent
        showCloseButton
        className={hasSummary ? "sm:max-w-[440px] gap-5" : "sm:max-w-[420px]"}
      >
        <div>
          <div
            className={`flex size-12 items-center justify-center rounded-xl ${
              isDestructive
                ? "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                : "bg-[#FFF4C2] text-[#C9A227]"
            }`}
          >
            {isDestructive ? (
              <AlertTriangle className="size-6" />
            ) : hasSummary ? (
              <ArrowLeftRight className="size-6" />
            ) : (
              <HelpCircle className="size-6" />
            )}
          </div>
          <DialogHeader className="mt-4 gap-1.5 pr-0">
            <DialogTitle className="text-xl">{title}</DialogTitle>
            {description && !hasSummary ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
        </div>

        {hasSummary ? (
          <div>
            {summary!.map((item, index) => (
              <div key={`${item.label}-${item.currency}`}>
                {index > 0 ? (
                  <div className="flex justify-center py-1.5">
                    <div className="flex size-8 items-center justify-center rounded-full border border-zinc-100 bg-white text-[#C9A227] shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                      <ArrowDown className="size-4 stroke-[2.5]" />
                    </div>
                  </div>
                ) : null}
                <div
                  className={`rounded-2xl border px-4 py-3.5 ${
                    index === 0
                      ? "border-zinc-100 bg-white"
                      : "border-amber-200/50 bg-[#FFFEEB]"
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                    {item.label}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    {item.iconSrc ? (
                      <CurrencyIcon
                        src={item.iconSrc}
                        alt={item.iconAlt || item.currency}
                        size={36}
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="break-all text-lg font-bold tabular-nums tracking-tight text-zinc-900">
                        {item.amount}
                      </div>
                      <div className="mt-0.5 text-xs font-semibold text-zinc-500">
                        {item.currency}
                        {item.caption ? ` · ${item.caption}` : ""}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {hasSummary && description ? (
          <DialogDescription>{description}</DialogDescription>
        ) : null}

        <DialogFooter className="flex-col-reverse gap-2.5 sm:flex-col-reverse sm:justify-stretch">
          <Button
            type="button"
            variant="outline"
            onClick={() => onClose(false)}
            className="h-11 w-full rounded-xl border-zinc-200 px-5 font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={() => onClose(true)}
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
