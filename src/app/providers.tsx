"use client";
import { AuthProvider } from "./context/AuthContext";
import SmoothScroll from "../components/SmoothScroll";
import { AuthDialogProvider } from "../components/AuthDialog/AuthDialogProvider";

export function Providers({
  children,
  initialUser = null,
  initialRole = "guest",
  initialStaffActive = false,
  initialIsSeniorOperator = false,
}: {
  children: React.ReactNode;
  initialUser?: any;
  initialRole?: "guest" | "user" | "operator" | "admin";
  initialStaffActive?: boolean;
  initialIsSeniorOperator?: boolean;
}) {
  return (
    <AuthProvider
      initialUser={initialUser}
      initialRole={initialRole}
      initialStaffActive={initialStaffActive}
      initialIsSeniorOperator={initialIsSeniorOperator}
    >
      <AuthDialogProvider>
        <SmoothScroll>{children}</SmoothScroll>
      </AuthDialogProvider>
    </AuthProvider>
  );
}
