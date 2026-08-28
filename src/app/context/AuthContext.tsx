"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { createClient } from "@/src/utils/supabase/client";
import { sessionHasRecoveryAmr } from "@/src/utils/supabase/recovery-session";
import { useRouter } from "next/navigation";

type AppRole = "guest" | "user" | "operator" | "admin";

interface AuthContextType {
  user: any | null;
  role: AppRole;
  staffActive: boolean;
  setStaffActive: (value: boolean) => void;
  isSeniorOperator: boolean;
  setIsSeniorOperator: (value: boolean) => void;
  canReassignOrders: boolean;
  isLoading: boolean;
  logoutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: "guest",
  staffActive: false,
  setStaffActive: () => {},
  isSeniorOperator: false,
  setIsSeniorOperator: () => {},
  canReassignOrders: false,
  isLoading: true,
  logoutUser: async () => {},
});

function normalizeRole(role: string | null | undefined): AppRole {
  if (role === "operator" || role === "admin" || role === "user") return role;
  return "user";
}

export function AuthProvider({
  children,
  initialUser,
  initialRole,
  initialStaffActive = false,
  initialIsSeniorOperator = false,
}: {
  children: React.ReactNode;
  initialUser: any;
  initialRole: AppRole;
  initialStaffActive?: boolean;
  initialIsSeniorOperator?: boolean;
}) {
  const [user, setUser] = useState<any | null>(initialUser);
  const [role, setRole] = useState<AppRole>(initialRole);
  const [staffActive, setStaffActive] = useState(initialStaffActive);
  const [isSeniorOperator, setIsSeniorOperator] = useState(
    initialIsSeniorOperator,
  );
  const [isLoading, setIsLoading] = useState(!initialUser);
  const canReassignOrders = role === "admin" || isSeniorOperator;

  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setUser(initialUser);
    setRole(initialRole);
    setIsLoading(false);
  }, [initialUser, initialRole]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setRole("guest");
        setStaffActive(false);
        setIsSeniorOperator(false);
        setIsLoading(false);
        return;
      }

      if (!session.user) return;

      setUser(session.user);

      const onResetPage =
        typeof window !== "undefined" &&
        window.location.pathname.startsWith("/auth/reset-password");
      const isRecovery =
        event === "PASSWORD_RECOVERY" ||
        sessionHasRecoveryAmr(session.access_token);

      if (isRecovery && !onResetPage) {
        setIsLoading(false);
        router.replace("/auth/reset-password");
        return;
      }

      // Не трогаем isLoading на INITIAL_SESSION / TOKEN_REFRESHED —
      // иначе все страницы с зависимостью isAuthLoading рвут Realtime-каналы
      if (event === "PASSWORD_RECOVERY") {
        setIsLoading(false);
        return;
      }

      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        setIsLoading(false);
        return;
      }

      if (event !== "SIGNED_IN") {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      void (async () => {
        try {
          const res = await fetch("/api/me");
          const json = await res.json();
          setRole(normalizeRole(json.role));
          setStaffActive(Boolean(json.staffActive));
          setIsSeniorOperator(Boolean(json.isSeniorOperator));
        } catch {
          setRole("user");
          setIsSeniorOperator(false);
        } finally {
          setIsLoading(false);
        }
      })();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  const logoutUser = async () => {
    setIsLoading(true);
    try {
      // Сначала сервер — чистит httpOnly cookies (иначе после reload снова «вошли»)
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignore
    }
    setUser(null);
    setRole("guest");
    setStaffActive(false);
    setIsSeniorOperator(false);
    setIsLoading(false);

    if (typeof window !== "undefined") {
      window.location.replace("/");
    } else {
      router.push("/");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        staffActive,
        setStaffActive,
        isSeniorOperator,
        setIsSeniorOperator,
        canReassignOrders,
        isLoading,
        logoutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
