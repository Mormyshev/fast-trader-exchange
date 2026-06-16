"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
  // Инициализируем стейт данными с сервера!
  const [user, setUser] = useState<any | null>(initialUser);
  const [role, setRole] = useState<"guest" | "user" | "operator" | "admin">(
    initialRole,
  );
  const [isLoading, setIsLoading] = useState(!initialUser); // если юзер уже есть, загрузка не нужна

  const supabase = createClient();
  const router = useRouter();

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (!error && data?.role) {
      setRole(data.role as any);
    } else {
      setRole("user");
    }
  };

  useEffect(() => {
    // Подписка остается для отслеживания динамических входов/выходов
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchUserRole(session.user.id);
      } else {
        setUser(null);
        setRole("guest");
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Функция выхода
  const logoutUser = async () => {
    setIsLoading(true);

    // Разлогиниваем пользователя в самом Supabase (очищает локальное хранилище)
    await supabase.auth.signOut();

    setUser(null);
    setRole("guest");
    setIsLoading(false);

    // Вместо router.push жестко перезагружаем страницу на главную.
    // Это гарантированно стирает старые серверные куки Next.js!
    window.location.origin
      ? (window.location.href = window.location.origin)
      : router.push("/");
  };

  return (
    <AuthContext.Provider value={{ user, role, isLoading, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
