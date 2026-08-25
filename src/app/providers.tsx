"use client";
import { AuthProvider } from "./context/AuthContext";
import SmoothScroll from "../components/SmoothScroll";
import { AuthDialogProvider } from "../components/AuthDialog/AuthDialogProvider";

export function Providers({
  children,
  initialUser = null,
  initialRole = "guest",
  initialStaffActive = false,
}: {
  children: React.ReactNode;
  initialUser?: any;
  initialRole?: "guest" | "user" | "operator" | "admin";
  initialStaffActive?: boolean;
}) {
  return (
    <AuthProvider
      initialUser={initialUser}
      initialRole={initialRole}
      initialStaffActive={initialStaffActive}
    >
      <AuthDialogProvider>
        <SmoothScroll>{children}</SmoothScroll>
      </AuthDialogProvider>
    </AuthProvider>
  );
}
