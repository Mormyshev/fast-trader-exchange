"use client";

import { useState, useEffect } from "react";
import {
  User,
  UploadCloud,
  CheckCircle2,
  Clock,
  FileText,
  X,
  Phone,
  Send,
  AlertTriangle,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/src/app/context/AuthContext";
import { createClient } from "@/src/utils/supabase/client";
import {
  canEditVerification,
  normalizeVerificationStatus,
  type VerificationStatus,
} from "@/src/utils/verification";

const supabase = createClient();

export default function ProfilePage() {
  const { user } = useAuth();

  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>("not_started");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");

  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const editable = canEditVerification(verificationStatus);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Ошибка загрузки");
        const data = json.profile;
        if (cancelled) return;
        if (!data) {
          setVerificationStatus("not_started");
          return;
        }
        setLastName(data.last_name || "");
        setFirstName(data.first_name || "");
        setMiddleName(data.middle_name || "");
        setPhone(data.phone || "");
        setTelegram(data.telegram || "");
        setVerificationStatus(
          normalizeVerificationStatus(data.verification),
        );
        if (data.passport_url) setPreviewUrl(data.passport_url);
      } catch (err) {
        console.error("Ошибка загрузки профиля:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchProfile();

    const profileSubscription = supabase
      .channel(`profile-changes-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const updatedProfile = payload.new as Record<string, unknown>;
          if (updatedProfile?.verification != null) {
            setVerificationStatus(
              normalizeVerificationStatus(String(updatedProfile.verification)),
            );
          }
          // Подтягиваем поля с сервера, не затирая их пустыми значениями
          if (typeof updatedProfile.last_name === "string") {
            setLastName(updatedProfile.last_name);
          }
          if (typeof updatedProfile.first_name === "string") {
            setFirstName(updatedProfile.first_name);
          }
          if (typeof updatedProfile.middle_name === "string") {
            setMiddleName(updatedProfile.middle_name);
          }
          if (updatedProfile.middle_name === null) {
            setMiddleName("");
          }
          if (typeof updatedProfile.phone === "string") {
            setPhone(updatedProfile.phone);
          }
          if (typeof updatedProfile.telegram === "string") {
            setTelegram(updatedProfile.telegram);
          }
          if (typeof updatedProfile.passport_url === "string") {
            setPreviewUrl(updatedProfile.passport_url);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(profileSubscription);
    };
  }, [user?.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(
          "Файл слишком большой! Пожалуйста, загрузите фото размером менее 10 МБ.",
        );
        e.target.value = "";
        return;
      }

      setPassportFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeFile = () => {
    setPassportFile(null);
    if (previewUrl && !previewUrl.startsWith("http")) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return alert("Пользователь не авторизован");
    if (!lastName || !firstName || !phone || !telegram)
      return alert("Заполните все обязательные поля");
    if (!passportFile && !previewUrl)
      return alert("Пожалуйста, загрузите фото паспорта");

    setIsSubmitting(true);
    const prevStatus = verificationStatus;

    try {
      const form = new FormData();
      form.append("last_name", lastName);
      form.append("first_name", firstName);
      form.append("middle_name", middleName);
      form.append("phone", phone);
      form.append("telegram", telegram);
      if (previewUrl && !passportFile && previewUrl.startsWith("http")) {
        form.append("passport_url", previewUrl);
      }
      if (passportFile) {
        form.append("passport", passportFile);
      }

      setVerificationStatus("pending");

      const res = await fetch("/api/profile", {
        method: "PATCH",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        setVerificationStatus(prevStatus);
        throw new Error(json.error || "Не удалось сохранить");
      }

      const profile = json.profile;
      if (profile) {
        setLastName(profile.last_name || lastName);
        setFirstName(profile.first_name || firstName);
        setMiddleName(profile.middle_name || middleName);
        setPhone(profile.phone || phone);
        setTelegram(profile.telegram || telegram);
        if (profile.passport_url) setPreviewUrl(profile.passport_url);
        setVerificationStatus(
          normalizeVerificationStatus(profile.verification),
        );
      }
      setPassportFile(null);
      alert("Данные успешно сохранены и отправлены на проверку!");
    } catch (err: unknown) {
      console.error("Ошибка при отправке анкеты:", err);
      alert(
        `Произошла ошибка: ${err instanceof Error ? err.message : "Неизвестная ошибка"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#FFDD2D] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-12 dark:bg-zinc-950 text-gray-900 dark:text-zinc-50">
      <div className="mx-auto max-w-4xl w-full px-4 sm:px-6">
        {verificationStatus === "pending" && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6 text-center shadow-sm dark:border-blue-900/30 dark:bg-blue-950/20 mb-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
              <Clock className="h-6 w-6 animate-pulse" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">
              Данные отправлены оператору
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400 max-w-md mx-auto">
              Форма заблокирована и находится на проверке. Обычно это занимает
              от 15 минут до нескольких часов.
            </p>
          </div>
        )}

        {verificationStatus === "rejected" && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-6 text-center shadow-sm dark:border-rose-900/30 dark:bg-rose-950/20 mb-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Анкета отклонена</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400 max-w-md mx-auto">
              Проверьте данные и фото паспорта, при необходимости исправьте и
              отправьте анкету повторно. Ранее введённые поля сохранены.
            </p>
          </div>
        )}

        {verificationStatus === "verified" && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 text-center shadow-sm dark:border-emerald-900/30 dark:bg-emerald-950/20 mb-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">
              Профиль верифицирован
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400 max-w-md mx-auto">
              Ваша анкета успешно подтверждена. Все операции на платформе
              полностью доступны.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm dark:border-zinc-900 dark:bg-zinc-900/50">
          <div className="flex items-center space-x-3 border-b border-gray-100 pb-5 dark:border-zinc-800">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFDD2D]/10 text-zinc-900 dark:text-[#FFDD2D]">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Верификация аккаунта</h1>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Пожалуйста, вводите реальные данные, совпадающие с вашим
                документом
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400">
                Фамилия
              </label>
              <input
                type="text"
                required
                disabled={!editable}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Иванов"
                className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#FFDD2D] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-[#FFDD2D]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400">
                Имя
              </label>
              <input
                type="text"
                required
                disabled={!editable}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Иван"
                className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#FFDD2D] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-[#FFDD2D]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400">
                Отчество
              </label>
              <input
                type="text"
                disabled={!editable}
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Иванович"
                className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#FFDD2D] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-[#FFDD2D]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400">
                Телефон
              </label>
              <div className="relative mt-1.5">
                <Phone className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  required
                  disabled={!editable}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 (999) 000-00-00"
                  className="block w-full rounded-xl border border-gray-200 bg-gray-50 pl-11 pr-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#FFDD2D] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-[#FFDD2D]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400">
                Telegram
              </label>
              <div className="relative mt-1.5">
                <Send className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  required
                  disabled={!editable}
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="@username"
                  className="block w-full rounded-xl border border-gray-200 bg-gray-50 pl-11 pr-4 py-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#FFDD2D] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-[#FFDD2D]"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
                Фото паспорта рядом с лицом
              </label>
              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                Загрузите селфи, где вы держите раскрытый паспорт. Текст
                документа должен быть читаемым.
              </p>

              {editable ? (
                <div className="mt-3">
                  {!previewUrl ? (
                    <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-6 text-center transition-all hover:border-[#FFDD2D] hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:border-[#FFDD2D]">
                      <UploadCloud className="h-7 w-7 text-gray-400" />
                      <span className="mt-2 text-sm font-medium text-gray-700 dark:text-zinc-300">
                        Нажмите для выбора снимка
                      </span>
                      <span className="mt-1 text-xs text-gray-400">
                        PNG или JPG
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        required={!previewUrl}
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  ) : (
                    <div className="relative mt-2 rounded-xl border border-gray-200 p-4 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-8 w-8 text-gray-400" />
                          <div className="max-w-[180px] sm:max-w-xs truncate">
                            <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                              {passportFile?.name || "Загруженный паспорт.jpg"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={removeFile}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="relative mt-4 h-64 w-full overflow-hidden rounded-lg border border-gray-100 dark:border-zinc-800">
                        <Image
                          src={previewUrl}
                          alt="Превью документа"
                          fill
                          className="object-contain bg-zinc-900"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 space-y-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-gray-100 dark:border-zinc-800">
                    <FileText className="h-4 w-4 text-emerald-500" />
                    <span>
                      Фотография документа успешно отправлена в систему.
                    </span>
                  </div>
                  {previewUrl && (
                    <div className="relative h-64 w-full overflow-hidden rounded-lg border border-gray-100 dark:border-zinc-800">
                      <Image
                        src={previewUrl}
                        alt="Документ"
                        fill
                        className="object-contain bg-zinc-900"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {editable && (
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !lastName ||
                  !firstName ||
                  !phone ||
                  !telegram ||
                  (!passportFile && !previewUrl)
                }
                className="w-full rounded-xl bg-[#FFDD2D] py-6 text-sm font-bold text-black hover:bg-[#e6c625] transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? "Отправка..."
                  : verificationStatus === "rejected"
                    ? "Исправить и отправить снова"
                    : "Сохранить и отправить на проверку"}
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
