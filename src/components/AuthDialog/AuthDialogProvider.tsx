"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  Suspense,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LogIn, UserPlus, X } from "lucide-react";
import AuthModal from "@/src/components/AuthModal/AuthModal";
import RegisterModal from "@/src/components/RegisterModal/RegisterModal";
import { useAuth } from "@/src/app/context/AuthContext";
import { lockPageScroll, unlockPageScroll } from "@/src/utils/lenis-bridge";

type AuthView = "closed" | "gate" | "login" | "register";

type AuthDialogContextValue = {
  openLogin: () => void;
  openRegister: () => void;
  requireAuth: (redirectTo?: string) => boolean;
};

const AuthDialogContext = createContext<AuthDialogContextValue>({
  openLogin: () => {},
  openRegister: () => {},
  requireAuth: () => true,
});

export function useAuthDialog() {
  return useContext(AuthDialogContext);
}

function AuthQueryOpener({
  onNeedLogin,
}: {
  onNeedLogin: () => void;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("auth") !== "required") return;
    onNeedLogin();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("auth");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [searchParams, pathname, router, onNeedLogin]);

  return null;
}

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const [view, setView] = useState<AuthView>("closed");
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  const close = useCallback(() => {
    setView("closed");
    setRedirectTo(null);
  }, []);

  const openLogin = useCallback(() => {
    setView("login");
  }, []);

  const openRegister = useCallback(() => {
    setView("register");
  }, []);

  const requireAuth = useCallback(
    (next?: string) => {
      if (role !== "guest") return true;
      setRedirectTo(next ?? null);
      setView("gate");
      return false;
    },
    [role],
  );

  useEffect(() => {
    if (view === "closed") {
      unlockPageScroll();
      return;
    }
    lockPageScroll();
    return () => unlockPageScroll();
  }, [view]);

  return (
    <AuthDialogContext.Provider value={{ openLogin, openRegister, requireAuth }}>
      {children}
      <Suspense fallback={null}>
        <AuthQueryOpener onNeedLogin={requireAuth} />
      </Suspense>

      {view === "gate" && (
        <div
          data-lenis-prevent
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-zinc-950/35 backdrop-blur-[2px]"
        >
          <div className="absolute inset-0" onClick={close} />
          <div className="relative z-10 w-full max-w-[420px] rounded-2xl bg-white p-6 sm:p-7 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <button
              type="button"
              onClick={close}
              className="absolute top-4 right-4 size-9 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
              <LogIn className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-tight text-zinc-900">
              Войдите, чтобы оформить заявку
            </h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-500">
              Чтобы создать ордер, нужно зарегистрироваться или войти в аккаунт.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={openRegister}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#FFDD2D] px-5 text-sm font-bold text-zinc-900 hover:bg-[#e6c628] transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                Зарегистрироваться
              </button>
              <button
                type="button"
                onClick={openLogin}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#FFF8D6] px-5 text-sm font-bold text-zinc-800 hover:bg-[#FFF4C2] transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Войти
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={view === "login"}
        onClose={close}
        onSwitchToRegister={() => setView("register")}
        redirectTo={redirectTo}
      />
      <RegisterModal
        isOpen={view === "register"}
        onClose={close}
        onSwitchToLogin={() => setView("login")}
        redirectTo={redirectTo}
      />
    </AuthDialogContext.Provider>
  );
}
