"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeWithAuth } from "@/src/utils/supabase/realtime";
import { subscribeVerificationsInbox } from "@/src/utils/supabase/verifications-inbox";
import {
  Check,
  X,
  Phone,
  Send,
  Eye,
  Loader2,
  RefreshCw,
  Clock,
  MessageSquare,
  Ban,
  Users,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import StaffScrollTabs from "@/src/components/staff/StaffScrollTabs";
import ReasonDialog from "@/src/components/staff/ReasonDialog";
import { normalizeVerificationStatus } from "@/src/utils/verification";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";
import { useAuth } from "@/src/app/context/AuthContext";
import { STAFF_INACTIVE_ERROR } from "@/src/utils/staff/duty";
import { parseBlacklistReason } from "@/src/utils/clients/blacklist";

type VerificationTab = "pending" | "verified" | "rejected" | "blacklisted";

interface ProfileRequest {
  id: string;
  email: string;
  role?: string | null;
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  phone: string | null;
  telegram: string | null;
  passport_url: string | null;
  selfie_url?: string | null;
  extra_document_url?: string | null;
  document_number?: string | null;
  verification: string | null;
  verification_rejection_comment: string | null;
  updated_at: string | null;
  is_blacklisted?: boolean | null;
  blacklist_reason?: string | null;
}

const TAB_LABELS: Record<VerificationTab, string> = {
  pending: "На проверке",
  verified: "Принятые",
  rejected: "Отменённые",
  blacklisted: "Черный список",
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

export default function VerificationQueue() {
  const supabase = createClient();
  const { staffActive } = useAuth();
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
  const [blacklistTarget, setBlacklistTarget] = useState<ProfileRequest | null>(
    null,
  );
  const [blacklistReason, setBlacklistReason] = useState("");
  const [blacklistError, setBlacklistError] = useState<string | null>(null);

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
      if (row.role && row.role !== "user") {
        setRequests((prev) => prev.filter((req) => req.id !== row.id));
        return;
      }
      const blacklisted = row.is_blacklisted === true;
      const status = normalizeVerificationStatus(row.verification);
      const belongsHere =
        activeTab === "blacklisted" ? blacklisted : !blacklisted && status === activeTab;

      if (belongsHere) {
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
    if (!staffActive) {
      await confirm({
        title: "Смена недоступна",
        description: STAFF_INACTIVE_ERROR,
        variant: "info",
      });
      return;
    }
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

      await confirm({
        title:
          status === "verified" ? "Анкета подтверждена" : "Анкета отклонена",
        description:
          status === "verified"
            ? "Пользователь получит доступ к обмену."
            : "Пользователь увидит ваш комментарий.",
        variant: "success",
      });
    } catch (err: unknown) {
      console.error("Ошибка обновления статуса:", err);
      await confirm({
        title: "Не удалось обновить анкету",
        description: err instanceof Error ? err.message : "Неизвестная ошибка",
        variant: "info",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (req: ProfileRequest) => {
    if (!staffActive) {
      await confirm({
        title: "Смена недоступна",
        description: STAFF_INACTIVE_ERROR,
        variant: "info",
      });
      return;
    }
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
    if (!staffActive) {
      void confirm({
        title: "Смена недоступна",
        description: STAFF_INACTIVE_ERROR,
        variant: "info",
      });
      return;
    }
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

  const closeBlacklistDialog = () => {
    setBlacklistTarget(null);
    setBlacklistReason("");
    setBlacklistError(null);
  };

  const openBlacklistDialog = (req: ProfileRequest) => {
    if (!staffActive) {
      void confirm({
        title: "Смена недоступна",
        description: STAFF_INACTIVE_ERROR,
        variant: "info",
      });
      return;
    }
    setBlacklistTarget(req);
    setBlacklistReason("");
    setBlacklistError(null);
  };

  const submitBlacklistAction = async (
    id: string,
    action: "blacklist" | "unblacklist",
    reason?: string,
  ) => {
    if (!staffActive) {
      await confirm({
        title: "Смена недоступна",
        description: STAFF_INACTIVE_ERROR,
        variant: "info",
      });
      return;
    }
    setProcessingId(id);
    setRequests((prev) => prev.filter((req) => req.id !== id));

    try {
      const res = await fetch("/api/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        await fetchRequests(activeTab);
        throw new Error(json.error || "Ошибка обновления");
      }
      await confirm({
        title:
          action === "blacklist"
            ? "Клиент в черном списке"
            : "Клиент убран из черного списка",
        description:
          action === "blacklist"
            ? "Он увидит причину и не сможет создавать заявки."
            : "Доступ к обмену снова зависит от статуса верификации.",
        variant: "success",
      });
    } catch (err: unknown) {
      await confirm({
        title: "Не удалось обновить черный список",
        description: err instanceof Error ? err.message : "Неизвестная ошибка",
        variant: "info",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleBlacklistSubmit = async () => {
    if (!blacklistTarget) return;
    const parsed = parseBlacklistReason(blacklistReason);
    if (!parsed.ok) {
      setBlacklistError(parsed.error);
      return;
    }
    const targetId = blacklistTarget.id;
    closeBlacklistDialog();
    await submitBlacklistAction(targetId, "blacklist", parsed.value);
  };

  const handleUnblacklist = async (req: ProfileRequest) => {
    if (!staffActive) {
      await confirm({
        title: "Смена недоступна",
        description: STAFF_INACTIVE_ERROR,
        variant: "info",
      });
      return;
    }
    const ok = await confirm({
      title: "Убрать из черного списка?",
      description: `${req.email} снова сможет пользоваться платформой, если анкета подтверждена.`,
      confirmLabel: "Убрать",
    });
    if (!ok) return;
    await submitBlacklistAction(req.id, "unblacklist");
  };

  const emptyText =
    activeTab === "pending"
      ? "Новых заявок на верификацию нет"
      : activeTab === "verified"
        ? "Принятых анкет пока нет"
        : activeTab === "rejected"
          ? "Отменённых анкет пока нет"
          : "В черном списке никого нет";

  const renderBlacklistButton = (req: ProfileRequest, compact = false) => (
    <Button
      size="sm"
      variant="destructive"
      disabled={processingId === req.id || !staffActive}
      onClick={() => openBlacklistDialog(req)}
      className={`rounded-full font-bold ${
        compact ? "h-10 text-xs w-full" : "h-8 px-3 text-xs"
      }`}
    >
      <Ban className="h-3.5 w-3.5 mr-1" />
      В черный список
    </Button>
  );

  const renderActions = (req: ProfileRequest, compact = false) => {
    if (activeTab === "blacklisted") {
      return (
        <Button
          size="sm"
          disabled={processingId === req.id || !staffActive}
          onClick={() => void handleUnblacklist(req)}
          className={`rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold ${
            compact ? "h-10 text-xs w-full" : "h-8 px-3 text-xs"
          }`}
        >
          {processingId === req.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Убрать из ЧС"
          )}
        </Button>
      );
    }

    if (activeTab === "verified") {
      return (
        <div
          className={`flex ${compact ? "grid grid-cols-1 gap-2" : "items-center justify-end gap-2"}`}
        >
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
            Подтверждена
          </span>
          {renderBlacklistButton(req, compact)}
        </div>
      );
    }

    if (activeTab === "rejected") {
      return (
        <div
          className={`flex ${compact ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "items-center justify-end gap-2"}`}
        >
          <Button
            size="sm"
            disabled={processingId === req.id || !staffActive}
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
          {renderBlacklistButton(req, compact)}
        </div>
      );
    }

    return (
      <div
        className={`flex ${compact ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "items-center justify-end gap-2"}`}
      >
        <Button
          size="sm"
          disabled={processingId === req.id || !staffActive}
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
          disabled={processingId === req.id || !staffActive}
          onClick={() => openRejectDialog(req)}
          className={`rounded-full font-bold ${
            compact ? "h-10 text-xs w-full" : "h-8 px-3 text-xs"
          }`}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Отклонить
        </Button>
        {renderBlacklistButton(req, compact)}
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
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227] shrink-0">
            <Users className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold">Клиенты</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400">
              Анкеты и черный список — для админа и старшего оператора
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
                ? "bg-[#FFF4C2] text-zinc-900"
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
        <div className="rounded-2xl bg-white p-8 sm:p-12 text-center shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
          <p className="text-gray-500 dark:text-zinc-400">{emptyText}</p>
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="rounded-2xl bg-white p-4 shadow-[0_4px_24px_rgba(15,23,42,0.04)] space-y-3"
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
                {req.document_number ? (
                  <p className="text-xs font-medium text-zinc-500">
                    Документ: {req.document_number}
                  </p>
                ) : null}
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
                {activeTab === "blacklisted" && req.blacklist_reason ? (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <Ban className="h-3 w-3" />
                      Причина
                    </div>
                    {req.blacklist_reason}
                  </div>
                ) : null}
                {req.passport_url || req.selfie_url || req.extra_document_url ? (
                  <div className="flex flex-wrap gap-2">
                    {req.passport_url ? (
                      <button
                        type="button"
                        onClick={() => setSelectedPhoto(req.passport_url)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C9A227] hover:underline"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Документ
                      </button>
                    ) : null}
                    {req.selfie_url ? (
                      <button
                        type="button"
                        onClick={() => setSelectedPhoto(req.selfie_url ?? null)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C9A227] hover:underline"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Селфи
                      </button>
                    ) : null}
                    {req.extra_document_url ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPhoto(req.extra_document_url ?? null)
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C9A227] hover:underline"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Доп. файл
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-zinc-400">Нет файла</span>
                )}
                <div className="pt-1">{renderActions(req, true)}</div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
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
                    {activeTab === "blacklisted" && (
                      <th className="px-6 py-4">Причина</th>
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
                      <td className="px-6 py-4 font-medium">
                        <div>{fullName(req)}</div>
                        {req.document_number ? (
                          <div className="mt-1 text-xs font-medium text-zinc-400">
                            {req.document_number}
                          </div>
                        ) : null}
                      </td>
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
                      {activeTab === "blacklisted" && (
                        <td className="px-6 py-4 text-xs text-zinc-700 max-w-[240px]">
                          {req.blacklist_reason || "—"}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        {req.passport_url || req.selfie_url || req.extra_document_url ? (
                          <div className="flex flex-col items-start gap-1">
                            {req.passport_url ? (
                              <button
                                type="button"
                                onClick={() => setSelectedPhoto(req.passport_url)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C9A227] hover:underline cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Документ
                              </button>
                            ) : null}
                            {req.selfie_url ? (
                              <button
                                type="button"
                                onClick={() => setSelectedPhoto(req.selfie_url ?? null)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C9A227] hover:underline cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Селфи
                              </button>
                            ) : null}
                            {req.extra_document_url ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedPhoto(req.extra_document_url ?? null)
                                }
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C9A227] hover:underline cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Доп. файл
                              </button>
                            ) : null}
                          </div>
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

      <ReasonDialog
        open={!!rejectTarget}
        title="Отклонить анкету"
        description="Укажите причину — пользователь увидит комментарий и сможет исправить данные."
        placeholder="Например: фото паспорта нечитаемо, исправьте и отправьте снова"
        confirmLabel="Отклонить"
        icon="alert"
        value={rejectComment}
        error={rejectError}
        onChange={(next) => {
          setRejectComment(next);
          if (rejectError) setRejectError(null);
        }}
        onClose={closeRejectDialog}
        onConfirm={() => void handleRejectSubmit()}
      />

      <ReasonDialog
        open={!!blacklistTarget}
        title="Добавить в черный список"
        description="Укажите причину. Клиент увидит её и не сможет создавать заявки."
        placeholder="Например: мошенничество, повторные отмены, поддельные документы"
        confirmLabel="В черный список"
        value={blacklistReason}
        error={blacklistError}
        onChange={(next) => {
          setBlacklistReason(next);
          if (blacklistError) setBlacklistError(null);
        }}
        onClose={closeBlacklistDialog}
        onConfirm={() => void handleBlacklistSubmit()}
      />

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 backdrop-blur-[2px] p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl bg-white p-2 shadow-[0_24px_80px_rgba(15,23,42,0.12)]"
            onClick={(e) => e.stopPropagation()}
          >
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
