"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { CheckCircle2, Clock, AlertTriangle, FileText, X } from "lucide-react";
import { useAuth } from "@/src/app/context/AuthContext";
import { createClient } from "@/src/utils/supabase/client";
import {
    canEditVerification,
    normalizeVerificationStatus,
    type VerificationStatus,
} from "@/src/utils/verification";
import {
    formatPhoneInput,
    formatTelegramInput,
    validateProfileFormField,
    validateProfileFormFields,
    type ProfileFormErrors,
} from "@/src/utils/validation";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";
import { Button } from "@/components/ui/button";

const supabase = createClient();
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const FILE_ACCEPT = ".gif,.jpg,.jpeg,.jpe,.png,image/gif,image/jpeg,image/png";
const FILE_HINT = "(.GIF, .JPG, .JPEG, .JPE, .PNG, макс. 20 МБ)";

const INPUT_CLASS =
    "mt-1.5 block h-16 w-full rounded-2xl border-2 border-[#FFDD2D] bg-white px-4 text-sm font-medium text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#e6c628] focus:ring-2 focus:ring-[#FFDD2D]/40 disabled:cursor-not-allowed disabled:opacity-60";

function inputClass(hasError: boolean) {
    return hasError
        ? `${INPUT_CLASS} border-rose-400 focus:border-rose-500 focus:ring-rose-200`
        : INPUT_CLASS;
}

function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return <p className="mt-1 text-xs font-medium text-rose-500">{message}</p>;
}

function RequiredMark() {
    return <span className="text-rose-500"> *</span>;
}

function statusLabel(status: VerificationStatus) {
    switch (status) {
        case "pending":
            return "На проверке";
        case "verified":
            return "Принята";
        case "rejected":
            return "Отклонена";
        default:
            return "Нет значения";
    }
}

function SelfieIllustration() {
    return (
        <svg
            viewBox="0 0 220 170"
            className="mx-auto h-auto w-full max-w-[200px]"
            aria-hidden
        >
            <rect
                x="8"
                y="18"
                width="204"
                height="140"
                rx="18"
                fill="#FFF8D6"
            />
            <circle cx="88" cy="78" r="28" fill="#FFDD2D" />
            <rect
                x="68"
                y="108"
                width="40"
                height="36"
                rx="16"
                fill="#FFDD2D"
            />
            <rect
                x="118"
                y="54"
                width="70"
                height="86"
                rx="8"
                fill="white"
                stroke="#C9A227"
                strokeWidth="3"
            />
            <rect x="128" y="66" width="50" height="28" rx="4" fill="#FFF4C2" />
            <rect x="128" y="102" width="50" height="6" rx="3" fill="#E5E7EB" />
            <rect x="128" y="114" width="36" height="6" rx="3" fill="#E5E7EB" />
        </svg>
    );
}

function FilePicker({
    label,
    required,
    file,
    previewUrl,
    disabled,
    error,
    onChange,
    onClear,
    hint,
}: {
    label: string;
    required?: boolean;
    file: File | null;
    previewUrl: string | null;
    disabled: boolean;
    error?: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onClear: () => void;
    hint?: string;
}) {
    const name = file?.name || (previewUrl ? "Файл загружен" : null);

    return (
        <div className="space-y-2">
            <p className="text-sm font-semibold text-zinc-800">
                {label}
                {required ? <RequiredMark /> : null}
            </p>
            <p className="text-xs font-medium text-zinc-400">{FILE_HINT}</p>
            {disabled ? (
                <p className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500">
                    <FileText className="h-4 w-4 text-[#C9A227]" />
                    {name || "Файл отправлен"}
                </p>
            ) : (
                <label className="inline-flex h-16 cursor-pointer items-center rounded-full border-2 border-[#FFDD2D] bg-white px-6 text-sm font-bold text-zinc-900 transition-colors hover:bg-[#FFF8D6]">
                    Выбрать файл
                    <input
                        type="file"
                        accept={FILE_ACCEPT}
                        className="sr-only"
                        onChange={onChange}
                    />
                </label>
            )}
            {name && !disabled ? (
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-600">
                    <FileText className="h-4 w-4 shrink-0 text-[#C9A227]" />
                    <span className="truncate">{name}</span>
                    <button
                        type="button"
                        onClick={onClear}
                        className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
                        aria-label="Удалить файл"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            ) : null}
            {previewUrl ? (
                <div className="relative mt-2 h-40 w-full overflow-hidden rounded-xl bg-zinc-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={previewUrl}
                        alt="Превью"
                        className="h-full w-full object-contain"
                    />
                </div>
            ) : null}
            {hint ? (
                <p className="text-xs font-medium leading-relaxed text-zinc-400">
                    {hint}
                </p>
            ) : null}
            <FieldError message={error} />
        </div>
    );
}

export default function ProfilePage() {
    const { user } = useAuth();
    const { confirm, ConfirmDialogHost } = useConfirmDialog();

    const [verificationStatus, setVerificationStatus] =
        useState<VerificationStatus>("not_started");
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submittedAt, setSubmittedAt] = useState<string | null>(null);

    const [lastName, setLastName] = useState("");
    const [firstName, setFirstName] = useState("");
    const [middleName, setMiddleName] = useState("");
    const [documentNumber, setDocumentNumber] = useState("");
    const [phone, setPhone] = useState("");
    const [telegram, setTelegram] = useState("");

    const [passportFile, setPassportFile] = useState<File | null>(null);
    const [selfieFile, setSelfieFile] = useState<File | null>(null);
    const [extraFile, setExtraFile] = useState<File | null>(null);
    const [passportUrl, setPassportUrl] = useState<string | null>(null);
    const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
    const [extraUrl, setExtraUrl] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<ProfileFormErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [rejectionComment, setRejectionComment] = useState<string | null>(
        null,
    );

    const editable = canEditVerification(verificationStatus);

    const applyProfile = (data: Record<string, unknown>) => {
        if (typeof data.last_name === "string") setLastName(data.last_name);
        if (typeof data.first_name === "string") setFirstName(data.first_name);
        if (typeof data.middle_name === "string")
            setMiddleName(data.middle_name);
        if (data.middle_name === null) setMiddleName("");
        if (typeof data.document_number === "string") {
            setDocumentNumber(data.document_number);
        }
        if (typeof data.phone === "string")
            setPhone(formatPhoneInput(data.phone));
        if (typeof data.telegram === "string") setTelegram(data.telegram);
        if (typeof data.passport_url === "string")
            setPassportUrl(data.passport_url);
        if (typeof data.selfie_url === "string") setSelfieUrl(data.selfie_url);
        if (typeof data.extra_document_url === "string") {
            setExtraUrl(data.extra_document_url);
        }
        if (data.verification != null) {
            setVerificationStatus(
                normalizeVerificationStatus(String(data.verification)),
            );
        }
        if (typeof data.verification_rejection_comment === "string") {
            setRejectionComment(data.verification_rejection_comment);
        } else if (data.verification_rejection_comment === null) {
            setRejectionComment(null);
        }
        if (typeof data.updated_at === "string")
            setSubmittedAt(data.updated_at);
    };

    useEffect(() => {
        if (!user?.id) return;
        let cancelled = false;

        async function fetchProfile() {
            try {
                const res = await fetch("/api/profile", { cache: "no-store" });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || "Ошибка загрузки");
                if (cancelled) return;
                if (!json.profile) {
                    setVerificationStatus("not_started");
                    return;
                }
                applyProfile(json.profile);
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
                    applyProfile(payload.new as Record<string, unknown>);
                },
            )
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(profileSubscription);
        };
    }, [user?.id]);

    const getFormInput = () => ({
        lastName,
        firstName,
        middleName,
        documentNumber,
        phone,
        telegram,
    });

    const touchField = (
        field: Exclude<keyof ProfileFormErrors, "passport" | "selfie">,
    ) => {
        const result = validateProfileFormField(field, getFormInput());
        setFieldErrors((prev) => ({
            ...prev,
            [field]: result && !result.ok ? result.error : undefined,
        }));
    };

    const pickFile = (
        e: ChangeEvent<HTMLInputElement>,
        setter: (file: File | null) => void,
        urlSetter: (url: string | null) => void,
        errorKey?: "passport" | "selfie",
    ) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (file.size > MAX_FILE_BYTES) {
            alert("Файл слишком большой. Максимум 20 МБ.");
            return;
        }
        setter(file);
        urlSetter(URL.createObjectURL(file));
        if (errorKey) {
            setFieldErrors((prev) => ({ ...prev, [errorKey]: undefined }));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!user?.id) return alert("Пользователь не авторизован");

        const validation = validateProfileFormFields(getFormInput(), {
            hasPassport: Boolean(passportFile || passportUrl),
            hasSelfie: Boolean(selfieFile || selfieUrl),
        });

        if (!validation.ok) {
            setFieldErrors(validation.errors);
            setFormError(
                Object.values(validation.errors).find(Boolean) ||
                    "Проверьте заполнение полей",
            );
            return;
        }

        setFieldErrors({});
        setFormError(null);

        const ok = await confirm({
            title:
                verificationStatus === "rejected"
                    ? "Отправить исправленную анкету?"
                    : "Отправить запрос на верификацию?",
            description:
                "После отправки форма будет заблокирована до решения оператора.",
            confirmLabel: "Отправить запрос",
        });
        if (!ok) return;

        setIsSubmitting(true);
        const prevStatus = verificationStatus;

        try {
            const form = new FormData();
            form.append("last_name", validation.values.lastName);
            form.append("first_name", validation.values.firstName);
            form.append("middle_name", validation.values.middleName);
            form.append("document_number", validation.values.documentNumber);
            form.append("phone", validation.values.phone);
            form.append("telegram", validation.values.telegram);
            if (
                passportUrl &&
                !passportFile &&
                passportUrl.startsWith("http")
            ) {
                form.append("passport_url", passportUrl);
            }
            if (selfieUrl && !selfieFile && selfieUrl.startsWith("http")) {
                form.append("selfie_url", selfieUrl);
            }
            if (extraUrl && !extraFile && extraUrl.startsWith("http")) {
                form.append("extra_document_url", extraUrl);
            }
            if (passportFile) form.append("passport", passportFile);
            if (selfieFile) form.append("selfie", selfieFile);
            if (extraFile) form.append("extra", extraFile);

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
            if (json.profile) applyProfile(json.profile);
            setPassportFile(null);
            setSelfieFile(null);
            setExtraFile(null);
            alert("Запрос на верификацию отправлен.");
        } catch (err: unknown) {
            alert(
                `Произошла ошибка: ${err instanceof Error ? err.message : "Неизвестная ошибка"}`,
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#FFDD2D] border-t-transparent" />
            </div>
        );
    }

    const hasRequest = verificationStatus !== "not_started";

    return (
        <div className="w-full space-y-5 sm:space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900">
                    Верификация аккаунта
                </h1>
                <span className="text-sm font-semibold text-zinc-500">
                    {user?.email}
                </span>
            </div>

            {verificationStatus === "pending" && (
                <div className="rounded-2xl bg-white px-5 py-4 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
                    <div className="flex items-start gap-3">
                        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                        <div>
                            <p className="text-sm font-bold text-zinc-900">
                                Заявка на проверке
                            </p>
                            <p className="mt-1 text-sm font-medium text-zinc-500">
                                Форма заблокирована до решения оператора. Обычно
                                это занимает от 15 минут до нескольких часов.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {verificationStatus === "rejected" && (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                        <div>
                            <p className="text-sm font-bold text-rose-900">
                                Анкета отклонена
                            </p>
                            <p className="mt-1 text-sm font-medium text-rose-800">
                                Исправьте данные и отправьте запрос повторно.
                            </p>
                            {rejectionComment ? (
                                <p className="mt-2 text-sm font-medium text-rose-700">
                                    {rejectionComment}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {verificationStatus === "verified" && (
                <div className="rounded-2xl bg-white px-5 py-4 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                        <div>
                            <p className="text-sm font-bold text-zinc-900">
                                Профиль верифицирован
                            </p>
                            <p className="mt-1 text-sm font-medium text-zinc-500">
                                Обмен на платформе полностью доступен.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                {formError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                        {formError}
                    </div>
                ) : null}

                <div className="rounded-2xl bg-white p-5 sm:p-7 shadow-[0_4px_24px_rgba(15,23,42,0.04)] space-y-4">
                    <div>
                        <label className="text-sm font-semibold text-zinc-800">
                            Фамилия
                            <RequiredMark />:
                        </label>
                        <input
                            type="text"
                            required
                            disabled={!editable}
                            value={lastName}
                            onChange={(e) => {
                                setLastName(e.target.value);
                                if (fieldErrors.lastName) {
                                    setFieldErrors((prev) => ({
                                        ...prev,
                                        lastName: undefined,
                                    }));
                                }
                            }}
                            onBlur={() => touchField("lastName")}
                            className={inputClass(!!fieldErrors.lastName)}
                        />
                        <FieldError message={fieldErrors.lastName} />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-zinc-800">
                            Имя
                            <RequiredMark />:
                        </label>
                        <input
                            type="text"
                            required
                            disabled={!editable}
                            value={firstName}
                            onChange={(e) => {
                                setFirstName(e.target.value);
                                if (fieldErrors.firstName) {
                                    setFieldErrors((prev) => ({
                                        ...prev,
                                        firstName: undefined,
                                    }));
                                }
                            }}
                            onBlur={() => touchField("firstName")}
                            className={inputClass(!!fieldErrors.firstName)}
                        />
                        <FieldError message={fieldErrors.firstName} />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-zinc-800">
                            Серия номер паспорта или водительского удостоверения
                            <RequiredMark />:
                        </label>
                        <input
                            type="text"
                            required
                            disabled={!editable}
                            value={documentNumber}
                            onChange={(e) => {
                                setDocumentNumber(e.target.value);
                                if (fieldErrors.documentNumber) {
                                    setFieldErrors((prev) => ({
                                        ...prev,
                                        documentNumber: undefined,
                                    }));
                                }
                            }}
                            onBlur={() => touchField("documentNumber")}
                            className={inputClass(!!fieldErrors.documentNumber)}
                        />
                        <FieldError message={fieldErrors.documentNumber} />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-zinc-800">
                            Отчество
                            <RequiredMark />:
                        </label>
                        <input
                            type="text"
                            required
                            disabled={!editable}
                            value={middleName}
                            onChange={(e) => {
                                setMiddleName(e.target.value);
                                if (fieldErrors.middleName) {
                                    setFieldErrors((prev) => ({
                                        ...prev,
                                        middleName: undefined,
                                    }));
                                }
                            }}
                            onBlur={() => touchField("middleName")}
                            className={inputClass(!!fieldErrors.middleName)}
                        />
                        <FieldError message={fieldErrors.middleName} />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-zinc-800">
                            Телефон
                            <RequiredMark />:
                        </label>
                        <input
                            type="tel"
                            required
                            disabled={!editable}
                            value={phone}
                            onChange={(e) => {
                                setPhone(formatPhoneInput(e.target.value));
                                if (fieldErrors.phone) {
                                    setFieldErrors((prev) => ({
                                        ...prev,
                                        phone: undefined,
                                    }));
                                }
                            }}
                            onBlur={() => touchField("phone")}
                            placeholder="+7 (999) 000-00-00"
                            className={inputClass(!!fieldErrors.phone)}
                        />
                        <FieldError message={fieldErrors.phone} />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-zinc-800">
                            Telegram
                            <RequiredMark />:
                        </label>
                        <input
                            type="text"
                            required
                            disabled={!editable}
                            value={telegram}
                            onChange={(e) => {
                                setTelegram(
                                    formatTelegramInput(e.target.value),
                                );
                                if (fieldErrors.telegram) {
                                    setFieldErrors((prev) => ({
                                        ...prev,
                                        telegram: undefined,
                                    }));
                                }
                            }}
                            onBlur={() => touchField("telegram")}
                            placeholder="@username"
                            className={inputClass(!!fieldErrors.telegram)}
                        />
                        <FieldError message={fieldErrors.telegram} />
                    </div>
                </div>

                <h2 className="text-xl font-bold tracking-tight text-zinc-900">
                    Сканы или фотографии документов
                </h2>

                <div className="rounded-2xl bg-white p-5 sm:p-7 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] lg:items-start">
                        <FilePicker
                            label="Фото 2 и 3 страницы паспорта или водительского удостоверения на фоне сайта или листа бумаги"
                            required
                            file={passportFile}
                            previewUrl={passportUrl}
                            disabled={!editable}
                            error={fieldErrors.passport}
                            onChange={(e) =>
                                pickFile(
                                    e,
                                    setPassportFile,
                                    setPassportUrl,
                                    "passport",
                                )
                            }
                            onClear={() => {
                                setPassportFile(null);
                                setPassportUrl(null);
                            }}
                        />
                        <p className="text-sm font-medium leading-relaxed text-zinc-400 lg:pt-1">
                            «На фоне сайта или листа бумаги» означает, что на
                            заднем фоне должен быть виден адрес сайта или лист
                            бумаги, где указаны ваша электронная почта, номер
                            заявки и название обменника Aurum Swap.
                        </p>
                    </div>
                </div>

                <div className="rounded-2xl bg-white p-5 sm:p-7 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] lg:items-center">
                        <FilePicker
                            label="Селфи с разворотом 2-3 страницы паспорта или водительского удостоверения"
                            required
                            file={selfieFile}
                            previewUrl={selfieUrl}
                            disabled={!editable}
                            error={fieldErrors.selfie}
                            onChange={(e) =>
                                pickFile(
                                    e,
                                    setSelfieFile,
                                    setSelfieUrl,
                                    "selfie",
                                )
                            }
                            onClear={() => {
                                setSelfieFile(null);
                                setSelfieUrl(null);
                            }}
                        />
                        <SelfieIllustration />
                    </div>
                </div>

                <div className="rounded-2xl bg-white p-5 sm:p-7 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
                    <FilePicker
                        label="Дополнительное поле для загрузки"
                        file={extraFile}
                        previewUrl={extraUrl}
                        disabled={!editable}
                        onChange={(e) => pickFile(e, setExtraFile, setExtraUrl)}
                        onClear={() => {
                            setExtraFile(null);
                            setExtraUrl(null);
                        }}
                    />
                </div>

                {editable ? (
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="h-16 w-full rounded-full bg-[#FFDD2D] text-sm font-bold text-zinc-900 shadow-none hover:bg-[#e6c628] disabled:opacity-50"
                    >
                        {isSubmitting
                            ? "Отправка..."
                            : verificationStatus === "rejected"
                              ? "Отправить запрос повторно"
                              : "Отправить запрос"}
                    </Button>
                ) : null}
            </form>

            <div className="space-y-3">
                <h2 className="text-lg font-bold text-zinc-900">
                    Заявки на верификацию:
                </h2>
                <div className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-[#FFF4C2] text-xs font-bold uppercase tracking-wider text-zinc-600">
                                <th className="px-5 py-3">Дата</th>
                                <th className="px-5 py-3">Статус</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hasRequest ? (
                                <tr className="border-t border-zinc-100">
                                    <td className="px-5 py-3.5 font-medium text-zinc-800">
                                        {submittedAt
                                            ? new Date(
                                                  submittedAt,
                                              ).toLocaleString("ru-RU", {
                                                  day: "numeric",
                                                  month: "long",
                                                  year: "numeric",
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                              })
                                            : "—"}
                                    </td>
                                    <td className="px-5 py-3.5 font-semibold text-zinc-800">
                                        {statusLabel(verificationStatus)}
                                    </td>
                                </tr>
                            ) : (
                                <tr className="border-t border-zinc-100">
                                    <td
                                        colSpan={2}
                                        className="px-5 py-6 text-center text-sm font-medium text-zinc-400"
                                    >
                                        Нет значения
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex gap-3 rounded-2xl bg-[#FFF8D6] px-5 py-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#C9A227]" />
                <div>
                    <p className="text-sm font-bold text-zinc-900">
                        Отключите VPN перед отправкой документов
                    </p>
                    <p className="mt-1 text-sm font-medium leading-relaxed text-zinc-600">
                        Данные должны совпадать с документом — оператор сверяет
                        анкету вручную.
                    </p>
                </div>
            </div>
            <ConfirmDialogHost />
        </div>
    );
}
