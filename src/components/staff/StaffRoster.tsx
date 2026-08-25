"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import OperatorAvatar from "@/src/components/Chat/OperatorAvatar";
import { useAuth } from "@/src/app/context/AuthContext";

type StaffMember = {
  id: string;
  role: "operator" | "admin";
  operator_pseudonym: string | null;
  staff_active: boolean;
};

function roleLabel(role: StaffMember["role"]) {
  return role === "admin" ? "Админ" : "Оператор";
}

function sortMembers(list: StaffMember[]) {
  return [...list].sort((a, b) => {
    if (a.staff_active !== b.staff_active) return a.staff_active ? -1 : 1;
    if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
    const nameA = (a.operator_pseudonym || "").toLocaleLowerCase("ru");
    const nameB = (b.operator_pseudonym || "").toLocaleLowerCase("ru");
    return nameA.localeCompare(nameB, "ru");
  });
}

export default function StaffRoster() {
  const { user, staffActive } = useAuth();
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/roster", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка загрузки");
      setMembers(sortMembers((json.operators ?? []) as StaffMember[]));
    } catch (err) {
      console.error("Ошибка загрузки команды:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    setMembers((prev) =>
      sortMembers(
        prev.map((member) =>
          member.id === user.id
            ? { ...member, staff_active: staffActive }
            : member,
        ),
      ),
    );
  }, [staffActive, user?.id]);

  const activeCount = members.filter((member) => member.staff_active).length;

  return (
    <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
            <Users className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-zinc-900">Команда</p>
            <p className="mt-0.5 text-sm font-medium text-zinc-500">
              {loading
                ? "Загрузка статусов…"
                : members.length === 0
                  ? "Операторы пока не найдены"
                  : `Активны ${activeCount} из ${members.length}`}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-[4.25rem] rounded-2xl bg-zinc-50 animate-pulse"
            />
          ))}
        </div>
      ) : members.length === 0 ? null : (
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {members.map((member) => {
            const name = member.operator_pseudonym || "Без подписи";
            const isMe = member.id === user?.id;
            return (
              <li
                key={member.id}
                className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/80 px-3.5 py-3"
              >
                <OperatorAvatar name={name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="truncate text-sm font-bold text-zinc-900">
                      {name}
                    </p>
                    {isMe ? (
                      <span className="shrink-0 rounded-full bg-[#FFF4C2] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#C9A227]">
                        Вы
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[11px] font-semibold text-zinc-400">
                    {roleLabel(member.role)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    member.staff_active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-zinc-100 text-zinc-400"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      member.staff_active ? "bg-emerald-500" : "bg-zinc-300"
                    }`}
                  />
                  {member.staff_active ? "Активный" : "Неактивный"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
