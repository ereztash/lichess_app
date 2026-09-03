import React, { createContext, useContext, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (!switchable) return defaultTheme;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.theme.key);
      return stored === "light" || stored === "dark" ? stored : defaultTheme;
    } catch {
      // Private windows and blocked site data make this throw. A theme preference is not
      // worth taking the app down for.
      return defaultTheme;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    /*
     * theme-color paints the browser chrome around the page (address bar on mobile, title bar on
     * some desktops). It was a static light value in index.html while the app renders dark by
     * default, so the chrome and the page disagreed. The theme is a stored choice rather than a
     * media query, so no static tag can be right -- it has to follow the choice.
     */
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#14181a" : "#e9e4d8");
  }, [theme]);

  /*
   * THE PREFERENCE IS WRITTEN HERE, ON THE CHOICE, AND NOWHERE ELSE.
   *
   * It used to be written by the effect above, on every mount -- so the first visit persisted
   * whatever the default happened to be, and from then on "the stored preference" meant "the
   * default that shipped the day you first opened this", indistinguishable from a choice the
   * player actually made. Changing the default could then never reach anyone who had loaded the
   * page once, which is everyone.
   *
   * Section 4.5 in storage: an unanswered question and an answered one must not look the same.
   * No entry means no choice, and no choice means the default applies -- today, tomorrow, and
   * after the default changes.
   */
  const toggleTheme = switchable
    ? () =>
        setTheme((prev) => {
          const next = prev === "light" ? "dark" : "light";
          try {
            localStorage.setItem(STORAGE_KEYS.theme.key, next);
          } catch {
            // Private windows and blocked site data make this throw. The theme still switches
            // for this session; it simply does not persist.
          }
          return next;
        })
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
