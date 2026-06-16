"use client";
import { AuthProvider } from "./context/AuthContext";
import SmoothScroll from "../components/SmoothScroll";

export function Providers({
  children,
  initialUser,
  initialRole,
}: {
  children: React.ReactNode;
  initialUser?: any;
  initialRole?: any;
}) {
  return (
    <AuthProvider initialUser={initialUser} initialRole={initialRole}>
      <SmoothScroll>{children}</SmoothScroll>
    </AuthProvider>
  );
}
