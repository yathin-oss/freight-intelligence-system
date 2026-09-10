"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Currency = "USD" | "INR";

interface CurrencyState {
  currency: Currency;
  toggle: () => void;
  set: (c: Currency) => void;
}

// Persisted so the choice sticks across reloads - purely a display
// preference, never touches the USD figures stored in Supabase.
export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: "USD",
      toggle: () => set((s) => ({ currency: s.currency === "USD" ? "INR" : "USD" })),
      set: (c) => set({ currency: c }),
    }),
    { name: "freight-currency-pref" }
  )
);
