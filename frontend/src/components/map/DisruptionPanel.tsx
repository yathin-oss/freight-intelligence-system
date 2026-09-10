"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CloudLightning, Globe2, X, Zap } from "lucide-react";
import { useDisruptionStore } from "@/lib/disruptionStore";
import { DISRUPTION_PRESETS, type DisruptionPreset, type DisruptionType } from "@/types/disruption";
import type { Route } from "@/types/api";

const TYPE_ICON: Record<DisruptionType, typeof CloudLightning> = {
  weather: CloudLightning,
  geopolitical: Globe2,
  congestion: Zap,
};

const TYPE_COLOR: Record<DisruptionType, string> = {
  weather: "#4c8dff",
  geopolitical: "#e8607a",
  congestion: "#e8a33d",
};

export function DisruptionPanel({ routes }: { routes: Route[] }) {
  const [open, setOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<DisruptionPreset>(DISRUPTION_PRESETS[0]);
  const { events, error, init, activate, clear, clearAll } = useDisruptionStore();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!selectedRoute && routes.length > 0) setSelectedRoute(routes[0].route_id);
  }, [routes, selectedRoute]);

  function handleActivate() {
    if (!selectedRoute) return;
    activate(selectedRoute, selectedPreset);
  }

  const routeByCode = new Map(routes.map((r) => [r.route_id, r]));

  return (
    <div className="absolute left-4 top-28 z-10">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-base-900/90 px-3 py-2 text-[12px] font-medium text-base-100 hover:border-white/20"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Disruption Simulator
        {events.length > 0 && (
          <span className="ml-1 rounded-full bg-accent-rose/25 px-1.5 py-0.5 text-[10px] text-accent-rose">{events.length}</span>
        )}
      </button>

      {open && (
        <div className="mt-2 w-80 rounded-lg border border-white/[0.08] bg-base-900/95 p-4 shadow-2xl">
          <div className="mb-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-500">Affected Route</div>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="w-full rounded-md border border-white/[0.08] bg-base-800 px-2 py-1.5 text-[12px] text-base-100"
            >
              {routes.map((r) => (
                <option key={r.route_id} value={r.route_id}>
                  {r.origin_name} → {r.destination_name} ({r.cargo_type})
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-500">Scenario</div>
            <div className="space-y-1.5">
              {DISRUPTION_PRESETS.map((p) => {
                const Icon = TYPE_ICON[p.type];
                const active = selectedPreset.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPreset(p)}
                    className={`flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${
                      active ? "border-accent-cyan/40 bg-accent-cyan/[0.08]" : "border-white/[0.06] hover:border-white/20"
                    }`}
                  >
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: TYPE_COLOR[p.type] }} />
                    <div className="flex-1">
                      <div className="text-[11.5px] font-medium text-base-100">{p.label}</div>
                      <div className="mt-0.5 text-[10.5px] leading-snug text-base-500">
                        +{p.bdi_impact_pct}% BDI · {p.delay_days}d delay{p.reroute ? " · reroute" : ""}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleActivate}
            disabled={!selectedRoute}
            className="w-full rounded-lg bg-accent-rose/20 px-3 py-2 text-[12px] font-semibold text-accent-rose ring-1 ring-accent-rose/30 hover:bg-accent-rose/30 disabled:opacity-40"
          >
            Activate Disruption
          </button>

          {error && <div className="mt-2 text-[10.5px] text-accent-rose">{error}</div>}

          {events.length > 0 && (
            <div className="mt-3 border-t border-white/[0.08] pt-3">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-base-500">
                Active Disruptions
                <button onClick={() => clearAll()} className="text-accent-cyan hover:underline">
                  Clear All
                </button>
              </div>
              <div className="space-y-1.5">
                {events.map((e) => {
                  const route = routeByCode.get(e.route_id);
                  return (
                    <div key={e.instance_id} className="flex items-center justify-between gap-2 rounded-md bg-base-800/70 px-2.5 py-1.5 text-[11px]">
                      <div className="min-w-0">
                        <div className="truncate text-base-100">{e.label}</div>
                        <div className="truncate text-[10px] text-base-500">
                          {route ? `${route.origin_name} → ${route.destination_name}` : e.route_id}
                        </div>
                      </div>
                      <button onClick={() => clear(e.instance_id)} className="shrink-0 text-base-500 hover:text-accent-rose">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
