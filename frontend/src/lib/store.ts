"use client";

import { create } from "zustand";
import type { DecisionPipelineResponse } from "@/types/api";

// The one piece of state that connects the Global Network map to the
// Decision Workspace: selecting a route on the map writes here, and the
// workspace reads from it to prefill the shipment scenario form. This is
// the literal implementation of the "map is NOT decorative" requirement.
export interface ShipmentDraft {
  originCode: string;
  destinationCode: string;
  cargoType: string;
  quantityTonnes: number;
  shipmentDate: string;
  contractDurationMonths: number;
  forecastHorizonWeeks: number;
  // Optional explicit vessel override - passed through as ShipmentScenarioRequest.vessel_code.
  // Empty/undefined means "let the backend's feasibility engine pick" (the default).
  vesselCode?: string;
}

export const DEMO_SCENARIO: ShipmentDraft = {
  originCode: "AUNTL",
  destinationCode: "INPAR",
  cargoType: "Coal",
  quantityTonnes: 80000,
  shipmentDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  contractDurationMonths: 3,
  forecastHorizonWeeks: 12,
};

interface WorkspaceState {
  draft: ShipmentDraft;
  setDraft: (patch: Partial<ShipmentDraft>) => void;
  loadDemoScenario: () => void;

  result: DecisionPipelineResponse | null;
  setResult: (result: DecisionPipelineResponse | null) => void;

  isRunning: boolean;
  setIsRunning: (v: boolean) => void;

  error: string | null;
  setError: (e: string | null) => void;

  mapFocus: "world" | "india" | "eastcoast";
  setMapFocus: (f: "world" | "india" | "eastcoast") => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  draft: DEMO_SCENARIO,
  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  loadDemoScenario: () => set({ draft: DEMO_SCENARIO }),

  result: null,
  setResult: (result) => set({ result }),

  isRunning: false,
  setIsRunning: (v) => set({ isRunning: v }),

  error: null,
  setError: (e) => set({ error: e }),

  mapFocus: "world",
  setMapFocus: (f) => set({ mapFocus: f }),
}));
