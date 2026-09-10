"use client";

import { create } from "zustand";

export type Theme = "dark" | "light";
const STORAGE_KEY = "theme";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private browsing / storage disabled - theme just won't persist */
  }
}

// Reads whatever the pre-hydration inline script (see layout.tsx) already
// applied to <html>, so the store's initial value matches the DOM instead
// of re-deciding independently.
function getInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  toggle: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    set({ theme: next });
  },
  set: (t) => {
    applyTheme(t);
    set({ theme: t });
  },
}));
