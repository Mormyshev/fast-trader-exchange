"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, Loader2, Paperclip, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatVerifiedFio } from "@/src/utils/orders/client-info";
import { orderPublicTitle } from "@/src/utils/orders/public-number";
import {
  formatOrderExchangeLine,
  SUPPORT_APPEAL_MAX,
  SUPPORT_APPEAL_MAX_FILES,
  SUPPORT_APPEAL_MIN,
  supportOrderStatusLabel,
} from "@/src/utils/support/appeal";
import { ALLOWED_CHAT_ATTACHMENT_TYPES } from "@/src/utils/chat/types";
import { lockPageScroll, unlockPageScroll } from "@/src/utils/lenis-bridge";

export type SupportAppealOrder = {
  id: string;
  order_number?: number | null;
  status: string;
  amount_from: number;
  amount_to: number;
  currency_from: string;
  currency_to: string;
};

type ProfileSummary = {
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  telegram?: string | null;
  phone?: string | null;
  email?: string | null;
};

export default function CreateSupportAppealDialog({
  open,
  order,
  onClose,
}: {
  open: boolean;
  order: SupportAppealOrder;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    lockPageScroll();
    setDescription("");
    setFiles([]);
    setError(null);
    setSubmitting(false);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && res.ok && json.profile) {
          setProfile(json.profile);
        }
      } catch {
        // summary remains empty
      }
    })();
    return () => {
      cancelled = true;
      unlockPageScroll();
    };
  }, [open, order.id]);

  const clientName = formatVerifiedFio(profile ?? {});
  const clientEmail = profile?.email?.trim() || "—";
  const clientTelegram = profile?.telegram?.trim() || "—";
  const clientPhone = profile?.phone?.trim() || "—";

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setFiles((prev) => {
      const next = [...prev];
      for (const file of Array.from(list)) {
        if (next.length >= SUPPORT_APPEAL_MAX_FILES) break;
        if (next.some((item) => item.name === file.name && item.size === file.size)) {
          continue;
        }
        if (!ALLOWED_CHAT_ATTACHMENT_TYPES.includes(file.type)) continue;
        next.push(file);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const trimmed = description.trim();
    if (trimmed.length < SUPPORT_APPEAL_MIN) {
      setError(`Опишите проблему: минимум ${SUPPORT_APPEAL_MIN} символов`);
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("order_id", order.id);
      form.set("description", trimmed);
      for (const file of files) {
        form.append("files", file);
      }
      const res = await fetch("/api/support/appeals", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Не удалось создать обращение");
      }
      onClose();
      router.push("/user/support");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось создать обращение",
      );
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !submitting) onClose();
      }}
    >
      <DialogContent
        showCloseButton
        className="block max-h-[90dvh] w-full overflow-hidden p-0 sm:max-w-[520px] sm:p-0"
      >
        <div
          data-lenis-prevent
          className="max-h-[calc(90dvh-9.5rem)] overflow-y-auto overflow-x-hidden overscroll-contain px-6 py-6 sm:px-7 sm:py-7 [scrollbar-gutter:stable]"
        >
          <div className="space-y-5">
            <div>
              <div className="flex size-12 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
                <HelpCircle className="size-6" />
              </div>
              <DialogHeader className="mt-4 gap-1.5 pr-0">
                <DialogTitle className="text-xl">
                  Создать обращение в службу поддержки
                </DialogTitle>
                <DialogDescription>
                  Опишите проблему и при необходимости прикрепите файлы. Номер
                  заявки, обмен и данные клиента подставятся автоматически.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="rounded-2xl bg-zinc-50 border border-zinc-200 px-4 py-3 space-y-2 text-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Заявка
              </p>
              <p className="font-bold text-zinc-900">{orderPublicTitle(order)}</p>
              <p className="font-medium text-zinc-700">
                {formatOrderExchangeLine(order)}
              </p>
              <p className="text-xs font-semibold text-zinc-500">
                Статус: {supportOrderStatusLabel(order.status)}
              </p>
              <div className="pt-1 border-t border-zinc-200 space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Клиент
                </p>
                <p className="font-medium text-zinc-800">{clientName || "—"}</p>
                <p className="text-xs text-zinc-500">E-mail: {clientEmail}</p>
                <p className="text-xs text-zinc-500">Telegram: {clientTelegram}</p>
                <p className="text-xs text-zinc-500">Телефон: {clientPhone}</p>
              </div>
            </div>

            <div className="space-y-2">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                maxLength={SUPPORT_APPEAL_MAX}
                placeholder="Опишите, что произошло"
                disabled={submitting}
                className={`w-full rounded-2xl border bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#FFDD2D] focus:bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 ${
                  error ? "border-rose-400" : "border-zinc-200 dark:border-zinc-700"
                }`}
              />
              <p className="text-[11px] font-medium text-zinc-400 text-right">
                {description.trim().length}/{SUPPORT_APPEAL_MAX}
              </p>
            </div>

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_CHAT_ATTACHMENT_TYPES.join(",")}
                className="hidden"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={submitting || files.length >= SUPPORT_APPEAL_MAX_FILES}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                <Paperclip className="size-4" />
                Прикрепить файлы
              </button>
              <p className="text-[11px] font-medium text-zinc-400">
                До {SUPPORT_APPEAL_MAX_FILES} файлов: изображения, PDF или видео,
                до 10 МБ каждый
              </p>
              {files.length > 0 && (
                <ul className="space-y-1.5">
                  {files.map((file) => (
                    <li
                      key={`${file.name}-${file.size}`}
                      className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700"
                    >
                      <span className="min-w-0 truncate">{file.name}</span>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          setFiles((prev) => prev.filter((item) => item !== file))
                        }
                        className="ml-auto rounded-full p-1 hover:bg-zinc-200"
                        aria-label="Убрать файл"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error ? (
              <p className="text-xs font-medium text-rose-600">{error}</p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2.5 border-t border-zinc-100 bg-white px-6 py-4 sm:flex-col-reverse sm:justify-stretch sm:px-7 dark:border-zinc-800 dark:bg-zinc-900">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="h-11 w-full rounded-xl border-zinc-200 px-5 font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200"
          >
            Отмена
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="h-11 w-full rounded-xl bg-[#FFDD2D] px-5 font-bold text-zinc-900 shadow-none hover:bg-[#e6c628]"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Отправить обращение
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
