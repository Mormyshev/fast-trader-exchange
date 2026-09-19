"use client";

import ThemeToggle from "@/src/components/ThemeToggle/ThemeToggle";
import { useStaffTheme } from "@/src/components/staff/StaffThemeProvider";

export default function StaffThemeSelect() {
  const { theme, setTheme } = useStaffTheme();
  return <ThemeToggle theme={theme} onChange={setTheme} />;
}
