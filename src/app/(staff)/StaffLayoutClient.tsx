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
  X,
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
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";

const pageTitles: { [key: string]: string } = {
  "/operator/dashboard": "Дашборд статистики",
  "/operator/orders": "Активные ордера",
  "/operator/support": "Чат поддержки",
  "/operator/profile": "Профиль оператора",
  "/admin/verification": "Верификация аккаунтов",
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [pendingChats, setPendingChats] = useState(0);
  const [operatorPseudonym, setOperatorPseudonym] = useState(
    initialOperatorPseudonym,
  );
  const pathname = usePathname();
  const { logoutUser } = useAuth();
  const { confirm, ConfirmDialogHost } = useConfirmDialog();

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
    const media = window.matchMedia("(min-width: 768px)");
    const syncViewport = () => {
      const desktop = media.matches;
      setIsDesktop(desktop);
      if (desktop) setSidebarOpen(true);
    };

    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!isDesktop) setSidebarOpen(false);
  }, [pathname, isDesktop]);

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
    const inbox = subscribeSupportInbox(supabase, {
      onMessage: () => void loadPendingChats(),
      onConversation: () => void loadPendingChats(),
    });

    const interval = setInterval(() => void loadPendingChats(), 30_000);

    return () => {
      clearInterval(interval);
      inbox.unsubscribe();
    };
  }, [loadPendingChats]);

  const isAdmin = role === "admin";
  const currentTitle = getPageTitle(pathname);

  const handleNavClick = () => {
    if (!isDesktop) {
      setSidebarOpen(false);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen((open) => !open);
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: "Выйти из системы?",
      description: "Текущая сессия оператора будет завершена.",
      confirmLabel: "Выйти",
      variant: "destructive",
    });
    if (!ok) return;
    logoutUser();
  };

  return (
    <div className="flex h-dvh bg-zinc-50/50 text-zinc-900 font-sans antialiased overflow-hidden">
      {!isDesktop && sidebarOpen && (
        <button
          type="button"
          aria-label="Закрыть меню"
          className="fixed inset-0 z-40 bg-zinc-900/45 backdrop-blur-[1px] md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-[min(100vw-2.5rem,17rem)] md:w-64 bg-white border-r border-zinc-200 transition-transform duration-300 ease-in-out px-3 sm:px-4 py-5 sm:py-6 flex flex-col justify-between ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-6 flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-1 sm:px-2 gap-2 shrink-0">
            <Link
              href="/"
              className="text-base sm:text-lg font-black tracking-tight text-zinc-900 select-none hover:opacity-80 transition-opacity truncate"
              title="На главную сайта"
            >
              AURUM SWAP<span className="text-[#e6c628] font-medium">.DEMO</span>
            </Link>
            {!isDesktop && (
              <button
                type="button"
                aria-label="Закрыть меню"
                onClick={() => setSidebarOpen(false)}
                className="md:hidden w-9 h-9 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <nav className="space-y-1 pt-4 overflow-y-auto flex-1 min-h-0 pb-2 [scrollbar-width:thin]">
            <Link
              href="/operator/dashboard"
              className={`w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                pathname === "/operator/dashboard"
                  ? "bg-[#FFDD2D] text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
              onClick={handleNavClick}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Дашборд</span>
            </Link>

            <Link
              href="/operator/orders"
              className={`w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                pathname === "/operator/orders"
                  ? "bg-[#FFDD2D] text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
              onClick={handleNavClick}
            >
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Активные ордера</span>
            </Link>

            <Link
              href="/operator/support"
              className={`w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer relative ${
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
              <span className="min-w-0 flex-1 truncate">Чат поддержки</span>
              {pendingChats > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {pendingChats}
                </span>
              )}
            </Link>

            <Link
              href="/operator/profile"
              className={`w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                pathname === "/operator/profile"
                  ? "bg-[#FFDD2D] text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
              onClick={handleNavClick}
            >
              <UserCog className="w-4 h-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Профиль</span>
            </Link>

            {/* АДМИНСКИЙ БЛОК */}
            {isAdmin && (
              <div className="pt-4 mt-4 border-t border-zinc-100 space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pl-3 mb-1">
                  Администрирование
                </span>
                <Link
                  href="/admin/verification"
                  className={`w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                    pathname === "/admin/verification"
                      ? "bg-[#FFDD2D] text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                  }`}
                  onClick={handleNavClick}
                >
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    Верификация аккаунтов
                  </span>
                </Link>
                <Link
                  href="/admin/manage-operators"
                  className={`w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                    pathname === "/admin/manage-operators"
                      ? "bg-[#FFDD2D] text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                  }`}
                  onClick={handleNavClick}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    Управление персоналом
                  </span>
                </Link>
                <Link
                  href="/admin/settings"
                  className={`w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                    pathname === "/admin/settings"
                      ? "bg-[#FFDD2D] text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                  }`}
                  onClick={handleNavClick}
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    Настройки системы
                  </span>
                </Link>
              </div>
            )}
          </nav>
        </div>

        <div className="border-t border-zinc-100 pt-4 px-1 space-y-1 shrink-0">
          <Link
            href="/"
            onClick={handleNavClick}
            className="w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">На сайт</span>
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Выйти из системы</span>
          </button>
        </div>
      </aside>

      <div
        className={`flex-1 flex flex-col h-dvh min-h-0 min-w-0 transition-all duration-300 ease-in-out ${
          sidebarOpen ? "md:pl-64" : "md:pl-0"
        }`}
      >
        <header className="h-14 sm:h-16 md:h-20 bg-white border-b border-zinc-200 px-3 sm:px-4 md:px-10 flex items-center justify-between gap-2 shrink-0 z-30 safe-area-inset-top">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleSidebar}
              className="rounded-full border-zinc-200 h-9 w-9 sm:h-10 sm:w-10 shrink-0 bg-white hover:bg-zinc-50 cursor-pointer shadow-none md:hidden"
            >
              <Menu className="w-5 h-5 text-[#2A2A2A]" />
            </Button>
            <h2 className="text-sm sm:text-base md:text-xl font-bold text-zinc-800 tracking-tight select-none truncate">
              {currentTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 sm:border-r sm:border-zinc-200 sm:pr-4 md:pr-6">
              {operatorPseudonym ? (
                <>
                  <div className="hidden sm:block text-right min-w-0">
                    <p className="text-sm font-bold text-zinc-800 leading-none truncate max-w-[120px] md:max-w-[200px]">
                      {operatorPseudonym}
                    </p>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mt-1 block">
                      {isAdmin ? "Админ" : "Оператор"} · Онлайн
                    </span>
                  </div>
                  <OperatorAvatar
                    name={operatorPseudonym}
                    size="sm"
                    className="w-8 h-8 sm:w-9 sm:h-9"
                  />
                </>
              ) : (
                <>
                  <Link
                    href="/operator/profile"
                    className="hidden sm:inline-flex items-center rounded-full bg-[#FFDD2D] px-2.5 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-zinc-900 shadow-[0_0_16px_rgba(255,221,45,0.55)] ring-2 ring-amber-300/60 animate-pulse hover:bg-[#e6c628] transition-colors whitespace-nowrap max-w-[120px] sm:max-w-none truncate"
                  >
                    Заполнить профиль
                  </Link>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500 shrink-0 select-none">
                    <User className="w-4 h-4" />
                  </div>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={toggleSidebar}
              className="hidden md:inline-flex rounded-full border-zinc-200 h-10 w-10 shrink-0 bg-white hover:bg-zinc-50 cursor-pointer shadow-none"
            >
              <Menu className="w-5 h-5 text-[#2A2A2A]" />
            </Button>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 md:p-10 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {children}
        </main>
      </div>
      <ConfirmDialogHost />
    </div>
  );
}
