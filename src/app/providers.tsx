"use client";
import { AuthProvider } from "./context/AuthContext";
import SmoothScroll from "../components/SmoothScroll";
import { AuthDialogProvider } from "../components/AuthDialog/AuthDialogProvider";
import { SiteThemeProvider } from "../components/SiteTheme/SiteThemeProvider";
import type { SiteTheme } from "../utils/theme";

export function Providers({
  children,
  initialUser = null,
  initialRole = "guest",
  initialStaffActive = false,
  initialIsSeniorOperator = false,
  initialSiteTheme = "light",
}: {
  children: React.ReactNode;
  initialUser?: any;
  initialRole?: "guest" | "user" | "operator" | "admin";
  initialStaffActive?: boolean;
  initialIsSeniorOperator?: boolean;
  initialSiteTheme?: SiteTheme;
}) {
  return (
    <SiteThemeProvider initialTheme={initialSiteTheme}>
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
    </SiteThemeProvider>
  );
}
