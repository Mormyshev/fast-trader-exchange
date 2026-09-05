"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/src/app/context/AuthContext";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";

export const USER_NAV_ITEMS = [
  {
    href: "/user/exchange",
    label: "Обмен",
    match: (path: string) => path.startsWith("/user/exchange"),
  },
  {
    href: "/user/orders",
    label: "Заявки",
    match: (path: string) => path.startsWith("/user/orders"),
  },
  {
    href: "/user/support",
    label: "Служба поддержки",
    match: (path: string) => path.startsWith("/user/support"),
  },
  {
    href: "/user/profile",
    label: "Профиль",
    match: (path: string) => path.startsWith("/user/profile"),
  },
];

export default function UserCabinetNav() {
  const pathname = usePathname() ?? "";
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
      <nav className="flex items-center gap-1">
        {USER_NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex h-10 items-center rounded-full px-3 lg:px-4 text-sm font-semibold transition-colors ${
                active
                  ? "bg-[#FFF4C2] text-zinc-900"
                  : "text-gray-700 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="ml-2 inline-flex h-10 items-center rounded-full bg-[#FFDD2D] px-6 text-sm font-semibold text-black shadow-sm transition-colors hover:bg-[#e6c625] cursor-pointer"
        >
          Выйти
        </button>
      </nav>
      <ConfirmDialogHost />
    </>
  );
}
