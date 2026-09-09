"use client";

import { useState } from "react";
import { Filter, SlidersHorizontal } from "lucide-react";

export interface FilterState {
  cargoType: string;
  originCode: string;
  risk: string;
  trend: string;
}

export const DEFAULT_FILTERS: FilterState = { cargoType: "", originCode: "", risk: "", trend: "" };

const CARGO_OPTIONS = ["Coal", "Iron Ore"];
const ORIGIN_OPTIONS = [
  { code: "AUNTL", label: "Australia" },
  { code: "IDSMR", label: "Indonesia" },
  { code: "MZNAC", label: "Mozambique" },
  { code: "RUVVO", label: "Russia" },
  { code: "USNFK", label: "United States" },
];
const RISK_OPTIONS = ["LOW", "MEDIUM", "HIGH"];
const TREND_OPTIONS = ["increasing", "stable", "decreasing"];

export function MapFilters({
  filters,
  onChange,
  colorMode,
  onColorModeChange,
  showLayers,
  onShowLayersChange,
  showLegend,
  onToggleLegend,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  colorMode: "trend" | "risk" | "congestion";
  onColorModeChange: (m: "trend" | "risk" | "congestion") => void;
  showLayers: { ports: boolean; origins: boolean; routes: boolean };
  onShowLayersChange: (s: { ports: boolean; origins: boolean; routes: boolean }) => void;
  showLegend: boolean;
  onToggleLegend: () => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="absolute left-4 top-16 z-10">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-base-100/[0.08] bg-base-900/90 px-3 py-2 text-[12px] font-medium text-base-100 hover:border-base-100/20"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Layers &amp; Filters
        {activeCount > 0 && (
          <span className="ml-1 rounded-full bg-accent-gold/20 px-1.5 py-0.5 text-[10px] text-accent-gold">{activeCount}</span>
        )}
      </button>

      {open && (
        <div className="mt-2 w-72 rounded-lg border border-base-100/[0.08] bg-base-900/95 p-4 shadow-2xl">
          <div className="mb-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-500">Layers</div>
            <div className="flex flex-wrap gap-2">
              {(["ports", "origins", "routes"] as const).map((k) => (
                <label key={k} className="flex items-center gap-1.5 text-[12px] text-base-100">
                  <input
                    type="checkbox"
                    checked={showLayers[k]}
                    onChange={(e) => onShowLayersChange({ ...showLayers, [k]: e.target.checked })}
                    className="h-3.5 w-3.5 accent-accent-gold"
                  />
                  {k === "ports" ? "Ports" : k === "origins" ? "Overseas Origins" : "Shipment Routes"}
                </label>
              ))}
              <label className="flex items-center gap-1.5 text-[12px] text-base-100">
                <input type="checkbox" checked={showLegend} onChange={onToggleLegend} className="h-3.5 w-3.5 accent-accent-gold" />
                Legend
              </label>
            </div>
          </div>

          <div className="mb-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-500">Route Color By</div>
            <div className="flex gap-1.5">
              {(["trend", "risk", "congestion"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onColorModeChange(m)}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] capitalize ${
                    colorMode === m
                      ? "border-accent-gold/40 bg-accent-gold/15 text-accent-gold"
                      : "border-base-100/[0.08] text-base-500 hover:text-base-100"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <FilterSelect
            label="Cargo"
            value={filters.cargoType}
            options={CARGO_OPTIONS.map((c) => ({ value: c, label: c }))}
            onChange={(v) => onChange({ ...filters, cargoType: v })}
          />
          <FilterSelect
            label="Origin"
            value={filters.originCode}
            options={ORIGIN_OPTIONS.map((o) => ({ value: o.code, label: o.label }))}
            onChange={(v) => onChange({ ...filters, originCode: v })}
          />
          <FilterSelect
            label="Risk"
            value={filters.risk}
            options={RISK_OPTIONS.map((r) => ({ value: r, label: r }))}
            onChange={(v) => onChange({ ...filters, risk: v })}
          />
          <FilterSelect
            label="Trend"
            value={filters.trend}
            options={TREND_OPTIONS.map((t) => ({ value: t, label: t }))}
            onChange={(v) => onChange({ ...filters, trend: v })}
          />

          {activeCount > 0 && (
            <button
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="mt-1 w-full rounded-md border border-base-100/[0.08] py-1.5 text-[11px] text-base-500 hover:text-base-100"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-base-500">
        <Filter className="h-2.5 w-2.5" /> {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-base-100/[0.08] bg-base-800 px-2 py-1.5 text-[12px] text-base-100"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
