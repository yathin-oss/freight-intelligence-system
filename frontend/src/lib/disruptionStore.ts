"use client";

import { create } from "zustand";
import { supabase, supabaseConfigured } from "./supabaseClient";
import { DISRUPTION_PRESETS, type DisruptionEvent, type DisruptionPreset } from "@/types/disruption";

interface DisruptionRow {
  instance_id: string;
  route_id: string;
  preset_id: string;
  activated_at: string;
}

function toEvent(row: DisruptionRow): DisruptionEvent | null {
  const preset = DISRUPTION_PRESETS.find((p) => p.id === row.preset_id);
  if (!preset) return null;
  return { ...preset, instance_id: row.instance_id, route_id: row.route_id, activated_at: row.activated_at };
}

interface DisruptionState {
  events: DisruptionEvent[];
  ready: boolean;
  error: string | null;
  init: () => void;
  activate: (routeId: string, preset: DisruptionPreset) => Promise<void>;
  clear: (instanceId: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

let subscribed = false;

export const useDisruptionStore = create<DisruptionState>((set, get) => ({
  events: [],
  ready: false,
  error: null,

  // Idempotent: safe to call from every component that needs disruption
  // state (map + decision workspace) - only the first call actually opens
  // the fetch + realtime subscription.
  init: () => {
    if (subscribed) return;
    subscribed = true;

    if (!supabaseConfigured) {
      set({ ready: true, error: "Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL/ANON_KEY)." });
      return;
    }

    async function refresh() {
      const { data, error } = await supabase
        .from("disruption_events")
        .select("instance_id, route_id, preset_id, activated_at");
      if (error) {
        set({ ready: true, error: error.message });
        return;
      }
      const events = (data as DisruptionRow[]).map(toEvent).filter((e): e is DisruptionEvent => e !== null);
      set({ events, ready: true, error: null });
    }

    refresh();

    supabase
      .channel("disruption_events_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "disruption_events" }, () => {
        refresh();
      })
      .subscribe();
  },

  activate: async (routeId, preset) => {
    if (!supabaseConfigured) return;
    const { error } = await supabase
      .from("disruption_events")
      .upsert({ route_id: routeId, preset_id: preset.id }, { onConflict: "route_id" });
    if (error) set({ error: error.message });
  },

  clear: async (instanceId) => {
    if (!supabaseConfigured) return;
    const { error } = await supabase.from("disruption_events").delete().eq("instance_id", instanceId);
    if (error) set({ error: error.message });
  },

  clearAll: async () => {
    if (!supabaseConfigured) return;
    const ids = get().events.map((e) => e.instance_id);
    if (ids.length === 0) return;
    const { error } = await supabase.from("disruption_events").delete().in("instance_id", ids);
    if (error) set({ error: error.message });
  },
}));
