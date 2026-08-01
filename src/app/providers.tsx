"use client";
import { AuthProvider } from "./context/AuthContext";
import SmoothScroll from "../components/SmoothScroll";

export function Providers({
  children,
  initialUser = null,
  initialRole = "guest",
}: {
  children: React.ReactNode;
  initialUser?: any;
  initialRole?: "guest" | "user" | "operator" | "admin";
}) {
  return (
    <AuthProvider initialUser={initialUser} initialRole={initialRole}>
      <SmoothScroll>{children}</SmoothScroll>
    </AuthProvider>
  );
}
