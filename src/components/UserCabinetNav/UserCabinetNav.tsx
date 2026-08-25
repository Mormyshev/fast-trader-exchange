"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  User,
} from "lucide-react";
import { useAuth } from "@/src/app/context/AuthContext";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";

const NAV_ITEMS = [
  {
    href: "/user/dashboard",
    label: "Кабинет",
    icon: LayoutDashboard,
    match: (path: string) => path.startsWith("/user/dashboard"),
  },
  {
    href: "/user/exchange",
    label: "Обмен",
    icon: ArrowLeftRight,
    match: (path: string) => path.startsWith("/user/exchange"),
  },
  {
    href: "/user/orders",
    label: "Заявки",
    icon: ClipboardList,
    match: (path: string) => path.startsWith("/user/orders"),
  },
  {
    href: "/user/profile",
    label: "Профиль",
    icon: User,
    match: (path: string) => path.startsWith("/user/profile"),
  },
];

export default function UserCabinetNav() {
  const pathname = usePathname();
  const { logoutUser } = useAuth();
  const { confirm, ConfirmDialogHost } = useConfirmDialog();

  const handleLogout = async () => {
    const ok = await confirm({
      title: "Выйти из аккаунта?",
      description: "Текущая сессия будет завершена.",
      confirmLabel: "Выйти",
      variant: "destructive",
    });
    if (!ok) return;
    logoutUser();
  };

  return (
    <>
      <aside className="w-full shrink-0 lg:w-[240px] space-y-3">
        <nav className="rounded-2xl bg-white p-2 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[#FFF4C2] text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] stroke-[1.75] ${
                    active ? "text-[#C9A227]" : "text-zinc-400"
                  }`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex w-full items-center gap-3 rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-zinc-600 shadow-[0_4px_24px_rgba(15,23,42,0.04)] transition-colors hover:text-zinc-900 cursor-pointer"
        >
          <LogOut className="h-[18px] w-[18px] stroke-[1.75] text-zinc-400" />
          Выйти
        </button>
      </aside>
      <ConfirmDialogHost />
    </>
  );
}
