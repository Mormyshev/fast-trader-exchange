"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import OperatorAvatar from "@/src/components/Chat/OperatorAvatar";
import StaffPageHeader from "@/src/components/staff/StaffPageHeader";
import PasswordInput from "@/src/components/PasswordInput/PasswordInput";
import { useAuth } from "@/src/app/context/AuthContext";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";
import { staffPositionLabel } from "@/src/utils/staff/permissions";
import {
  validateEmail,
  validateOperatorPseudonym,
  validatePassword,
  validatePasswordConfirm,
} from "@/src/utils/validation";
import { CHAT_NICKS, parseChatNick } from "@/src/utils/staff/chat-nicks";

type StaffRow = {
  id: string;
  email: string;
  role: "operator" | "admin";
  operator_pseudonym: string | null;
  chat_pseudonym: string | null;
  staff_active: boolean | null;
  is_senior_operator: boolean | null;
};

type FormState = {
  email: string;
  password: string;
  passwordConfirm: string;
  pseudonym: string;
  chatPseudonym: string;
  isSeniorOperator: boolean;
};

const emptyForm: FormState = {
  email: "",
  password: "",
  passwordConfirm: "",
  pseudonym: "",
  chatPseudonym: "",
  isSeniorOperator: false,
};

const fieldClass =
  "w-full h-12 rounded-2xl border bg-[#F4F5F7] px-4 text-sm font-semibold text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#FFDD2D] focus:bg-white";

function ChatNickSelect({
  value,
  disabled,
  taken,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  taken: string[];
  onChange: (next: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`${fieldClass} ${disabled ? "opacity-60" : ""}`}
    >
      <option value="">Выберите ник</option>
      {CHAT_NICKS.map((nick) => {
        const busy = taken.includes(nick) && nick !== value;
        return (
          <option key={nick} value={nick} disabled={busy}>
            {nick}
            {busy ? " · занят" : ""}
          </option>
        );
      })}
    </select>
  );
}

function positionLabel(row: StaffRow) {
  return staffPositionLabel(row);
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-400"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-zinc-300"}`}
      />
      {active ? "Активный" : "Неактивный"}
    </span>
  );
}

function NicknameField({
  value,
  disabled,
  compact,
  onCommit,
}: {
  value: string;
  disabled?: boolean;
  compact?: boolean;
  onCommit: (next: string) => boolean | void | Promise<boolean | void>;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = async () => {
    const check = validateOperatorPseudonym(draft);
    if (!check.ok) {
      if (draft.trim()) alert(check.error);
      setDraft(value);
      return;
    }
    if (check.value === value.trim()) {
      setDraft(value);
      return;
    }
    const saved = await onCommit(check.value);
    if (saved === false) setDraft(value);
  };

  return (
    <input
      type="text"
      value={draft}
      disabled={disabled}
      maxLength={32}
      placeholder="Например: Алекс"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className={`${fieldClass} ${compact ? "h-10 rounded-xl" : ""}`}
    />
  );
}

export default function AdminOperatorsManager() {
  const { user } = useAuth();
  const { confirm, ConfirmDialogHost } = useConfirmDialog();
  const [operators, setOperators] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingForm, setSavingForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/operators", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось загрузить");
      setOperators((json.operators ?? []) as StaffRow[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyRow = (next: StaffRow) => {
    setOperators((prev) => {
      const without = prev.filter((row) => row.id !== next.id);
      return [...without, next].sort((a, b) => {
        if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
        if (!!a.is_senior_operator !== !!b.is_senior_operator) {
          return a.is_senior_operator ? -1 : 1;
        }
        const nameA = (a.operator_pseudonym || a.email).toLocaleLowerCase("ru");
        const nameB = (b.operator_pseudonym || b.email).toLocaleLowerCase("ru");
        return nameA.localeCompare(nameB, "ru");
      });
    });
    if (next.id === user?.id) {
      window.dispatchEvent(
        new CustomEvent("operator-profile-updated", {
          detail: { pseudonym: next.operator_pseudonym },
        }),
      );
    }
  };

  const takenChatNicks = useMemo(
    () =>
      operators
        .map((row) => row.chat_pseudonym?.trim())
        .filter((value): value is string => Boolean(value)),
    [operators],
  );

  const handleAssign = async (row: StaffRow, nextName: string) => {
    if (!nextName || nextName === (row.operator_pseudonym || "")) return true;
    const ok = await confirm({
      title: "Сменить внутренний ник?",
      description: `В панели ${row.email} будет отображаться как «${nextName}». Клиенты этот ник не увидят.`,
      confirmLabel: "Сохранить",
    });
    if (!ok) return false;

    setSavingId(row.id);
    try {
      const res = await fetch(`/api/admin/operators/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator_pseudonym: nextName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось сохранить");
      applyRow(json.operator as StaffRow);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось сохранить");
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const handleAssignChatNick = async (row: StaffRow, nextName: string) => {
    if (!nextName || nextName === (row.chat_pseudonym || "")) return;
    const parsed = parseChatNick(nextName);
    if (!parsed.ok) {
      await confirm({
        title: "Некорректный ник",
        description: parsed.error,
        variant: "info",
      });
      return;
    }
    const ok = await confirm({
      title: "Сменить ник для чата?",
      description: `Клиенты будут видеть «${parsed.value}», когда этот сотрудник возьмёт чат.`,
      confirmLabel: "Сохранить",
    });
    if (!ok) return;

    setSavingId(row.id);
    try {
      const res = await fetch(`/api/admin/operators/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_pseudonym: parsed.value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось сохранить");
      applyRow(json.operator as StaffRow);
    } catch (err) {
      await confirm({
        title: "Не удалось сохранить",
        description: err instanceof Error ? err.message : "Не удалось сохранить",
        variant: "info",
      });
    } finally {
      setSavingId(null);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setDialog("create");
  };

  const openEdit = (row: StaffRow) => {
    setEditing(row);
    setForm({
      email: row.email,
      password: "",
      passwordConfirm: "",
      pseudonym: row.operator_pseudonym || "",
      chatPseudonym: row.chat_pseudonym || "",
      isSeniorOperator: row.role === "operator" && !!row.is_senior_operator,
    });
    setFormError(null);
    setDialog("edit");
  };

  const closeDialog = () => {
    if (savingForm) return;
    setDialog(null);
    setEditing(null);
    setFormError(null);
  };

  const submitForm = async () => {
    setFormError(null);

    if (dialog === "create" || editing?.role === "operator") {
      const emailCheck = validateEmail(form.email);
      if (!emailCheck.ok) {
        setFormError(emailCheck.error);
        return;
      }
    }

    if (dialog === "create") {
      const passwordCheck = validatePassword(form.password);
      if (!passwordCheck.ok) {
        setFormError(passwordCheck.error);
        return;
      }
      const confirmCheck = validatePasswordConfirm(
        form.password,
        form.passwordConfirm,
      );
      if (!confirmCheck.ok) {
        setFormError(confirmCheck.error);
        return;
      }
    } else if (form.password) {
      const passwordCheck = validatePassword(form.password);
      if (!passwordCheck.ok) {
        setFormError(passwordCheck.error);
        return;
      }
    }

    const nickCheck = validateOperatorPseudonym(form.pseudonym);
    if (!nickCheck.ok) {
      setFormError(nickCheck.error);
      return;
    }
    const chatNickCheck = parseChatNick(form.chatPseudonym);
    if (!chatNickCheck.ok) {
      setFormError(chatNickCheck.error);
      return;
    }

    setSavingForm(true);
    try {
      if (dialog === "create") {
        const res = await fetch("/api/admin/operators", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            password_confirm: form.passwordConfirm,
            operator_pseudonym: nickCheck.value,
            chat_pseudonym: chatNickCheck.value,
            is_senior_operator: form.isSeniorOperator,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Не удалось создать");
        applyRow(json.operator as StaffRow);
      } else if (editing) {
        const payload: Record<string, string | boolean> = {
          operator_pseudonym: nickCheck.value,
          chat_pseudonym: chatNickCheck.value,
        };
        if (editing.role === "operator") {
          payload.email = form.email;
          payload.is_senior_operator = form.isSeniorOperator;
          if (form.password) payload.password = form.password;
        }
        const res = await fetch(`/api/admin/operators/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Не удалось сохранить");
        applyRow(json.operator as StaffRow);
      }
      setDialog(null);
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSavingForm(false);
    }
  };

  const handleDelete = async (row: StaffRow) => {
    const ok = await confirm({
      title: "Удалить оператора?",
      description: `${row.email} потеряет доступ к панели. Заявки в работе нужно сначала завершить или переназначить.`,
      confirmLabel: "Удалить",
      variant: "destructive",
    });
    if (!ok) return;

    setSavingId(row.id);
    try {
      const res = await fetch(`/api/admin/operators/${row.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось удалить");
      setOperators((prev) => prev.filter((item) => item.id !== row.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось удалить");
    } finally {
      setSavingId(null);
    }
  };

  const previewName = form.chatPseudonym.trim() || "Ник для чата";
  const isCreate = dialog === "create";
  const accountFields = isCreate || editing?.role === "operator";

  const renderActions = (row: StaffRow, compact = false) => {
    const busy = savingId === row.id;
    return (
      <div className={compact ? "grid grid-cols-2 gap-2" : "flex items-center justify-end gap-2"}>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => openEdit(row)}
          className={`rounded-full font-bold border-zinc-200 shadow-none ${
            compact ? "h-10 text-xs w-full" : "h-9 px-4 text-xs"
          }`}
        >
          <Pencil className="w-3.5 h-3.5 mr-1.5" />
          Изменить
        </Button>
        {row.role === "operator" ? (
          <Button
            type="button"
            disabled={busy}
            onClick={() => void handleDelete(row)}
            className={`rounded-full font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-none ${
              compact ? "h-10 text-xs w-full" : "h-9 px-4 text-xs"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Удалить
          </Button>
        ) : compact ? (
          <div />
        ) : null}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFDD2D]" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 sm:space-y-6 lg:space-y-8 text-zinc-900 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
            <Users className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <StaffPageHeader
            title="Операторы"
            description="Внутренние ники, ники для чата и доступ операторов"
          />
        </div>
        <Button
          type="button"
          onClick={openCreate}
          className="rounded-full h-10 px-5 font-bold bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 shadow-none self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Новый оператор
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {operators.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 sm:p-12 text-center shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
          <p className="text-sm font-semibold text-zinc-700">Операторов пока нет</p>
          <p className="mt-1 text-xs font-medium text-zinc-400">
            Создайте первого оператора и задайте ему ники
          </p>
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {operators.map((row) => {
              const busy = savingId === row.id;
              return (
                <div
                  key={row.id}
                  className="rounded-2xl bg-white p-4 shadow-[0_4px_24px_rgba(15,23,42,0.04)] space-y-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <OperatorAvatar
                      name={row.operator_pseudonym || row.email}
                      className="w-11 h-11"
                      profile={row}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="truncate text-sm font-bold text-zinc-900">
                          {row.operator_pseudonym || "Без ника"}
                        </p>
                        {row.id === user?.id ? (
                          <span className="shrink-0 rounded-full bg-[#FFF4C2] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#C9A227]">
                            Вы
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-zinc-500 break-all">
                        {row.email}
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-zinc-400">
                        {positionLabel(row)}
                      </p>
                    </div>
                    <StatusBadge active={!!row.staff_active} />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Внутренний ник
                      </p>
                      <NicknameField
                        value={row.operator_pseudonym || ""}
                        disabled={busy}
                        compact
                        onCommit={(next) => handleAssign(row, next)}
                      />
                    </div>
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Ник для чата
                      </p>
                      <ChatNickSelect
                        value={row.chat_pseudonym || ""}
                        disabled={busy}
                        taken={takenChatNicks}
                        onChange={(next) => void handleAssignChatNick(row, next)}
                      />
                    </div>
                  </div>
                  {renderActions(row, true)}
                </div>
              );
            })}
          </div>

          <div className="hidden md:block overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left">
                <thead>
                  <tr className="bg-zinc-50/80 border-b border-zinc-100">
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Оператор
                    </th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      E-mail
                    </th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Статус
                    </th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Ник
                    </th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Ник для чата
                    </th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 text-right">
                      Действие
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map((row) => {
                    const busy = savingId === row.id;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <OperatorAvatar
                              name={row.operator_pseudonym || row.email}
                              className="w-10 h-10"
                              profile={row}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="truncate text-sm font-bold text-zinc-900">
                                  {row.operator_pseudonym || "Без ника"}
                                </p>
                                {row.id === user?.id ? (
                                  <span className="shrink-0 rounded-full bg-[#FFF4C2] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#C9A227]">
                                    Вы
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-0.5 text-[11px] font-semibold text-zinc-400">
                                {positionLabel(row)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-zinc-600">
                          {row.email}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge active={!!row.staff_active} />
                        </td>
                        <td className="px-5 py-4 min-w-[180px]">
                          <NicknameField
                            value={row.operator_pseudonym || ""}
                            disabled={busy}
                            compact
                            onCommit={(next) => handleAssign(row, next)}
                          />
                        </td>
                        <td className="px-5 py-4 min-w-[180px]">
                          <ChatNickSelect
                            value={row.chat_pseudonym || ""}
                            disabled={busy}
                            taken={takenChatNicks}
                            onChange={(next) => void handleAssignChatNick(row, next)}
                          />
                        </td>
                        <td className="px-5 py-4 text-right">
                          {renderActions(row)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-[440px] gap-5">
          <div>
            <div className="flex size-12 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
              {isCreate ? (
                <UserRound className="size-6" />
              ) : (
                <Pencil className="size-6" />
              )}
            </div>
            <DialogHeader className="mt-4 gap-1.5 pr-0">
              <DialogTitle className="text-xl">
                {isCreate ? "Новый оператор" : "Изменить оператора"}
              </DialogTitle>
              <DialogDescription>
                {isCreate
                  ? "Создайте доступ, задайте внутренний ник и ник для чата."
                  : editing?.role === "admin"
                    ? "Администратору можно задать внутренний ник и ник для чата."
                    : "Можно сменить e-mail, пароль, ники и должность."}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-[#FFF8D6] px-4 py-3.5">
            <OperatorAvatar
              name={previewName}
              className="w-11 h-11"
              profile={{
                role: editing?.role ?? "operator",
                is_senior_operator: form.isSeniorOperator,
              }}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Ник в чате с клиентом
              </p>
              <p className="mt-0.5 text-base font-bold text-zinc-900 truncate">
                {previewName}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {accountFields ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  E-mail
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className={fieldClass}
                  autoComplete="off"
                />
              </div>
            ) : null}

            {accountFields ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  {isCreate ? "Пароль" : "Новый пароль"}
                </label>
                <PasswordInput
                  value={form.password}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder={
                    dialog === "edit" ? "Оставьте пустым, чтобы не менять" : ""
                  }
                  className={fieldClass}
                  autoComplete="new-password"
                />
              </div>
            ) : null}

            {isCreate ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Повтор пароля
                </label>
                <PasswordInput
                  value={form.passwordConfirm}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      passwordConfirm: e.target.value,
                    }))
                  }
                  className={fieldClass}
                  autoComplete="new-password"
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Внутренний ник
              </label>
              <input
                type="text"
                value={form.pseudonym}
                maxLength={32}
                placeholder="Например: Иванов"
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, pseudonym: e.target.value }))
                }
                className={fieldClass}
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Ник для чата
              </label>
              <ChatNickSelect
                value={form.chatPseudonym}
                taken={takenChatNicks.filter(
                  (nick) => nick !== editing?.chat_pseudonym,
                )}
                onChange={(next) =>
                  setForm((prev) => ({ ...prev, chatPseudonym: next }))
                }
              />
            </div>

            {accountFields ? (
              <label className="flex items-start gap-3 rounded-2xl bg-[#F4F5F7] px-4 py-3.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isSeniorOperator}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isSeniorOperator: e.target.checked,
                    }))
                  }
                  className="mt-0.5 size-4 rounded border-zinc-300 accent-[#FFDD2D]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-zinc-900">
                    Старший оператор
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-zinc-500">
                    Может передавать заявки другим операторам и верифицировать клиентов
                  </span>
                </span>
              </label>
            ) : null}

            {formError ? (
              <p className="text-sm font-medium text-rose-600">{formError}</p>
            ) : null}
          </div>

          <DialogFooter className="flex-col-reverse gap-2.5 sm:flex-col-reverse sm:justify-stretch">
            <Button
              type="button"
              variant="outline"
              disabled={savingForm}
              onClick={closeDialog}
              className="h-11 w-full rounded-xl border-zinc-200 px-5 font-bold text-zinc-700 hover:bg-zinc-50"
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={savingForm}
              onClick={() => void submitForm()}
              className="h-11 w-full rounded-xl bg-[#FFDD2D] px-5 font-bold text-zinc-900 shadow-none hover:bg-[#e6c628]"
            >
              {savingForm ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Сохранение...
                </>
              ) : (
                "Сохранить"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialogHost />
    </div>
  );
}
