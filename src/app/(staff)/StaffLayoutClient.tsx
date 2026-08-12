"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardList,
  UserCheck,
  Settings,
  Users,
  User,
  Menu,
  LogOut,
  ExternalLink,
  MessageCircle,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import OperatorAvatar from "@/src/components/Chat/OperatorAvatar";
import { useAuth } from "@/src/app/context/AuthContext";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeSupportInbox } from "@/src/utils/supabase/support-inbox";
import type { ChatConversation } from "@/src/utils/chat/types";

const pageTitles: { [key: string]: string } = {
  "/operator/dashboard": "Дашборд статистики",
  "/operator/orders": "Активные ордера",
  "/operator/verification": "Проверка анкет",
  "/operator/support": "Чат поддержки",
  "/operator/profile": "Профиль оператора",
  "/admin/manage-operators": "Управление персоналом",
  "/admin/settings": "Настройки системы",
};

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/operator/orders/") && pathname !== "/operator/orders") {
    return "Карточка заявки";
  }
  return pageTitles[pathname] || "Панель управления";
}

interface StaffLayoutClientProps {
  children: React.ReactNode;
  role: string;
  initialOperatorPseudonym?: string | null;
}

export default function StaffLayoutClient({
  children,
  role,
  initialOperatorPseudonym = null,
}: StaffLayoutClientProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [pendingChats, setPendingChats] = useState(0);
  const [operatorPseudonym, setOperatorPseudonym] = useState(
    initialOperatorPseudonym,
  );
  const pathname = usePathname();
  const { logoutUser } = useAuth();

  const loadPendingChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations");
      const data = await res.json();
      if (!res.ok) return;

      const unassigned = ((data.conversations ?? []) as ChatConversation[]).filter(
        (c) => !c.operator_id,
      ).length;
      setPendingChats(unassigned);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setOperatorPseudonym(initialOperatorPseudonym);
  }, [initialOperatorPseudonym]);

  useEffect(() => {
    const handleProfileUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ pseudonym?: string | null }>)
        .detail;
      const value = detail?.pseudonym?.trim();
      setOperatorPseudonym(value || null);
    };

    window.addEventListener("operator-profile-updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("operator-profile-updated", handleProfileUpdate);
    };
  }, []);

  useEffect(() => {
    void loadPendingChats();

    const supabase = createClient();
    const channel = subscribeSupportInbox(supabase, {
      onMessage: () => void loadPendingChats(),
      onConversation: () => void loadPendingChats(),
    });

    const interval = setInterval(() => void loadPendingChats(), 30_000);

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [loadPendingChats]);

  const isAdmin = role === "admin";
  const currentTitle = getPageTitle(pathname);

  const handleNavClick = () => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-50/50 text-zinc-900 font-sans antialiased overflow-x-hidden">
      {/* НОВОЕ КРАСИВОЕ БОКОВОЕ МЕНЮ (SIDEBAR) */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 w-64 bg-white border-r border-zinc-200 transition-transform duration-300 ease-in-out px-4 py-6 flex flex-col justify-between ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <Link
              href="/"
              className="text-lg font-black tracking-tight text-zinc-900 select-none hover:opacity-80 transition-opacity"
              title="На главную сайта"
            >
              AURUM SWAP<span className="text-[#e6c628] font-medium">.DEMO</span>
            </Link>
          </div>

          <nav className="space-y-1 pt-4">
            <Link
              href="/operator/dashboard"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                pathname === "/operator/dashboard"
                  ? "bg-[#FFDD2D] text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
              onClick={handleNavClick}
            >
              <LayoutDashboard className="w-4 h-4" />
              Дашборд статистики
            </Link>

            <Link
              href="/operator/orders"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                pathname === "/operator/orders"
                  ? "bg-[#FFDD2D] text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
              onClick={handleNavClick}
            >
              <ClipboardList className="w-4 h-4" />
              Активные ордера
            </Link>

            <Link
              href="/operator/verification"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                pathname === "/operator/verification"
                  ? "bg-[#FFDD2D] text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
              onClick={handleNavClick}
            >
              <UserCheck className="w-4 h-4" />
              Проверка анкет
            </Link>

            <Link
              href="/operator/support"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer relative ${
                pathname === "/operator/support"
                  ? "bg-[#FFDD2D] text-zinc-900"
                  : pendingChats > 0
                    ? "bg-amber-50 text-amber-950 border border-amber-200 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
              onClick={handleNavClick}
            >
              <span className="relative shrink-0">
                <MessageCircle className="w-4 h-4" />
                {pendingChats > 0 && pathname !== "/operator/support" && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                )}
              </span>
              <span className="flex-1">Чат поддержки</span>
              {pendingChats > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {pendingChats}
                </span>
              )}
            </Link>

            <Link
              href="/operator/profile"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                pathname === "/operator/profile"
                  ? "bg-[#FFDD2D] text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
              onClick={handleNavClick}
            >
              <UserCog className="w-4 h-4" />
              Профиль оператора
            </Link>

            {/* АДМИНСКИЙ БЛОК */}
            {isAdmin && (
              <div className="pt-4 mt-4 border-t border-zinc-100 space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pl-3 mb-1">
                  Администрирование
                </span>
                <Link
                  href="/admin/manage-operators"
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                    pathname === "/admin/manage-operators"
                      ? "bg-[#FFDD2D] text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                  }`}
                  onClick={handleNavClick}
                >
                  <Users className="w-4 h-4" />
                  Управление персоналом
                </Link>
                <Link
                  href="/admin/settings"
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                    pathname === "/admin/settings"
                      ? "bg-[#FFDD2D] text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                  }`}
                  onClick={handleNavClick}
                >
                  <Settings className="w-4 h-4" />
                  Настройки системы
                </Link>
              </div>
            )}
          </nav>
        </div>

        <div className="border-t border-zinc-100 pt-4 px-1 space-y-1">
          <Link
            href="/"
            onClick={handleNavClick}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            На сайт
          </Link>
          <button
            onClick={logoutUser}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Выйти из системы
          </button>
        </div>
      </aside>

      {/* ОСНОВНОЙ КОНТЕНТ СТРАНИЦ */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "md:pl-64" : "pl-0"
        }`}
      >
        {/* НОВАЯ ФУНКЦИОНАЛЬНАЯ ШАПКА */}
        <header className="h-20 bg-white border-b border-zinc-200 px-6 md:px-10 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center">
            <h2 className="text-lg md:text-xl font-bold text-zinc-800 tracking-tight select-none">
              {currentTitle}
            </h2>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <div className="flex items-center gap-3 border-r border-zinc-200 pr-4 md:pr-6">
              {operatorPseudonym ? (
                <>
                  <div className="text-right min-w-0">
                    <p className="text-sm font-bold text-zinc-800 leading-none truncate max-w-[140px] sm:max-w-[200px]">
                      {operatorPseudonym}
                    </p>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mt-1 block">
                      {isAdmin ? "Администратор" : "Оператор"} · Онлайн
                    </span>
                  </div>
                  <OperatorAvatar
                    name={operatorPseudonym}
                    size="sm"
                    className="w-9 h-9"
                  />
                </>
              ) : (
                <>
                  <Link
                    href="/operator/profile"
                    className="inline-flex items-center rounded-full bg-[#FFDD2D] px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-bold text-zinc-900 shadow-[0_0_16px_rgba(255,221,45,0.55)] ring-2 ring-amber-300/60 animate-pulse hover:bg-[#e6c628] transition-colors whitespace-nowrap"
                  >
                    Заполнить информацию
                  </Link>
                  <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500 shrink-0 select-none">
                    <User className="w-4 h-4" />
                  </div>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="rounded-full border-zinc-200 h-10 w-10 shrink-0 bg-white hover:bg-zinc-50 cursor-pointer shadow-none"
            >
              <Menu className="w-5 h-5 text-[#2A2A2A]" />
            </Button>
          </div>
        </header>

        {/* ОСНОВНАЯ ЗОНА СТРАНИЦЫ */}
        <main className="flex-1 p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}
