"use client";

import { useState } from "react";
import NextLink from "next/link";
import { Menu, UserPlus, LogIn, LogOut, User } from "lucide-react";
import AuthModal from "../AuthModal/AuthModal";
import RegisterModal from "../RegisterModal/RegisterModal";
import { useAuth } from "@/src/app/context/AuthContext";

import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

function getCabinetLink(role: string) {
  if (role === "operator" || role === "admin") {
    return {
      href: "/operator/dashboard",
      label: role === "admin" ? "Панель управления" : "Панель оператора",
    };
  }
  return { href: "/user/dashboard", label: "Кабинет" };
}

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const { role, logoutUser } = useAuth();
  const { confirm, ConfirmDialogHost } = useConfirmDialog();
  const cabinet = getCabinetLink(role);

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

  const openLoginAndCloseRegister = () => {
    setIsRegisterOpen(false);
    setTimeout(() => setIsAuthOpen(true), 200);
  };

  const openRegisterAndCloseLogin = () => {
    setIsAuthOpen(false);
    setTimeout(() => setIsRegisterOpen(true), 200);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md transition-colors duration-200 dark:border-zinc-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-5 md:px-6 lg:px-8">
          <div className="flex h-16 md:h-20 items-center justify-between">
            <NextLink href="/" className="flex items-center space-x-3 group">
              <div className="relative h-10 w-10 flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.svg"
                  alt="Aurum Swap"
                  width={40}
                  height={40}
                  className="h-10 w-10"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-50 leading-none">
                  AURUM SWAP
                </span>
                <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  Demo Exchange
                </span>
              </div>
            </NextLink>

            <div className="hidden md:flex items-center space-x-6">
              {role === "guest" ? (
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    onClick={() => setIsAuthOpen(true)}
                    className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-zinc-300 dark:hover:text-zinc-50 cursor-pointer"
                  >
                    Войти
                  </Button>
                  <Button
                    onClick={() => setIsRegisterOpen(true)}
                    className="rounded-full bg-[#FFDD2D] px-6 text-sm font-semibold text-black hover:bg-[#e6c625] transition-colors shadow-sm cursor-pointer"
                  >
                    Регистрация
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <NextLink href={cabinet.href}>
                    <Button
                      variant="ghost"
                      className="text-sm font-medium text-gray-700 dark:text-zinc-300 cursor-pointer"
                    >
                      {cabinet.label}
                    </Button>
                  </NextLink>
                  {role === "user" && (
                    <>
                      <NextLink href="/user/orders">
                        <Button
                          variant="ghost"
                          className="text-sm font-medium text-gray-700 dark:text-zinc-300 cursor-pointer"
                        >
                          Мои заявки
                        </Button>
                      </NextLink>
                      <NextLink href="/user/profile">
                        <Button
                          variant="ghost"
                          className="text-sm font-medium text-gray-700 dark:text-zinc-300 cursor-pointer"
                        >
                          Профиль
                        </Button>
                      </NextLink>
                    </>
                  )}
                  <Button
                    onClick={() => void handleLogout()}
                    variant="secondary"
                    className="rounded-full px-6 text-sm font-semibold transition-all cursor-pointer"
                  >
                    Выйти
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 md:hidden">
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-600 dark:text-zinc-400"
                  >
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Открыть меню</span>
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-full sm:max-w-xs border-l border-gray-100 bg-white/95 backdrop-blur-md p-4 sm:p-6 flex flex-col justify-between overflow-hidden dark:border-zinc-900"
                >
                  <div>
                    <SheetTitle className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-6">
                      Навигация
                    </SheetTitle>

                    {role !== "guest" && (
                      <div className="bg-[#FFDD2D] text-zinc-900 rounded-2xl p-2.5 flex flex-col shadow-sm mb-6">
                        <NextLink
                          href={cabinet.href}
                          onClick={() => setIsOpen(false)}
                          className="block min-w-0 text-[15px] font-semibold py-3 px-3 rounded-xl hover:bg-black/5 transition-colors cursor-pointer truncate"
                        >
                          {cabinet.label}
                        </NextLink>
                        {role === "user" && (
                          <>
                            <div className="h-[1px] bg-black/10 w-full my-0.5" />
                            <NextLink
                              href="/user/orders"
                              onClick={() => setIsOpen(false)}
                              className="block text-[15px] font-semibold py-3 px-3 rounded-xl hover:bg-black/5 transition-colors cursor-pointer"
                            >
                              Мои заявки
                            </NextLink>
                            <div className="h-[1px] bg-black/10 w-full my-0.5" />
                            <NextLink
                              href="/user/profile"
                              onClick={() => setIsOpen(false)}
                              className="block text-[15px] font-semibold py-3 px-3 rounded-xl hover:bg-black/5 transition-colors cursor-pointer"
                            >
                              Профиль
                            </NextLink>
                          </>
                        )}
                      </div>
                    )}

                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-zinc-900 shrink-0">
                    {role === "guest" ? (
                      <div className="flex flex-col gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsOpen(false);
                            setIsRegisterOpen(true);
                          }}
                          className="w-full min-w-0 h-12 border-gray-200 text-gray-700 dark:border-zinc-800 dark:text-zinc-300 rounded-xl text-sm font-semibold bg-white flex items-center justify-center gap-2 px-4"
                        >
                          <UserPlus className="w-4 h-4 shrink-0 text-gray-500" />
                          <span className="truncate">Регистрация</span>
                        </Button>
                        <Button
                          onClick={() => {
                            setIsOpen(false);
                            setIsAuthOpen(true);
                          }}
                          className="w-full min-w-0 h-12 bg-[#FFDD2D] hover:bg-[#e6c625] text-black rounded-xl text-sm font-semibold border-none shadow-none flex items-center justify-center gap-2 px-4"
                        >
                          <LogIn className="w-4 h-4 shrink-0 text-black" />
                          <span className="truncate">Войти</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <NextLink
                          href={cabinet.href}
                          onClick={() => setIsOpen(false)}
                          className="w-full min-w-0"
                        >
                          <Button
                            variant="outline"
                            className="w-full min-w-0 h-12 border-gray-200 dark:border-zinc-800 rounded-xl text-sm font-semibold bg-white flex items-center justify-center gap-2 px-4"
                          >
                            <User className="w-4 h-4 shrink-0" />
                            <span className="truncate">{cabinet.label}</span>
                          </Button>
                        </NextLink>
                        <Button
                          onClick={() => {
                            setIsOpen(false);
                            void handleLogout();
                          }}
                          variant="destructive"
                          className="w-full min-w-0 h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 px-4"
                        >
                          <LogOut className="w-4 h-4 shrink-0" />
                          <span className="truncate">Выйти</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSwitchToRegister={openRegisterAndCloseLogin}
      />
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSwitchToLogin={openLoginAndCloseRegister}
      />
      <ConfirmDialogHost />
    </>
  );
}
