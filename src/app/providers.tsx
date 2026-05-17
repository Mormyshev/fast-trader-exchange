"use client";

import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./context/AuthContext";
import SmoothScroll from "../components/SmoothScroll";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange // Полезно: отключает анимации при смене темы во время загрузки
            >
                <SmoothScroll>{children}</SmoothScroll>
            </ThemeProvider>
        </AuthProvider>
    );
}
