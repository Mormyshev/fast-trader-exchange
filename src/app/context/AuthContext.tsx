"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { createClient } from "@/src/utils/supabase/client";
import { useRouter } from "next/navigation";

type AppRole = "guest" | "user" | "operator" | "admin";

interface AuthContextType {
  user: any | null;
  role: AppRole;
  isLoading: boolean;
  logoutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: "guest",
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
}: {
  children: React.ReactNode;
  initialUser: any;
  initialRole: AppRole;
}) {
  const [user, setUser] = useState<any | null>(initialUser);
  const [role, setRole] = useState<AppRole>(initialRole);
  const [isLoading, setIsLoading] = useState(!initialUser);

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
        setIsLoading(false);
        return;
      }

      if (!session.user) return;

      setUser(session.user);

      // Не трогаем isLoading на INITIAL_SESSION / TOKEN_REFRESHED —
      // иначе все страницы с зависимостью isAuthLoading рвут Realtime-каналы
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
        } catch {
          setRole("user");
        } finally {
          setIsLoading(false);
        }
      })();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const logoutUser = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignore network failures
    }
    setUser(null);
    setRole("guest");
    setIsLoading(false);

    if (typeof window !== "undefined") {
      window.location.href = window.location.origin;
    } else {
      router.push("/");
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, isLoading, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
