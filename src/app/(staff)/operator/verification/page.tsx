"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/src/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/app/context/AuthContext";
import {
  ShieldAlert,
  Check,
  X,
  ExternalLink,
  Phone,
  Send,
  Eye,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

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

export default function VerificationPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, role: contextRole, isLoading: authLoading } = useAuth();

  const [requests, setRequests] = useState<ProfileRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true); // Новый стейт для защиты от ложного редиректа
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Строгая проверка роли напрямую из базы данных для исключения лагов контекста
  useEffect(() => {
    async function checkAccess() {
      // 1. Ждем, пока контекст завершит первичную загрузку сессии
      if (authLoading) return;

      // 2. Если сессии вообще нет — выкидываем на главную
      if (!user?.id) {
        router.replace("/");
        return;
      }

      try {
        // 3. Делаем прямой запрос в таблицу profiles, чтобы узнать точную роль прямо сейчас
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (error || !data) {
          router.replace("/");
          return;
        }

        // 4. Если роль не оператор и не админ — закрываем доступ
        if (data.role !== "operator" && data.role !== "admin") {
          router.replace("/");
        } else {
          // Доступ разрешен, снимаем флаг проверки прав и запускаем загрузку анкет
          setIsCheckingAccess(false);
          fetchRequests();
        }
      } catch (err) {
        console.error("Ошибка проверки прав:", err);
        router.replace("/");
      }
    }

    checkAccess();
  }, [user?.id, authLoading, router, supabase]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/verifications", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка загрузки");
      setRequests(json.requests || []);
    } catch (err) {
      console.error("Ошибка получения заявок:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerdict = async (
    id: string,
    status: "verified" | "not_started",
  ) => {
    setProcessingId(id);
    // мгновенный UI
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
          : "Анкета отклонена.",
      );
    } catch (err: any) {
      console.error("Ошибка обновления статуса:", err);
      alert(`Ошибка: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };
  // Включаем Realtime-слушатель для мгновенного добавления новых заявок на экран оператора
  useEffect(() => {
    // Не запускаем подписку, пока оператор не пройдет верификацию роли
    if (isCheckingAccess) return;

    const operatorSubscription = supabase
      .channel("operator-verifications-channel")
      .on(
        "postgres_changes",
        {
          event: "*", // Слушаем любые события (INSERT и UPDATE)
          schema: "public",
          table: "profiles",
        },
        async (payload) => {
          const updatedRow = payload.new as ProfileRequest;

          // Сценарий 1: Пользователь отправил анкету на проверку (INSERT или UPDATE в статус 'on_check')
          if (updatedRow && updatedRow.verification === "on_check") {
            setRequests((prev) => {
              // Защита от дубликатов: если заявка уже есть в стейте, не добавляем её заново
              if (prev.some((req) => req.id === updatedRow.id)) return prev;
              return [updatedRow, ...prev]; // Добавляем новую заявку в начало списка
            });
          }

          // Сценарий 2: Если пользователь отменил заявку или другой оператор уже взял её в работу
          if (updatedRow && updatedRow.verification !== "on_check") {
            setRequests((prev) =>
              prev.filter((req) => req.id !== updatedRow.id),
            );
          }
        },
      )
      .subscribe();

    // Важно: отписываемся от канала при размонтировании компонента
    return () => {
      supabase.removeChannel(operatorSubscription);
    };
  }, [isCheckingAccess, supabase]);

  // Важно: Пока идет проверка авторизации ИЛИ прямая проверка роли из базы данных,
  // мы никуда не редиректим, а просто показываем красивый лоадер.
  if (authLoading || isCheckingAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/50 dark:bg-zinc-950">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#FFDD2D]" />
          <p className="text-xs font-medium text-gray-400">
            Проверка прав оператора...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-12 dark:bg-zinc-950 text-gray-900 dark:text-zinc-50">
      <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center space-x-3">
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

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#FFDD2D]" />
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-gray-500 dark:text-zinc-400">
              Новых заявок на верификацию нет
            </p>
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
                            onClick={() => setSelectedPhoto(req.passport_url)}
                            className="flex items-center space-x-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Смотреть фото</span>
                          </button>
                        ) : (
                          <span className="text-xs text-red-500">Нет фото</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            size="sm"
                            disabled={processingId !== null}
                            onClick={() => handleVerdict(req.id, "verified")}
                            className="bg-emerald-600 text-white hover:bg-emerald-700 h-9 px-3 rounded-xl shadow-none"
                          >
                            <Check className="h-4 w-4 mr-1" /> Подтвердить
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={processingId !== null}
                            onClick={() => handleVerdict(req.id, "not_started")}
                            className="h-9 px-3 rounded-xl shadow-none"
                          >
                            <X className="h-4 w-4 mr-1" /> Отклонить
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
      {/* Модалка полноэкранного фото */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative max-w-4xl w-full max-h-[85vh] bg-zinc-900 rounded-2xl overflow-hidden p-2">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="relative w-full h-[75vh]">
              <Image
                src={selectedPhoto}
                alt="Паспорт крупным планом"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <div className="p-3 text-center text-xs text-zinc-400">
              <a
                href={selectedPhoto}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center hover:underline text-[#FFDD2D]"
              >
                Открыть оригинал в новой вкладке{" "}
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
