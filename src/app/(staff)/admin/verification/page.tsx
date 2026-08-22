"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeWithAuth } from "@/src/utils/supabase/realtime";
import { subscribeVerificationsInbox } from "@/src/utils/supabase/verifications-inbox";
import {
  ShieldAlert,
  Check,
  X,
  Phone,
  Send,
  Eye,
  Loader2,
  RefreshCw,
  Clock,
  MessageSquare,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import StaffScrollTabs from "@/src/components/staff/StaffScrollTabs";
import { normalizeVerificationStatus } from "@/src/utils/verification";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";

type VerificationTab = "pending" | "verified" | "rejected";

interface ProfileRequest {
  id: string;
  email: string;
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  phone: string | null;
  telegram: string | null;
  passport_url: string | null;
  verification: string | null;
  verification_rejection_comment: string | null;
  updated_at: string | null;
}

const TAB_LABELS: Record<VerificationTab, string> = {
  pending: "На проверке",
  verified: "Принятые",
  rejected: "Отменённые",
};

const TAB_SHELL: Record<VerificationTab, string> = {
  pending: "border-amber-200",
  verified: "border-emerald-300",
  rejected: "border-rose-300",
};

function formatSubmittedAt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fullName(req: ProfileRequest) {
  return (
    [req.last_name, req.first_name, req.middle_name].filter(Boolean).join(" ") ||
    "—"
  );
}

export default function AdminVerificationPage() {
  const supabase = createClient();
  const { confirm, ConfirmDialogHost } = useConfirmDialog();

  const [activeTab, setActiveTab] = useState<VerificationTab>("pending");
  const [requests, setRequests] = useState<ProfileRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ProfileRequest | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  const fetchRequests = useCallback(async (tab: VerificationTab) => {
    try {
      const res = await fetch(`/api/verifications?tab=${tab}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка загрузки");
      setRequests(json.requests || []);
      setError(null);
    } catch (err) {
      console.error("Ошибка получения заявок:", err);
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  const applyProfile = useCallback(
    (row: ProfileRequest) => {
      if (!row?.id) return;
      const status = normalizeVerificationStatus(row.verification);

      if (status === activeTab) {
        setRequests((prev) => {
          const without = prev.filter((req) => req.id !== row.id);
          return [row, ...without];
        });
        return;
      }

      setRequests((prev) => prev.filter((req) => req.id !== row.id));
    },
    [activeTab],
  );

  useEffect(() => {
    let cancelled = false;
    let pgChannel: ReturnType<typeof supabase.channel> | null = null;

    setLoading(true);
    void fetchRequests(activeTab);
    if (cancelled) return;

    const inboxChannel = subscribeVerificationsInbox(supabase, (profile) => {
      applyProfile(profile as unknown as ProfileRequest);
    });

    void (async () => {
      pgChannel = supabase
        .channel("admin-verifications-channel")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
          },
          (payload) => {
            const updatedRow = payload.new as ProfileRequest;
            applyProfile(updatedRow);
          },
        );

      await subscribeWithAuth(supabase, pgChannel);
    })();

    const onFocus = () => {
      void fetchRequests(activeTab);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(inboxChannel);
      if (pgChannel) supabase.removeChannel(pgChannel);
    };
  }, [supabase, activeTab, fetchRequests, applyProfile]);

  const submitVerdict = async (
    id: string,
    status: "verified" | "rejected",
    comment?: string,
  ) => {
    setProcessingId(id);
    setRequests((prev) => prev.filter((req) => req.id !== id));

    try {
      const res = await fetch("/api/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, comment }),
      });
      const json = await res.json();
      if (!res.ok) {
        await fetchRequests(activeTab);
        throw new Error(json.error || "Ошибка обновления");
      }

      alert(
        status === "verified"
          ? "Анкета успешно подтверждена!"
          : "Анкета отклонена. Пользователь увидит ваш комментарий.",
      );
    } catch (err: unknown) {
      console.error("Ошибка обновления статуса:", err);
      alert(
        `Ошибка: ${err instanceof Error ? err.message : "Неизвестная ошибка"}`,
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (req: ProfileRequest) => {
    const ok = await confirm({
      title:
        activeTab === "rejected"
          ? "Принять анкету из отменённых?"
          : "Одобрить анкету?",
      description:
        activeTab === "rejected"
          ? "Пользователь получит доступ без повторной отправки анкеты."
          : "Пользователь получит доступ ко всем операциям на платформе.",
      confirmLabel: activeTab === "rejected" ? "Принять" : "Одобрить",
    });
    if (!ok) return;
    await submitVerdict(req.id, "verified");
  };

  const openRejectDialog = (req: ProfileRequest) => {
    setRejectTarget(req);
    setRejectComment("");
    setRejectError(null);
  };

  const closeRejectDialog = () => {
    setRejectTarget(null);
    setRejectComment("");
    setRejectError(null);
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget) return;
    const comment = rejectComment.trim();
    if (!comment) {
      setRejectError("Укажите причину отклонения");
      return;
    }

    closeRejectDialog();
    await submitVerdict(rejectTarget.id, "rejected", comment);
  };

  const emptyText =
    activeTab === "pending"
      ? "Новых заявок на верификацию нет"
      : activeTab === "verified"
        ? "Принятых анкет пока нет"
        : "Отменённых анкет пока нет";

  const renderActions = (req: ProfileRequest, compact = false) => {
    if (activeTab === "verified") {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
          Подтверждена
        </span>
      );
    }

    if (activeTab === "rejected") {
      return (
        <Button
          size="sm"
          disabled={processingId === req.id}
          onClick={() => void handleApprove(req)}
          className={`rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold ${
            compact ? "h-10 text-xs w-full" : "h-8 px-3 text-xs"
          }`}
        >
          {processingId === req.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Check className="h-3.5 w-3.5 mr-1" />
              Принять
            </>
          )}
        </Button>
      );
    }

    return (
      <div
        className={`flex ${compact ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "items-center justify-end gap-2"}`}
      >
        <Button
          size="sm"
          disabled={processingId === req.id}
          onClick={() => void handleApprove(req)}
          className={`rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold ${
            compact ? "h-10 text-xs w-full" : "h-8 px-3 text-xs"
          }`}
        >
          {processingId === req.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Check className="h-3.5 w-3.5 mr-1" />
              Одобрить
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={processingId === req.id}
          onClick={() => openRejectDialog(req)}
          className={`rounded-full font-bold ${
            compact ? "h-10 text-xs w-full" : "h-8 px-3 text-xs"
          }`}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Отклонить
        </Button>
      </div>
    );
  };

  if (loading && requests.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#FFDD2D]" />
          <p className="text-xs font-medium text-gray-400">Загрузка анкет...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 shrink-0">
            <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold">Верификация аккаунтов</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400">
              Проверка анкет пользователей — только для администратора
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true);
            void fetchRequests(activeTab);
          }}
          className="rounded-full h-9 px-4 text-xs font-bold cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Обновить
        </Button>
      </div>

      <StaffScrollTabs>
        {(Object.keys(TAB_LABELS) as VerificationTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              setLoading(true);
            }}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              activeTab === tab
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </StaffScrollTabs>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-3 h-7 text-rose-700"
            onClick={() => {
              setLoading(true);
              void fetchRequests(activeTab);
            }}
          >
            Повторить
          </Button>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 sm:p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-gray-500 dark:text-zinc-400">{emptyText}</p>
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-zinc-900/50 space-y-3 ${TAB_SHELL[activeTab]}`}
              >
                <div>
                  <p className="font-bold text-sm text-zinc-900 break-all">
                    {req.email}
                  </p>
                  <p className="text-xs text-zinc-400 font-mono truncate">
                    {req.id}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                    <Clock className="h-3 w-3 shrink-0" />
                    {formatSubmittedAt(req.updated_at)}
                  </p>
                </div>
                <p className="text-sm font-medium">{fullName(req)}</p>
                <div className="space-y-1 text-xs text-zinc-600">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-zinc-400" />
                    {req.phone || "—"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Send className="h-3 w-3 text-zinc-400" />
                    {req.telegram || "—"}
                  </div>
                </div>
                {activeTab === "rejected" && req.verification_rejection_comment && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2 text-xs text-rose-800">
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <MessageSquare className="h-3 w-3" />
                      Комментарий
                    </div>
                    {req.verification_rejection_comment}
                  </div>
                )}
                {req.passport_url ? (
                  <button
                    type="button"
                    onClick={() => setSelectedPhoto(req.passport_url)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Открыть документ
                  </button>
                ) : (
                  <span className="text-xs text-zinc-400">Нет файла</span>
                )}
                <div className="pt-1">{renderActions(req, true)}</div>
              </div>
            ))}
          </div>

          <div className={`hidden md:block overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-zinc-900/50 ${TAB_SHELL[activeTab]}`}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:bg-zinc-900 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-4">Пользователь</th>
                    <th className="px-6 py-4">Отправлена</th>
                    <th className="px-6 py-4">ФИО</th>
                    <th className="px-6 py-4">Контакты</th>
                    {activeTab === "rejected" && (
                      <th className="px-6 py-4">Комментарий</th>
                    )}
                    <th className="px-6 py-4">Документ</th>
                    <th className="px-6 py-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {requests.map((req) => (
                    <tr
                      key={req.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-zinc-900/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-zinc-100">
                          {req.email}
                        </div>
                        <div className="text-xs text-gray-400 truncate max-w-[150px]">
                          {req.id}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
                        {formatSubmittedAt(req.updated_at)}
                      </td>
                      <td className="px-6 py-4 font-medium">{fullName(req)}</td>
                      <td className="px-6 py-4 space-y-1">
                        <div className="flex items-center text-xs text-gray-600 dark:text-zinc-300">
                          <Phone className="mr-1.5 h-3 w-3 text-gray-400" />
                          {req.phone || "—"}
                        </div>
                        <div className="flex items-center text-xs text-gray-600 dark:text-zinc-300">
                          <Send className="mr-1.5 h-3 w-3 text-gray-400" />
                          {req.telegram || "—"}
                        </div>
                      </td>
                      {activeTab === "rejected" && (
                        <td className="px-6 py-4 text-xs text-rose-700 max-w-[220px]">
                          {req.verification_rejection_comment || "—"}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        {req.passport_url ? (
                          <button
                            type="button"
                            onClick={() => setSelectedPhoto(req.passport_url)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Открыть
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-400">Нет файла</span>
                        )}
                      </td>
                      <td className="px-6 py-4">{renderActions(req)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) closeRejectDialog();
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-[440px]">
          <div className="flex items-start gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <X className="size-5" />
            </div>
            <DialogHeader className="flex-1 gap-1.5 pr-0">
              <DialogTitle>Отклонить анкету</DialogTitle>
              <DialogDescription>
                Укажите причину — пользователь увидит комментарий и сможет
                исправить данные.
              </DialogDescription>
            </DialogHeader>
          </div>
          <textarea
            value={rejectComment}
            onChange={(e) => {
              setRejectComment(e.target.value);
              if (rejectError) setRejectError(null);
            }}
            rows={4}
            maxLength={1000}
            placeholder="Например: фото паспорта нечитаемо, исправьте и отправьте снова"
            className={`w-full rounded-2xl border bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#FFDD2D] focus:bg-white ${
              rejectError ? "border-rose-400" : "border-zinc-200"
            }`}
          />
          {rejectError && (
            <p className="text-xs font-medium text-rose-600">{rejectError}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeRejectDialog}
              className="h-11 rounded-full border-zinc-200 px-5 font-bold text-zinc-700 hover:bg-zinc-50"
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={() => void handleRejectSubmit()}
              className="h-11 rounded-full bg-rose-600 px-5 font-bold text-white shadow-none hover:bg-rose-700"
            >
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 backdrop-blur-[3px] p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-[28px] border border-zinc-200 bg-white p-2 shadow-[0_24px_80px_rgba(24,24,27,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[#FFDD2D]"
            />
            <Image
              src={selectedPhoto}
              alt="Документ"
              width={900}
              height={1200}
              className="max-h-[85vh] w-auto object-contain"
              unoptimized
            />
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-4 right-4 size-9 rounded-full bg-white/90 text-zinc-500 hover:bg-white hover:text-zinc-800 shadow-sm"
              onClick={() => setSelectedPhoto(null)}
            >
              <X className="size-4" />
              <span className="sr-only">Закрыть</span>
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialogHost />
    </div>
  );
}
