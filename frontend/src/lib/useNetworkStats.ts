"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Port, Route } from "@/types/api";
import { DEMO_SCENARIO } from "@/lib/store";

// Powers the top-bar ticker strip (visible on every page) with numbers that
// are either a straight count of a real API response, or a single named
// field pulled from a real Route row - never a fabricated live-telemetry
// number ("142 active vessels", "AIS sync 100%", etc. from the Stitch
// visual references do not have a real data source and are intentionally
// not reproduced here).
export interface NetworkStats {
  loading: boolean;
  portCount: number | null;
  laneCount: number | null;
  highRiskPortCount: number | null;
  decreasingLaneCount: number | null;
  /** Reference freight rate for the demo lane, straight from Route.reference_freight_usd_per_tonne. */
  demoLaneRate: number | null;
  demoLaneTrendPct: number | null;
}

let cache: { ports: Port[]; routes: Route[] } | null = null;

export function useNetworkStats(): NetworkStats {
  const [state, setState] = useState<{ ports: Port[]; routes: Route[] } | null>(cache);

  useEffect(() => {
    if (cache) return;
    Promise.all([api.listPorts(), api.listRoutes()])
      .then(([ports, routes]) => {
        cache = { ports, routes };
        setState(cache);
      })
      .catch(() => {
        /* ticker just shows placeholders - never invent a number on failure */
      });
  }, []);

  if (!state) {
    return {
      loading: true,
      portCount: null,
      laneCount: null,
      highRiskPortCount: null,
      decreasingLaneCount: null,
      demoLaneRate: null,
      demoLaneTrendPct: null,
    };
  }

  const demoLane = state.routes.find(
    (r) => r.origin_code === DEMO_SCENARIO.originCode && r.destination_code === DEMO_SCENARIO.destinationCode && r.cargo_type === DEMO_SCENARIO.cargoType
  );

  return {
    loading: false,
    portCount: state.ports.length,
    laneCount: state.routes.length,
    highRiskPortCount: state.ports.filter((p) => p.risk === "HIGH").length,
    decreasingLaneCount: state.routes.filter((r) => r.trend === "decreasing").length,
    demoLaneRate: demoLane?.reference_freight_usd_per_tonne ?? null,
    demoLaneTrendPct: demoLane?.trend_pct_8wk ?? null,
  };
}

/** Raw ports/routes, sharing the same module-level cache as useNetworkStats
 * (so a page that already renders the Nav ticker doesn't trigger a second
 * fetch) - for components that need to look up a specific port/route rather
 * than the aggregate counts above. */
export function useRawNetworkData(): { ports: Port[]; routes: Route[]; loading: boolean } {
  const [state, setState] = useState<{ ports: Port[]; routes: Route[] } | null>(cache);

  useEffect(() => {
    if (cache) return;
    Promise.all([api.listPorts(), api.listRoutes()])
      .then(([ports, routes]) => {
        cache = { ports, routes };
        setState(cache);
      })
      .catch(() => {});
  }, []);

  return { ports: state?.ports ?? [], routes: state?.routes ?? [], loading: !state };
}
