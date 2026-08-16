"use client";

import { useCallback, useRef, useState } from "react";
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
  }, []);

  const ConfirmDialogHost = () => {
    if (!options) return null;

    const {
      title,
      description,
      confirmLabel = "Подтвердить",
      cancelLabel = "Отмена",
      variant = "default",
    } = options;

    return (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close(false);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <DialogFooter className="border-t-0 bg-transparent -mx-4 -mb-4 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
              className="rounded-full"
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={() => close(true)}
              className={
                variant === "default"
                  ? "rounded-full bg-[#FFDD2D] hover:bg-[#e6c625] text-black font-bold"
                  : "rounded-full font-bold"
              }
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return { confirm, ConfirmDialogHost };
}
