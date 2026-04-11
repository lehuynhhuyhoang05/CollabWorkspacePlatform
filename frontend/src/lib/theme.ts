import { useCallback, useEffect, useState } from "react";

export type AppTheme = "light" | "dark";

const THEME_STORAGE_KEY = "cloudcollab.theme";
const THEME_EVENT_NAME = "cloudcollab-theme-change";

function getSystemTheme(): AppTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readTheme(): AppTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return getSystemTheme();
}

function applyTheme(theme: AppTheme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("data-theme", theme);
}

function writeTheme(theme: AppTheme) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new Event(THEME_EVENT_NAME));
}

export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => readTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const syncTheme = () => {
      const nextTheme = readTheme();
      setThemeState(nextTheme);
      applyTheme(nextTheme);
    };

    window.addEventListener(THEME_EVENT_NAME, syncTheme);
    window.addEventListener("storage", syncTheme);

    return () => {
      window.removeEventListener(THEME_EVENT_NAME, syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    writeTheme(nextTheme);
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme: AppTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  }, [setTheme, theme]);

  return {
    theme,
    isDark: theme === "dark",
    setTheme,
    toggleTheme,
  };
}
