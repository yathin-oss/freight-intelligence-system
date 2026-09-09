"use client";

import { create } from "zustand";

export type Theme = "light" | "dark";

const STORAGE_KEY = "sih26006-theme";

// Default is light (per product decision), not system preference - the app
// only switches to dark if the viewer explicitly toggled it before, or
// toggles it now. Kept in sync with the inline blocking script in
// layout.tsx, which sets the same class on <html> before first paint so
// there is no flash of the wrong theme.
function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  // Reads whatever the blocking script already applied to <html>, so the
  // store starts in sync instead of forcing a re-render on mount.
  theme: readInitialTheme(),
  setTheme: (t) => {
    applyThemeClass(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* private browsing / storage blocked - theme just won't persist */
    }
    set({ theme: t });
  },
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));
