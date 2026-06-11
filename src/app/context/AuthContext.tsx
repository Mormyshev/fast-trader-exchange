"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/src/utils/supabase/client";
import { useRouter } from "next/navigation";

interface AuthContextType {
    user: any | null;
    role: "guest" | "user" | "manager" | "admin";
    isLoading: boolean;
    logoutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    role: "guest",
    isLoading: true,
    logoutUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<any | null>(null);
    const [role, setRole] = useState<"guest" | "user" | "manager" | "admin">(
        "guest",
    );
    const [isLoading, setIsLoading] = useState(true);

    const supabase = createClient();
    const router = useRouter();

    // Функция получения роли пользователя из таблицы profiles
    const fetchUserRole = async (userId: string) => {
        const { data, error } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single();

        if (!error && data?.role) {
            setRole(data.role as any);
        } else {
            setRole("user"); // Роль по умолчанию при сбое запроса
        }
    };

    useEffect(() => {
        // 1. Проверяем текущую сессию при загрузке страницы
        const initAuth = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);
                await fetchUserRole(session.user.id);
            } else {
                setUser(null);
                setRole("guest");
            }
            setIsLoading(false);
        };

        initAuth();

        // 2. Подписываемся на динамические изменения (вход, выход, смена токена)
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
