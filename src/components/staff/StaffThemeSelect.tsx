"use client";

import { Moon, Sun } from "lucide-react";
import { useStaffTheme } from "@/src/components/staff/StaffThemeProvider";

export default function StaffThemeSelect() {
  const { theme, setTheme } = useStaffTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Тёмная тема" : "Светлая тема"}
      title={isDark ? "Тёмная тема" : "Светлая тема"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`relative h-8 w-16 shrink-0 rounded-full p-0.5 transition-colors duration-300 ease-out ${
        isDark
          ? "bg-zinc-700 shadow-[inset_0_1px_3px_rgba(0,0,0,0.45)]"
          : "bg-[#FFDD2D] shadow-[inset_0_1px_3px_rgba(15,23,42,0.12)]"
      }`}
    >
      <Sun
        aria-hidden
        className={`absolute top-1/2 left-[7px] size-3.5 -translate-y-1/2 text-[#FDE68A] transition-opacity duration-300 ${
          isDark ? "opacity-100" : "opacity-0"
        }`}
      />
      <Moon
        aria-hidden
        className={`absolute top-1/2 right-[7px] size-3.5 -translate-y-1/2 text-[#52525B]/70 transition-opacity duration-300 ${
          isDark ? "opacity-0" : "opacity-100"
        }`}
      />
      <span
        aria-hidden
        className={`absolute top-0.5 left-0.5 flex size-7 items-center justify-center rounded-full bg-[#FFFFFF] shadow-[0_2px_6px_rgba(15,23,42,0.22)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isDark ? "translate-x-8" : "translate-x-0"
        }`}
      >
        {isDark ? (
          <Moon className="size-3.5 text-[#3F3F46]" />
        ) : (
          <Sun className="size-3.5 text-[#C9A227]" />
        )}
      </span>
    </button>
  );
}
