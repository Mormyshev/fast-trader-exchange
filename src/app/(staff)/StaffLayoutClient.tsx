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
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import OperatorAvatar from "@/src/components/Chat/OperatorAvatar";
import { useAuth } from "@/src/app/context/AuthContext";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeSupportInbox } from "@/src/utils/supabase/support-inbox";
import type { ChatConversation } from "@/src/utils/chat/types";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";
import { subscribeOrdersInbox } from "@/src/utils/supabase/orders-inbox";

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

function NavBadge({ count, compact = false }: { count: number; compact?: boolean }) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className={
        compact
          ? "absolute -top-1.5 -right-1.5 min-w-4 h-4 px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold leading-none flex items-center justify-center"
          : "min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0"
      }
    >
      {label}
    </span>
  );
}

function StaffNavLink({
  href,
  icon: Icon,
  label,
  active,
  badge = 0,
  collapsed,
  onClick,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  badge?: number;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={`relative w-full min-w-0 flex items-center rounded-xl text-sm font-bold transition-colors cursor-pointer ${
        collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
      } ${
        active
          ? "bg-[#FFDD2D] text-zinc-900"
          : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
      }`}
    >
      <span className="relative shrink-0">
        <Icon className="w-4 h-4" />
        {collapsed && <NavBadge count={badge} compact />}
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <NavBadge count={badge} />
        </>
      )}
    </Link>
  );
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
  const [activeOrders, setActiveOrders] = useState(0);
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

  const loadActiveOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders/staff");
      const data = await res.json();
      if (!res.ok) return;
      const pending = Array.isArray(data.pending) ? data.pending.length : 0;
      const mine = Array.isArray(data.mine) ? data.mine.length : 0;
      setActiveOrders(pending + mine);
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
    void loadActiveOrders();

    const supabase = createClient();
    const inbox = subscribeSupportInbox(supabase, {
      onMessage: () => void loadPendingChats(),
      onConversation: () => void loadPendingChats(),
    });
    const ordersInbox = subscribeOrdersInbox(supabase, () => {
      void loadActiveOrders();
    });

    const interval = setInterval(() => {
      void loadPendingChats();
      void loadActiveOrders();
    }, 30_000);

    return () => {
      clearInterval(interval);
      inbox.unsubscribe();
      ordersInbox.unsubscribe();
    };
  }, [loadPendingChats, loadActiveOrders]);

  const isAdmin = role === "admin";
  const currentTitle = getPageTitle(pathname);
  const collapsed = isDesktop && !sidebarOpen;

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
        className={`fixed top-0 left-0 bottom-0 z-50 bg-white border-r border-zinc-200 transition-all duration-300 ease-in-out flex flex-col justify-between ${
          isDesktop
            ? collapsed
              ? "w-[4.5rem] px-2 py-6 translate-x-0"
              : "w-64 px-4 py-6 translate-x-0"
            : `w-[min(100vw-2.5rem,17rem)] px-3 sm:px-4 py-5 sm:py-6 ${
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`
        }`}
      >
        <div className="space-y-6 flex-1 min-h-0 overflow-hidden flex flex-col">
          <div
            className={`flex items-center gap-2 shrink-0 ${collapsed ? "justify-center px-0" : "justify-between px-1 sm:px-2"}`}
          >
            <Link
              href="/"
              className="text-base sm:text-lg font-black tracking-tight text-zinc-900 select-none hover:opacity-80 transition-opacity truncate"
              title="На главную сайта"
            >
              {collapsed ? (
                <>
                  A<span className="text-[#e6c628]">.</span>
                </>
              ) : (
                <>
                  AURUM SWAP
                  <span className="text-[#e6c628] font-medium">.DEMO</span>
                </>
              )}
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
            <StaffNavLink
              href="/operator/dashboard"
              icon={LayoutDashboard}
              label="Дашборд"
              active={pathname === "/operator/dashboard"}
              collapsed={collapsed}
              onClick={handleNavClick}
            />
            <StaffNavLink
              href="/operator/orders"
              icon={ClipboardList}
              label="Активные ордера"
              active={pathname.startsWith("/operator/orders")}
              badge={activeOrders}
              collapsed={collapsed}
              onClick={handleNavClick}
            />
            <StaffNavLink
              href="/operator/support"
              icon={MessageCircle}
              label="Чат поддержки"
              active={pathname.startsWith("/operator/support")}
              badge={pendingChats}
              collapsed={collapsed}
              onClick={handleNavClick}
            />
            <StaffNavLink
              href="/operator/profile"
              icon={UserCog}
              label="Профиль"
              active={pathname === "/operator/profile"}
              collapsed={collapsed}
              onClick={handleNavClick}
            />

            {isAdmin && (
              <div
                className={`pt-4 mt-4 border-t border-zinc-100 space-y-1 ${collapsed ? "px-0" : ""}`}
              >
                {!collapsed && (
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pl-3 mb-1">
                    Администрирование
                  </span>
                )}
                <StaffNavLink
                  href="/admin/verification"
                  icon={UserCheck}
                  label="Верификация аккаунтов"
                  active={pathname === "/admin/verification"}
                  collapsed={collapsed}
                  onClick={handleNavClick}
                />
                <StaffNavLink
                  href="/admin/manage-operators"
                  icon={Users}
                  label="Управление персоналом"
                  active={pathname === "/admin/manage-operators"}
                  collapsed={collapsed}
                  onClick={handleNavClick}
                />
                <StaffNavLink
                  href="/admin/settings"
                  icon={Settings}
                  label="Настройки системы"
                  active={pathname === "/admin/settings"}
                  collapsed={collapsed}
                  onClick={handleNavClick}
                />
              </div>
            )}
          </nav>
        </div>

        <div
          className={`border-t border-zinc-100 pt-4 space-y-1 shrink-0 ${collapsed ? "px-0" : "px-1"}`}
        >
          <StaffNavLink
            href="/"
            icon={ExternalLink}
            label="На сайт"
            active={false}
            collapsed={collapsed}
            onClick={handleNavClick}
          />
          <button
            type="button"
            title={collapsed ? "Выйти из системы" : undefined}
            onClick={() => void handleLogout()}
            className={`w-full min-w-0 flex items-center rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer ${
              collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && (
              <span className="min-w-0 flex-1 truncate text-left">
                Выйти из системы
              </span>
            )}
          </button>
        </div>
      </aside>

      <div
        className={`flex-1 flex flex-col h-dvh min-h-0 min-w-0 transition-all duration-300 ease-in-out ${
          isDesktop ? (collapsed ? "md:pl-[4.5rem]" : "md:pl-64") : ""
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
