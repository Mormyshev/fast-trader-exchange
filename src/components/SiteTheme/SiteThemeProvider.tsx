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
import { usePathname } from "next/navigation";
import {
  applySiteDocumentTheme,
  isStaffPath,
  persistSiteTheme,
  SITE_THEME_STORAGE_KEY,
  type SiteTheme,
} from "@/src/utils/theme";

type SiteThemeContextValue = {
  theme: SiteTheme;
  setTheme: (theme: SiteTheme) => void;
};

const SiteThemeContext = createContext<SiteThemeContextValue>({
  theme: "light",
  setTheme: () => {},
});

export function SiteThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: SiteTheme;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [theme, setThemeState] = useState<SiteTheme>(initialTheme);

  const setTheme = useCallback((next: SiteTheme) => {
    setThemeState(next);
    persistSiteTheme(next);
    if (!isStaffPath(window.location.pathname)) {
      applySiteDocumentTheme(next);
    }
  }, []);

  useLayoutEffect(() => {
    if (isStaffPath(pathname)) return;

    let next = theme;
    try {
      const stored = localStorage.getItem(SITE_THEME_STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        next = stored;
        if (stored !== theme) setThemeState(stored);
      }
      persistSiteTheme(next);
    } catch {
      // ignore
    }
    applySiteDocumentTheme(next);
    // Sync from storage once per public route; later changes go through setTheme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <SiteThemeContext.Provider value={value}>
      {children}
    </SiteThemeContext.Provider>
  );
}

export function useSiteTheme() {
  return useContext(SiteThemeContext);
}
