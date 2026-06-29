"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { createClient } from "@/src/utils/supabase/client";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: any | null;
  role: "guest" | "user" | "operator" | "admin";
  isLoading: boolean;
  logoutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: "guest",
  isLoading: true,
  logoutUser: async () => {},
});

export function AuthProvider({
  children,
  initialUser,
  initialRole,
}: {
  children: React.ReactNode;
  initialUser: any;
  initialRole: any;
}) {
  const [user, setUser] = useState<any | null>(initialUser);
  const [role, setRole] = useState<"guest" | "user" | "operator" | "admin">(
    initialRole,
  );
  const [isLoading, setIsLoading] = useState(!initialUser);

  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setRole("guest");
        setIsLoading(false);
      } else if (session?.user) {
        setUser(session.user);
        // Не делаем никаких запросов к профилям на клиенте.
        // Защита страниц теперь полностью лежит на сервере.
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const logoutUser = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
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
