"use client";

import ThemeToggle from "@/src/components/ThemeToggle/ThemeToggle";
import { useSiteTheme } from "@/src/components/SiteTheme/SiteThemeProvider";

export default function SiteThemeSelect() {
  const { theme, setTheme } = useSiteTheme();
  return <ThemeToggle theme={theme} onChange={setTheme} />;
}
