"use client";

import { createContext, useContext, useState, ReactNode } from "react";

// Доступные роли в приложении
export type UserRole = "guest" | "admin" | "maker" | "user";

interface AuthContextType {
    role: UserRole;
    loginUser: (login: string, pass: string) => boolean;
    logoutUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [role, setRole] = useState<UserRole>("guest");

    const loginUser = (login: string, pass: string): boolean => {
        const u = login.trim().toLowerCase();
        const p = pass.trim();

        if (u === "admin" && p === "admin") {
            setRole("admin");
            return true;
        }
        if (u === "maker" && p === "maker") {
            setRole("maker");
            return true;
        }
        if (u === "user" && p === "user") {
            setRole("user");
            return true;
        }
        return false; // Если данные не совпали
    };

    const logoutUser = () => {
        setRole("guest");
    };

    return (
        <AuthContext.Provider value={{ role, loginUser, logoutUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context)
        throw new Error("useAuth must be used within an AuthProvider");
    return context;
}
