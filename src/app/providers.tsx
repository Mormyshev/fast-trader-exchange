"use client";

import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./context/AuthContext";
import SmoothScroll from "../components/SmoothScroll";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <SmoothScroll>{children}</SmoothScroll>
        </AuthProvider>
    );
}
