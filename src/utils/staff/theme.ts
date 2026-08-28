export const STAFF_THEME_COOKIE = "fte-staff-theme";
export const STAFF_THEME_STORAGE_KEY = "fte-staff-theme";

export type StaffTheme = "light" | "dark";

export function parseStaffTheme(value: string | null | undefined): StaffTheme {
  return value === "dark" ? "dark" : "light";
}

export function persistStaffTheme(theme: StaffTheme) {
  document.cookie = `${STAFF_THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  try {
    localStorage.setItem(STAFF_THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}
