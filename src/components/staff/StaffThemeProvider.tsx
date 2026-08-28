"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  persistStaffTheme,
  STAFF_THEME_STORAGE_KEY,
  type StaffTheme,
} from "@/src/utils/staff/theme";

type StaffThemeContextValue = {
  theme: StaffTheme;
  setTheme: (theme: StaffTheme) => void;
};

const StaffThemeContext = createContext<StaffThemeContextValue>({
  theme: "light",
  setTheme: () => {},
});

function applyDocumentTheme(theme: StaffTheme) {
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("staff-dark", isDark);
  document.documentElement.classList.toggle("dark", isDark);
}

export function StaffThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: StaffTheme;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<StaffTheme>(initialTheme);

  const setTheme = useCallback((next: StaffTheme) => {
    setThemeState(next);
    persistStaffTheme(next);
    applyDocumentTheme(next);
  }, []);

  useLayoutEffect(() => {
    let next = theme;
    try {
      const stored = localStorage.getItem(STAFF_THEME_STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        next = stored;
        if (stored !== theme) {
          setThemeState(stored);
        }
      }
      persistStaffTheme(next);
    } catch {
      // ignore
    }
    applyDocumentTheme(next);

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyHeight = body.style.height;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.height = "100dvh";

    return () => {
      document.documentElement.classList.remove("staff-dark", "dark");
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.height = prevBodyHeight;
    };
    // Sync from storage once on mount; later changes go through setTheme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <StaffThemeContext.Provider value={value}>
      <div
        id="staff-app"
        className={`staff-app flex h-dvh min-h-0 flex-col overflow-hidden ${
          theme === "dark" ? "dark bg-zinc-950 text-zinc-100" : "bg-[#F4F5F7]"
        }`}
      >
        {children}
      </div>
    </StaffThemeContext.Provider>
  );
}

export function useStaffTheme() {
  return useContext(StaffThemeContext);
}
