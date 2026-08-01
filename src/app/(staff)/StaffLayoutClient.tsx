"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/src/app/context/AuthContext";

const pageTitles: { [key: string]: string } = {
  "/operator/dashboard": "Дашборд статистики",
  "/operator/orders": "Активные ордера",
  "/operator/verification": "Проверка анкет",
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
}

export default function StaffLayoutClient({
  children,
  role,
}: StaffLayoutClientProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const pathname = usePathname();
  const { logoutUser } = useAuth(); // Оставляем только для функции выхода

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

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 border-r border-zinc-200 pr-6 hidden sm:flex">
              <div className="text-right">
                <p className="text-sm font-bold text-zinc-800 leading-none">
                  {isAdmin ? "Администратор" : "Оператор #01"}
                </p>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mt-1 block">
                  Онлайн
                </span>
              </div>
              <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500 shrink-0 select-none">
                <User className="w-4 h-4" />
              </div>
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
