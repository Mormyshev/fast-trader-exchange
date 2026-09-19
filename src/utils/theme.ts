export const SITE_THEME_COOKIE = "fte-theme";
export const SITE_THEME_STORAGE_KEY = "fte-theme";

export type SiteTheme = "light" | "dark";

export function parseSiteTheme(value: string | null | undefined): SiteTheme {
  return value === "dark" ? "dark" : "light";
}

export function isStaffPath(pathname: string | null | undefined): boolean {
  const path = pathname || "";
  return path.startsWith("/operator") || path.startsWith("/admin");
}

export function persistSiteTheme(theme: SiteTheme) {
  document.cookie = `${SITE_THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  try {
    localStorage.setItem(SITE_THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function applySiteDocumentTheme(theme: SiteTheme) {
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.classList.remove("staff-dark");
}
