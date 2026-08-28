"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardList,
  UserCheck,
  Settings,
  User,
  Menu,
  X,
  LogOut,
  ExternalLink,
  MessageCircle,
  MessagesSquare,
  UserCog,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import OperatorAvatar from "@/src/components/Chat/OperatorAvatar";
import { useAuth } from "@/src/app/context/AuthContext";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeSupportInbox } from "@/src/utils/supabase/support-inbox";
import { subscribeStaffChatInbox } from "@/src/utils/supabase/staff-chat-inbox";
import type { ChatConversation } from "@/src/utils/chat/types";
import {
  countUnreadConversations,
  STAFF_CHAT_READ_EVENT,
} from "@/src/utils/chat/staff-inbox";
import { STAFF_TEAM_CHAT_READ_EVENT } from "@/src/utils/chat/staff-internal";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";
import { subscribeOrdersInbox } from "@/src/utils/supabase/orders-inbox";
import StaffDutyToggle from "@/src/components/staff/StaffDutyToggle";

const pageTitles: { [key: string]: string } = {
  "/operator/dashboard": "Дашборд статистики",
  "/operator/orders": "Активные ордера",
  "/operator/support": "Чат поддержки",
  "/operator/team": "Чат команды",
  "/operator/schedule": "График",
  "/operator/verification": "Верификация аккаунтов",
  "/admin/profile": "Операторы",
  "/admin/verification": "Верификация аккаунтов",
  "/admin/manage-operators": "Операторы",
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
      className={`relative flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
        active
          ? "bg-[#FFF4C2] text-zinc-900"
          : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
      }`}
    >
      <span className="relative shrink-0">
        <Icon
          className={`w-[18px] h-[18px] stroke-[1.75] ${
            active ? "text-[#C9A227]" : "text-zinc-400"
          }`}
        />
        <NavBadge count={badge} compact />
      </span>
      <span
        className={`min-w-0 flex-1 truncate whitespace-nowrap transition-opacity duration-200 ${
          collapsed ? "opacity-0" : "opacity-100 delay-75"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}

interface StaffLayoutClientProps {
  children: React.ReactNode;
  role: string;
  initialOperatorPseudonym?: string | null;
  initialStaffActive?: boolean;
  initialIsSeniorOperator?: boolean;
}

export default function StaffLayoutClient({
  children,
  role,
  initialOperatorPseudonym = null,
  initialStaffActive = false,
  initialIsSeniorOperator = false,
}: StaffLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [pendingChats, setPendingChats] = useState(0);
  const [teamChats, setTeamChats] = useState(0);
  const [activeOrders, setActiveOrders] = useState(0);
  const [operatorPseudonym, setOperatorPseudonym] = useState(
    initialOperatorPseudonym,
  );
  const pathname = usePathname();
  const { logoutUser, staffActive, setStaffActive, setIsSeniorOperator, isSeniorOperator } =
    useAuth();
  const { confirm, ConfirmDialogHost } = useConfirmDialog();

  const conversationsRef = useRef<ChatConversation[]>([]);

  const applyUnreadCount = useCallback((list?: ChatConversation[]) => {
    if (list) conversationsRef.current = list;
    setPendingChats(countUnreadConversations(conversationsRef.current));
  }, []);

  const loadPendingChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations");
      const data = await res.json();
      if (!res.ok) return;
      applyUnreadCount((data.conversations ?? []) as ChatConversation[]);
    } catch {
      // ignore
    }
  }, [applyUnreadCount]);

  const loadTeamChats = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/chat", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) return;
      setTeamChats(typeof data.unread === "number" ? data.unread : 0);
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
      const inWork = Array.isArray(data.teamInProgress)
        ? data.teamInProgress.length
        : Array.isArray(data.mine)
          ? data.mine.length
          : 0;
      setActiveOrders(pending + inWork);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const syncViewport = () => {
      const desktop = media.matches;
      setIsDesktop(desktop);
      setSidebarOpen(desktop);
    };

    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 768px)").matches) {
      setSidebarOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    setOperatorPseudonym(initialOperatorPseudonym);
  }, [initialOperatorPseudonym]);

  useLayoutEffect(() => {
    setStaffActive(initialStaffActive);
  }, [initialStaffActive, setStaffActive]);

  useLayoutEffect(() => {
    setIsSeniorOperator(initialIsSeniorOperator);
  }, [initialIsSeniorOperator, setIsSeniorOperator]);

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
    void loadTeamChats();
    void loadActiveOrders();

    const supabase = createClient();
    const inbox = subscribeSupportInbox(supabase, {
      onMessage: () => void loadPendingChats(),
      onConversation: () => void loadPendingChats(),
    });
    const teamInbox = subscribeStaffChatInbox(supabase, {
      onMessage: () => void loadTeamChats(),
      onConversation: () => void loadTeamChats(),
    });
    const ordersInbox = subscribeOrdersInbox(supabase, () => {
      void loadActiveOrders();
    });

    const interval = setInterval(() => {
      void loadPendingChats();
      void loadTeamChats();
      void loadActiveOrders();
    }, 30_000);

    const onChatRead = () => applyUnreadCount();
    const onTeamRead = () => void loadTeamChats();
    window.addEventListener(STAFF_CHAT_READ_EVENT, onChatRead);
    window.addEventListener(STAFF_TEAM_CHAT_READ_EVENT, onTeamRead);

    return () => {
      clearInterval(interval);
      inbox.unsubscribe();
      teamInbox.unsubscribe();
      ordersInbox.unsubscribe();
      window.removeEventListener(STAFF_CHAT_READ_EVENT, onChatRead);
      window.removeEventListener(STAFF_TEAM_CHAT_READ_EVENT, onTeamRead);
    };
  }, [loadPendingChats, loadTeamChats, loadActiveOrders, applyUnreadCount]);

  const isAdmin = role === "admin";
  const canVerifyClients = isAdmin || isSeniorOperator;
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
    <div className="flex h-dvh bg-[#F4F5F7] text-zinc-900 font-sans antialiased overflow-hidden">
      <button
        type="button"
        aria-label="Закрыть меню"
        aria-hidden={!sidebarOpen}
        tabIndex={-1}
        className={`fixed inset-0 z-40 bg-zinc-900/45 backdrop-blur-[1px] md:hidden transition-opacity duration-300 ease-out ${
          sidebarOpen
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 overflow-hidden bg-white shadow-[4px_0_24px_rgba(15,23,42,0.04)] transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          collapsed ? "md:w-[4.5rem]" : "md:w-64"
        } w-[min(100vw-2.5rem,17rem)] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex h-full w-[min(100vw-2.5rem,17rem)] md:w-64 flex-col justify-between px-3 py-5 sm:px-4 sm:py-6">
          <div className="flex min-h-0 flex-1 flex-col space-y-6 overflow-hidden">
          <div className="flex items-center justify-between gap-2 shrink-0 px-1 sm:px-2">
            <Link
              href="/"
              className="relative h-7 min-w-0 flex-1 text-base sm:text-lg font-black tracking-tight text-zinc-900 select-none hover:opacity-80"
              title="На главную сайта"
            >
              <span
                className={`absolute inset-y-0 left-0 flex items-center whitespace-nowrap transition-opacity duration-200 ${
                  collapsed ? "opacity-0" : "opacity-100 delay-75"
                }`}
              >
                AURUM SWAP
                <span className="text-[#e6c628] font-medium">.DEMO</span>
              </span>
              <span
                aria-hidden
                className={`absolute inset-y-0 left-0 flex items-center transition-opacity duration-200 ${
                  collapsed ? "opacity-100 delay-75" : "opacity-0"
                }`}
              >
                A<span className="text-[#e6c628]">.</span>
              </span>
            </Link>
            <button
              type="button"
              aria-label="Закрыть меню"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden w-9 h-9 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
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
              href="/operator/team"
              icon={MessagesSquare}
              label="Чат команды"
              active={pathname.startsWith("/operator/team")}
              badge={teamChats}
              collapsed={collapsed}
              onClick={handleNavClick}
            />
            <StaffNavLink
              href="/operator/schedule"
              icon={CalendarDays}
              label="График"
              active={pathname.startsWith("/operator/schedule")}
              collapsed={collapsed}
              onClick={handleNavClick}
            />
            {canVerifyClients && !isAdmin ? (
              <StaffNavLink
                href="/operator/verification"
                icon={UserCheck}
                label="Верификация аккаунтов"
                active={pathname === "/operator/verification"}
                collapsed={collapsed}
                onClick={handleNavClick}
              />
            ) : null}

            {isAdmin && (
              <div className="pt-4 mt-4 border-t border-zinc-100 space-y-1">
                <span
                  className={`mb-1 block overflow-hidden pl-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 whitespace-nowrap transition-opacity duration-200 ${
                    collapsed ? "opacity-0" : "opacity-100 delay-75"
                  }`}
                >
                  Администрирование
                </span>
                <StaffNavLink
                  href="/admin/verification"
                  icon={UserCheck}
                  label="Верификация аккаунтов"
                  active={pathname === "/admin/verification"}
                  collapsed={collapsed}
                  onClick={handleNavClick}
                />
                <StaffNavLink
                  href="/admin/profile"
                  icon={UserCog}
                  label="Операторы"
                  active={
                    pathname === "/admin/profile" ||
                    pathname === "/admin/manage-operators"
                  }
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

        <div className="border-t border-zinc-100 pt-4 space-y-1 shrink-0 px-1">
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
            className="flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0 stroke-[1.75] text-zinc-400" />
            <span
              className={`min-w-0 flex-1 truncate text-left whitespace-nowrap transition-opacity duration-200 ${
                collapsed ? "opacity-0" : "opacity-100 delay-75"
              }`}
            >
              Выйти из системы
            </span>
          </button>
        </div>
        </div>
      </aside>

      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col h-dvh transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          collapsed ? "md:pl-[4.5rem]" : "md:pl-64"
        }`}
      >
        <header className="h-14 sm:h-16 lg:h-[4.5rem] bg-white/90 backdrop-blur-md shadow-[0_4px_24px_rgba(15,23,42,0.04)] px-3.5 sm:px-5 md:px-6 lg:px-8 xl:px-10 flex items-center justify-between gap-2 shrink-0 z-30 safe-area-inset-top">
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
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide mt-1 block ${
                        staffActive ? "text-emerald-600" : "text-zinc-400"
                      }`}
                    >
                      {isAdmin ? "Админ" : "Оператор"} ·{" "}
                      {staffActive ? "Активный" : "Неактивный"}
                    </span>
                  </div>
                  <OperatorAvatar
                    name={operatorPseudonym}
                    size="sm"
                    className="w-8 h-8 sm:w-9 sm:h-9"
                  />
                </>
              ) : isAdmin ? (
                <>
                  <Link
                    href="/admin/profile"
                    className="hidden sm:inline-flex items-center rounded-full bg-[#FFDD2D] px-2.5 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-zinc-900 hover:bg-[#e6c628] transition-colors whitespace-nowrap max-w-[120px] sm:max-w-none truncate"
                  >
                    Назначить псевдоним
                  </Link>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500 shrink-0 select-none">
                    <User className="w-4 h-4" />
                  </div>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline text-[10px] sm:text-xs font-bold text-zinc-400 whitespace-nowrap">
                    Нет псевдонима
                  </span>
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

        <main className="flex-1 min-h-0 overflow-y-auto px-3 min-[380px]:px-3.5 sm:px-5 md:px-6 lg:px-8 xl:px-10 py-3.5 sm:py-5 md:py-6 lg:py-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!staffActive ? (
            <div className="mb-4 rounded-2xl border border-amber-200/80 bg-[#FFF8D6] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="min-w-0 flex-1 text-sm font-medium text-zinc-700">
                Вы неактивны. Включите активный режим, чтобы брать заявки, чаты
                и выполнять рабочие действия.
              </p>
              <StaffDutyToggle variant="compact" />
            </div>
          ) : null}
          {children}
        </main>
      </div>
      <ConfirmDialogHost />
    </div>
  );
}
