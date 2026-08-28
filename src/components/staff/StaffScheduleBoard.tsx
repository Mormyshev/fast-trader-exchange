"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
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
import StaffNativeSelect from "@/src/components/staff/StaffNativeSelect";
import { useAuth } from "@/src/app/context/AuthContext";
import {
  WEEKDAYS,
  formatShiftRange,
  isoWeekday,
  isShiftActiveNow,
  weekdayLabel,
  type ScheduleShift,
} from "@/src/utils/staff/schedule";

type ScheduleOperator = {
  id: string;
  email: string;
  operator_pseudonym: string | null;
  staff_active: boolean;
};

type CellTarget = {
  operator: ScheduleOperator;
  weekday: number;
  shift: ScheduleShift | null;
};

const fieldClass =
  "w-full h-12 rounded-2xl border bg-[#F4F5F7] px-4 text-sm font-semibold text-zinc-900 outline-none transition-colors focus:border-[#FFDD2D] focus:bg-white";

function shiftsByOperator(shifts: ScheduleShift[]) {
  const map = new Map<string, Map<number, ScheduleShift>>();
  for (const shift of shifts) {
    const row = map.get(shift.operator_id) ?? new Map<number, ScheduleShift>();
    row.set(shift.weekday, shift);
    map.set(shift.operator_id, row);
  }
  return map;
}

export default function StaffScheduleBoard() {
  const { user, role } = useAuth();
  const canEdit = role === "admin";
  const today = isoWeekday();

  const [operators, setOperators] = useState<ScheduleOperator[]>([]);
  const [shifts, setShifts] = useState<ScheduleShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState<CellTarget | null>(null);
  const [startsAt, setStartsAt] = useState("10:00");
  const [endsAt, setEndsAt] = useState("22:00");
  const [applyTo, setApplyTo] = useState<"day" | "weekdays" | "week">("day");
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/schedule", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось загрузить график");
      setOperators((json.operators ?? []) as ScheduleOperator[]);
      setShifts((json.shifts ?? []) as ScheduleShift[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить график");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grid = useMemo(() => shiftsByOperator(shifts), [shifts]);
  const myOperator = useMemo(
    () => operators.find((operator) => operator.id === user?.id) ?? null,
    [operators, user?.id],
  );
  const otherOperators = useMemo(
    () => operators.filter((operator) => operator.id !== user?.id),
    [operators, user?.id],
  );
  const splitForOperator = !canEdit;

  const openCell = (operator: ScheduleOperator, weekday: number) => {
    if (!canEdit) return;
    const shift = grid.get(operator.id)?.get(weekday) ?? null;
    setTarget({ operator, weekday, shift });
    setStartsAt(shift?.starts_at ?? "10:00");
    setEndsAt(shift?.ends_at ?? "22:00");
    setApplyTo("day");
    setFormError(null);
  };

  const weekdaysForSave = () => {
    if (!target) return [];
    if (applyTo === "week") return WEEKDAYS.map((day) => day.id);
    if (applyTo === "weekdays") return [1, 2, 3, 4, 5];
    return [target.weekday];
  };

  const saveShift = async (off: boolean) => {
    if (!target) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operator_id: target.operator.id,
          weekdays: weekdaysForSave(),
          starts_at: startsAt,
          ends_at: endsAt,
          off,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось сохранить");
      setTarget(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const renderCell = (operator: ScheduleOperator, weekday: number) => {
    const shift = grid.get(operator.id)?.get(weekday) ?? null;
    const isToday = weekday === today;
    const onNow = Boolean(shift && isToday && isShiftActiveNow(shift));
    const content = shift ? formatShiftRange(shift) : "Выходной";

    const className = `w-full min-h-11 rounded-xl px-2 py-2 text-center text-[11px] sm:text-xs font-bold leading-tight transition-colors ${
      onNow
        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
        : shift
          ? "bg-[#FFF8D6] text-zinc-800 border border-amber-100"
          : "bg-zinc-50 text-zinc-400 border border-zinc-100"
    } ${canEdit ? "hover:border-[#FFDD2D] cursor-pointer" : ""} ${
      isToday && !onNow ? "ring-1 ring-[#FFDD2D]/70" : ""
    }`;

    if (!canEdit) {
      return <div className={className}>{content}</div>;
    }

    return (
      <button
        type="button"
        onClick={() => openCell(operator, weekday)}
        className={className}
      >
        {content}
      </button>
    );
  };

  const operatorName = (operator: ScheduleOperator) =>
    operator.operator_pseudonym || operator.email;

  const todayStatus = (operator: ScheduleOperator) => {
    const shift = grid.get(operator.id)?.get(today) ?? null;
    if (shift && isShiftActiveNow(shift)) return "Сейчас на смене";
    if (shift) return `Сегодня ${formatShiftRange(shift)}`;
    return "Сегодня выходной";
  };

  const renderOperatorIdentity = (
    operator: ScheduleOperator,
    { showMeBadge = false }: { showMeBadge?: boolean } = {},
  ) => {
    const name = operatorName(operator);
    const isMe = operator.id === user?.id;
    return (
      <div className="flex items-center gap-3 min-w-0">
        <OperatorAvatar name={name} className="w-9 h-9" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="truncate text-sm font-bold text-zinc-900">{name}</p>
            {showMeBadge && isMe ? (
              <span className="shrink-0 rounded-full bg-[#FFF4C2] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#C9A227]">
                Вы
              </span>
            ) : null}
          </div>
          <p className="text-[11px] font-medium text-zinc-400 truncate">
            {operator.email}
          </p>
        </div>
      </div>
    );
  };

  const renderMobileCards = (list: ScheduleOperator[]) => (
    <div className="md:hidden space-y-3">
      {list.map((operator) => (
        <div
          key={operator.id}
          className="rounded-2xl bg-white p-4 shadow-[0_4px_24px_rgba(15,23,42,0.04)] space-y-3"
        >
          {renderOperatorIdentity(operator)}
          <div className="grid grid-cols-2 gap-2">
            {WEEKDAYS.map((day) => (
              <div key={day.id} className="space-y-1">
                <p
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    day.id === today ? "text-[#C9A227]" : "text-zinc-400"
                  }`}
                >
                  {day.short}
                  {day.id === today ? " · сегодня" : ""}
                </p>
                {renderCell(operator, day.id)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderDesktopTable = (list: ScheduleOperator[]) => (
    <div className="hidden md:block overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left">
          <thead>
            <tr className="bg-zinc-50/80 border-b border-zinc-100">
              <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 w-56">
                Оператор
              </th>
              {WEEKDAYS.map((day) => (
                <th
                  key={day.id}
                  className={`px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-wider ${
                    day.id === today ? "text-[#C9A227]" : "text-zinc-400"
                  }`}
                >
                  {day.short}
                  {day.id === today ? " · сегодня" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((operator) => (
              <tr
                key={operator.id}
                className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50"
              >
                <td className="px-5 py-3">{renderOperatorIdentity(operator)}</td>
                {WEEKDAYS.map((day) => (
                  <td key={day.id} className="px-2 py-2">
                    {renderCell(operator, day.id)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderOperatorList = (list: ScheduleOperator[]) => (
    <>
      {renderMobileCards(list)}
      {renderDesktopTable(list)}
    </>
  );

  const renderMySchedule = (operator: ScheduleOperator) => (
    <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {renderOperatorIdentity(operator, { showMeBadge: true })}
        <p className="text-xs font-bold text-zinc-500 sm:text-right">
          {todayStatus(operator)}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {WEEKDAYS.map((day) => (
          <div key={day.id} className="space-y-1.5">
            <p
              className={`text-[10px] font-bold uppercase tracking-wider ${
                day.id === today ? "text-[#C9A227]" : "text-zinc-400"
              }`}
            >
              {day.short}
              {day.id === today ? " · сегодня" : ""}
            </p>
            {renderCell(operator, day.id)}
          </div>
        ))}
      </div>
    </div>
  );

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
            <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <StaffPageHeader
            title="График операторов"
            description={
              canEdit
                ? "Нажмите на ячейку, чтобы поставить смену или выходной. Операторы видят этот график целиком."
                : "Сначала ваши смены, ниже — график остальных операторов"
            }
          />
        </div>
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
            Сначала добавьте операторов в разделе «Операторы»
          </p>
        </div>
      ) : splitForOperator ? (
        <div className="space-y-6 sm:space-y-8">
          <section className="space-y-3">
            <h2 className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Мой график
            </h2>
            {myOperator ? (
              renderMySchedule(myOperator)
            ) : (
              <div className="rounded-2xl bg-white p-6 text-sm font-medium text-zinc-500 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
                Ваша смена в общем графике не найдена
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Остальные операторы
              {otherOperators.length > 0 ? ` (${otherOperators.length})` : ""}
            </h2>
            {otherOperators.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-sm font-medium text-zinc-500 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
                Других операторов пока нет
              </div>
            ) : (
              renderOperatorList(otherOperators)
            )}
          </section>
        </div>
      ) : (
        renderOperatorList(operators)
      )}

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-[440px] gap-5">
          <div>
            <div className="flex size-12 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
              <CalendarDays className="size-6" />
            </div>
            <DialogHeader className="mt-4 gap-1.5 pr-0">
              <DialogTitle className="text-xl">Смена</DialogTitle>
              <DialogDescription>
                {target
                  ? `${target.operator.operator_pseudonym || target.operator.email} · ${weekdayLabel(target.weekday, "full")}`
                  : ""}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Начало
              </label>
              <input
                type="time"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Конец
              </label>
              <input
                type="time"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Применить
            </label>
            <StaffNativeSelect
              value={applyTo}
              onChange={(e) =>
                setApplyTo(e.target.value as "day" | "weekdays" | "week")
              }
            >
              <option value="day">Только этот день</option>
              <option value="weekdays">Все будни (Пн–Пт)</option>
              <option value="week">Всю неделю</option>
            </StaffNativeSelect>
          </div>

          {formError ? (
            <p className="text-sm font-medium text-rose-600">{formError}</p>
          ) : null}

          <DialogFooter className="flex-col-reverse gap-2.5 sm:flex-col-reverse sm:justify-stretch">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setTarget(null)}
              className="h-11 w-full rounded-xl border-zinc-200 px-5 font-bold text-zinc-700 hover:bg-zinc-50"
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void saveShift(true)}
              className="h-11 w-full rounded-xl bg-zinc-100 px-5 font-bold text-zinc-700 shadow-none hover:bg-zinc-200"
            >
              Выходной
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void saveShift(false)}
              className="h-11 w-full rounded-xl bg-[#FFDD2D] px-5 font-bold text-zinc-900 shadow-none hover:bg-[#e6c628]"
            >
              {saving ? "Сохранение..." : "Сохранить смену"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
