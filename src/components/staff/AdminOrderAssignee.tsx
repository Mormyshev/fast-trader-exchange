"use client";

import { useEffect, useMemo, useState } from "react";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import StaffNativeSelect from "@/src/components/staff/StaffNativeSelect";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";
import { STAFF_INACTIVE_ERROR } from "@/src/utils/staff/duty";
import { staffPositionLabelShort } from "@/src/utils/staff/permissions";

type StaffMember = {
  id: string;
  role: "operator" | "admin";
  operator_pseudonym: string | null;
  staff_active: boolean;
  is_senior_operator?: boolean | null;
};

function memberLabel(member: StaffMember) {
  const name = member.operator_pseudonym?.trim() || "Без псевдонима";
  const role = staffPositionLabelShort(member);
  return member.staff_active
    ? `${name} (${role})`
    : `${name} (${role}, неактивен)`;
}

export default function AdminOrderAssignee({
  orderId,
  currentOperatorId,
  staffActive,
  onAssigned,
}: {
  orderId: string;
  currentOperatorId: string | null;
  staffActive: boolean;
  onAssigned: (order: unknown) => void;
}) {
  const { confirm, ConfirmDialogHost } = useConfirmDialog();
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [selectedId, setSelectedId] = useState(currentOperatorId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedId(currentOperatorId ?? "");
  }, [currentOperatorId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/operator/roster", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Не удалось загрузить команду");
        if (!cancelled) {
          setMembers((json.operators ?? []) as StaffMember[]);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => members.find((member) => member.id === selectedId) ?? null,
    [members, selectedId],
  );

  const canSubmit =
    staffActive &&
    !!selectedId &&
    selectedId !== (currentOperatorId ?? "") &&
    !!selected?.staff_active;

  const handleAssign = async () => {
    if (!canSubmit || !selected) return;
    if (!staffActive) {
      alert(STAFF_INACTIVE_ERROR);
      return;
    }

    const ok = await confirm({
      title: "Сменить оператора заявки?",
      description: `Заявку получит ${memberLabel(selected)}. Он сможет продолжить обработку: реквизиты, проверка чека и завершение.`,
      confirmLabel: "Назначить",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator_id: selectedId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось сменить оператора");
      onAssigned(json.order);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось сменить оператора");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl bg-[#F4F5F7] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-zinc-400" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Оператор заявки
          </p>
        </div>
        <p className="text-sm font-medium text-zinc-600">
          Можно передать заявку другому активному оператору. Он продолжит
          обработку: реквизиты, проверка чека и завершение.
        </p>
        <StaffNativeSelect
          value={selectedId}
          disabled={saving || !staffActive || members.length === 0}
          onChange={(e) => setSelectedId(e.target.value)}
          className="h-11 rounded-xl border-zinc-200 bg-white"
        >
          {!currentOperatorId ? (
            <option value="">Не назначен</option>
          ) : null}
          {currentOperatorId &&
          !members.some((member) => member.id === currentOperatorId) ? (
            <option value={currentOperatorId}>Текущий оператор</option>
          ) : null}
          {members.map((member) => (
            <option
              key={member.id}
              value={member.id}
              disabled={!member.staff_active && member.id !== currentOperatorId}
            >
              {memberLabel(member)}
            </option>
          ))}
        </StaffNativeSelect>
        <Button
          type="button"
          disabled={saving || !canSubmit}
          onClick={() => void handleAssign()}
          className="rounded-full h-11 px-6 font-bold bg-zinc-900 hover:bg-zinc-800 text-white shadow-none disabled:opacity-50"
        >
          {saving ? "..." : "Сменить оператора"}
        </Button>
      </div>
      <ConfirmDialogHost />
    </>
  );
}
