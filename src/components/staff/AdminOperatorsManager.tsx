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
import { useAuth } from "@/src/app/context/AuthContext";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";
import { OPERATOR_PSEUDONYMS } from "@/src/utils/staff/pseudonyms";
import { availablePseudonyms } from "@/src/utils/staff/operators-admin";
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from "@/src/utils/validation";

type StaffRow = {
  id: string;
  email: string;
  role: "operator" | "admin";
  operator_pseudonym: string | null;
  staff_active: boolean | null;
};

type FormState = {
  email: string;
  password: string;
  passwordConfirm: string;
  pseudonym: string;
};

const emptyForm: FormState = {
  email: "",
  password: "",
  passwordConfirm: "",
  pseudonym: "",
};

const fieldClass =
  "w-full h-12 rounded-2xl border bg-[#F4F5F7] px-4 text-sm font-semibold text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#FFDD2D] focus:bg-white";

function roleLabel(role: StaffRow["role"]) {
  return role === "admin" ? "Админ" : "Оператор";
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

function PseudonymSelect({
  value,
  options,
  extraCurrent,
  disabled,
  onChange,
}: {
  value: string;
  options: string[];
  extraCurrent?: string | null;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`${fieldClass} disabled:opacity-60`}
    >
      <option value="" disabled>
        Выберите из списка
      </option>
      {extraCurrent ? (
        <option value={extraCurrent}>{extraCurrent} (текущий)</option>
      ) : null}
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
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

  const takenNames = useMemo(
    () => operators.map((row) => row.operator_pseudonym),
    [operators],
  );

  const applyRow = (next: StaffRow) => {
    setOperators((prev) => {
      const without = prev.filter((row) => row.id !== next.id);
      return [...without, next].sort((a, b) => {
        if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
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

  const handleAssign = async (row: StaffRow, nextName: string) => {
    if (!nextName || nextName === (row.operator_pseudonym || "")) return;
    const ok = await confirm({
      title: "Назначить псевдоним?",
      description: `${row.email} будет отображаться клиентам как «${nextName}».`,
      confirmLabel: "Назначить",
    });
    if (!ok) return;

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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось сохранить");
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

    if (!form.pseudonym) {
      setFormError("Выберите псевдоним");
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
            operator_pseudonym: form.pseudonym,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Не удалось создать");
        applyRow(json.operator as StaffRow);
      } else if (editing) {
        const payload: Record<string, string> = {
          operator_pseudonym: form.pseudonym,
        };
        if (editing.role === "operator") {
          payload.email = form.email;
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

  const dialogOptions = availablePseudonyms(
    takenNames,
    dialog === "edit" ? editing?.operator_pseudonym : null,
  );
  const extraCurrent =
    editing?.operator_pseudonym &&
    !OPERATOR_PSEUDONYMS.includes(
      editing.operator_pseudonym as (typeof OPERATOR_PSEUDONYMS)[number],
    )
      ? editing.operator_pseudonym
      : null;

  const previewName = form.pseudonym.trim() || "Оператор";
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
            description="Псевдонимы из списка и доступ операторов к панели"
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
            Создайте первого оператора и назначьте псевдоним из списка
          </p>
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {operators.map((row) => {
              const options = availablePseudonyms(
                takenNames,
                row.operator_pseudonym,
              );
              const extra =
                row.operator_pseudonym &&
                !OPERATOR_PSEUDONYMS.includes(
                  row.operator_pseudonym as (typeof OPERATOR_PSEUDONYMS)[number],
                )
                  ? row.operator_pseudonym
                  : null;
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
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="truncate text-sm font-bold text-zinc-900">
                          {row.operator_pseudonym || "Без псевдонима"}
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
                    </div>
                    <StatusBadge active={!!row.staff_active} />
                  </div>
                  <div>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Псевдоним для клиентов
                    </p>
                    <PseudonymSelect
                      value={row.operator_pseudonym || ""}
                      options={options}
                      extraCurrent={extra}
                      disabled={busy}
                      onChange={(next) => void handleAssign(row, next)}
                    />
                  </div>
                  {renderActions(row, true)}
                </div>
              );
            })}
          </div>

          <div className="hidden md:block overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
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
                      Псевдоним
                    </th>
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 text-right">
                      Действие
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map((row) => {
                    const options = availablePseudonyms(
                      takenNames,
                      row.operator_pseudonym,
                    );
                    const extra =
                      row.operator_pseudonym &&
                      !OPERATOR_PSEUDONYMS.includes(
                        row.operator_pseudonym as (typeof OPERATOR_PSEUDONYMS)[number],
                      )
                        ? row.operator_pseudonym
                        : null;
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
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="truncate text-sm font-bold text-zinc-900">
                                  {row.operator_pseudonym || "Без псевдонима"}
                                </p>
                                {row.id === user?.id ? (
                                  <span className="shrink-0 rounded-full bg-[#FFF4C2] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#C9A227]">
                                    Вы
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-0.5 text-[11px] font-semibold text-zinc-400">
                                {roleLabel(row.role)}
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
                        <td className="px-5 py-4 min-w-[200px]">
                          <PseudonymSelect
                            value={row.operator_pseudonym || ""}
                            options={options}
                            extraCurrent={extra}
                            disabled={busy}
                            onChange={(next) => void handleAssign(row, next)}
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
                  ? "Создайте доступ и сразу назначьте псевдоним из списка."
                  : editing?.role === "admin"
                    ? "Администратору можно назначить только псевдоним."
                    : "Можно сменить e-mail, пароль и псевдоним."}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-[#FFF8D6] px-4 py-3.5">
            <OperatorAvatar name={previewName} className="w-11 h-11" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Как видит клиент
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
                <input
                  type="password"
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
                <input
                  type="password"
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
                Псевдоним
              </label>
              <PseudonymSelect
                value={form.pseudonym}
                options={dialogOptions}
                extraCurrent={extraCurrent}
                onChange={(next) =>
                  setForm((prev) => ({ ...prev, pseudonym: next }))
                }
              />
            </div>

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
