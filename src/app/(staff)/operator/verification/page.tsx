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
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { normalizeVerificationStatus } from "@/src/utils/verification";

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
}

function isPendingQueue(status: string | null | undefined) {
  return normalizeVerificationStatus(status) === "pending";
}

export default function VerificationPage() {
  const supabase = createClient();

  const [requests, setRequests] = useState<ProfileRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const applyProfile = useCallback((row: ProfileRequest) => {
    if (!row?.id) return;

    if (isPendingQueue(row.verification)) {
      setRequests((prev) => {
        const without = prev.filter((req) => req.id !== row.id);
        return [row, ...without];
      });
      return;
    }

    setRequests((prev) => prev.filter((req) => req.id !== row.id));
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/verifications", { cache: "no-store" });
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

  useEffect(() => {
    let cancelled = false;
    let pgChannel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      setLoading(true);
      await fetchRequests();
      if (cancelled) return;
    })();

    const inboxChannel = subscribeVerificationsInbox(supabase, (profile) => {
      applyProfile(profile as unknown as ProfileRequest);
    });

    void (async () => {
      pgChannel = supabase
        .channel("operator-verifications-channel")
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
      void fetchRequests();
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
  }, [supabase, fetchRequests, applyProfile]);

  const handleVerdict = async (
    id: string,
    status: "verified" | "rejected",
  ) => {
    setProcessingId(id);
    setRequests((prev) => prev.filter((req) => req.id !== id));
    try {
      const res = await fetch("/api/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!res.ok) {
        await fetchRequests();
        throw new Error(json.error || "Ошибка обновления");
      }
      alert(
        status === "verified"
          ? "Анкета успешно подтверждена!"
          : "Анкета отклонена. Данные пользователя сохранены — он может исправить и отправить снова.",
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

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#FFDD2D]" />
          <p className="text-xs font-medium text-gray-400">
            Загрузка анкет...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-12 dark:bg-zinc-950 text-gray-900 dark:text-zinc-50">
      <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                Панель оператора: Верификация
              </h1>
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                Проверка персональных данных и документов пользователей
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              void fetchRequests();
            }}
            className="rounded-full h-9 px-4 text-xs font-bold cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Обновить
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
            <Button
              variant="ghost"
              size="sm"
              className="ml-3 h-7 text-rose-700"
              onClick={() => {
                setLoading(true);
                void fetchRequests();
              }}
            >
              Повторить
            </Button>
          </div>
        )}

        {requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-gray-500 dark:text-zinc-400">
              Новых заявок на верификацию нет
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-4 text-xs font-bold"
              onClick={() => {
                setLoading(true);
                void fetchRequests();
              }}
            >
              Проверить ещё раз
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-zinc-900 dark:bg-zinc-900/50">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:bg-zinc-900 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-4">Пользователь</th>
                    <th className="px-6 py-4">ФИО</th>
                    <th className="px-6 py-4">Контакты</th>
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
                      <td className="px-6 py-4 font-medium">
                        {req.last_name || "—"} {req.first_name || "—"}{" "}
                        {req.middle_name || ""}
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
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={processingId === req.id}
                            onClick={() => handleVerdict(req.id, "verified")}
                            className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white h-8 px-3 text-xs font-bold"
                          >
                            {processingId === req.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Одобрить
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={processingId === req.id}
                            onClick={() => handleVerdict(req.id, "rejected")}
                            className="rounded-full h-8 px-3 text-xs font-bold"
                          >
                            <X className="h-3.5 w-3.5" />
                            Отклонить
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl bg-white p-2"
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
              variant="secondary"
              className="absolute top-3 right-3 rounded-full"
              onClick={() => setSelectedPhoto(null)}
            >
              Закрыть
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
