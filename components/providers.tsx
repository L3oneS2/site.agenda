"use client";

import { Toaster } from "sonner";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
} | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within Providers");
  return ctx;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  const apply = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.classList.toggle("dark", t === "dark");
    localStorage.setItem("theme", t);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    const prefersDark =
      window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    apply(stored ?? (prefersDark ? "dark" : "light"));
  }, [apply]);

  const setTheme = useCallback((t: Theme) => apply(t), [apply]);
  const toggle = useCallback(
    () => apply(theme === "dark" ? "light" : "dark"),
    [apply, theme]
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
      <Toaster
        richColors
        position="top-center"
        toastOptions={{
          classNames: {
            toast:
              "!rounded-2xl !border !border-[var(--border)] !bg-[var(--card)] !text-[var(--fg)] !shadow-soft",
          },
        }}
      />
    </ThemeContext.Provider>
  );
}
