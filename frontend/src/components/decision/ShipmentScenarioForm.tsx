"use client";

import { useEffect, useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useWorkspaceStore } from "@/lib/store";
import { Panel } from "@/components/ui/Panel";
import type { Origin, Port } from "@/types/api";

const CARGO_TYPES = ["Coal", "Iron Ore"];

type HorizonUnit = "days" | "weeks" | "months";

function weeksFromHorizon(value: number, unit: HorizonUnit): number {
  const raw = unit === "days" ? value / 7 : unit === "months" ? value * 4.345 : value;
  return Math.min(26, Math.max(4, Math.round(raw)));
}

export function ShipmentScenarioForm() {
  const { draft, setDraft, setResult, isRunning, setIsRunning, setError } = useWorkspaceStore();
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [validCargoes, setValidCargoes] = useState<string[]>(CARGO_TYPES);
  const [horizonUnit, setHorizonUnit] = useState<HorizonUnit>("weeks");
  const [horizonValue, setHorizonValue] = useState<number>(draft.forecastHorizonWeeks);

  function updateHorizon(value: number, unit: HorizonUnit) {
    setHorizonValue(value);
    setHorizonUnit(unit);
    setDraft({ forecastHorizonWeeks: weeksFromHorizon(value, unit) });
  }

  useEffect(() => {
    api.listOrigins().then(setOrigins).catch(() => {});
    api.listPorts().then(setPorts).catch(() => {});
  }, []);

  useEffect(() => {
    const o = origins.find((x) => x.code === draft.originCode);
    if (o) setValidCargoes(o.cargoes);
  }, [draft.originCode, origins]);

  async function runAnalysis() {
    setIsRunning(true);
    setError(null);
    try {
      const result = await api.runDecision({
        origin_code: draft.originCode,
        destination_code: draft.destinationCode,
        cargo_type: draft.cargoType,
        quantity_tonnes: draft.quantityTonnes,
        shipment_date: draft.shipmentDate,
        contract_duration_months: draft.contractDurationMonths,
        forecast_horizon_weeks: draft.forecastHorizonWeeks,
      });
      setResult(result);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Unexpected error running the decision pipeline.";
      setError(msg);
      setResult(null);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Panel id="shipment-scenario" title="Section 1 · Shipment Scenario" subtitle="Origin, cargo and destination selected on the map prefill here - adjust freely.">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Field label="Origin">
          <select
            value={draft.originCode}
            onChange={(e) => setDraft({ originCode: e.target.value })}
            className="input"
          >
            {origins.map((o) => (
              <option key={o.code} value={o.code}>
                {o.country} - {o.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Destination (East Coast Port)">
          <select
            value={draft.destinationCode}
            onChange={(e) => setDraft({ destinationCode: e.target.value })}
            className="input"
          >
            {ports.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}, {p.state}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Cargo">
          <select value={draft.cargoType} onChange={(e) => setDraft({ cargoType: e.target.value })} className="input">
            {validCargoes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Quantity (tonnes)">
          <input
            type="number"
            min={1000}
            step={1000}
            value={draft.quantityTonnes}
            onChange={(e) => setDraft({ quantityTonnes: Number(e.target.value) })}
            className="input"
          />
        </Field>

        <Field label="Shipment Date">
          <input
            type="date"
            value={draft.shipmentDate}
            onChange={(e) => setDraft({ shipmentDate: e.target.value })}
            className="input"
          />
        </Field>

        <Field label="Contract Duration (months)">
          <input
            type="number"
            min={1}
            max={24}
            value={draft.contractDurationMonths}
            onChange={(e) => setDraft({ contractDurationMonths: Number(e.target.value) })}
            className="input"
          />
        </Field>

        <Field label="Forecast Horizon">
          <div className="flex gap-1.5">
            <input
              type="number"
              min={1}
              value={horizonValue}
              onChange={(e) => updateHorizon(Number(e.target.value), horizonUnit)}
              className="input w-16 shrink-0"
            />
            <div className="flex flex-1 overflow-hidden rounded-lg border border-white/[0.08]">
              {(["days", "weeks", "months"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => updateHorizon(horizonValue, u)}
                  className={`flex-1 px-1.5 py-1.5 text-[10.5px] font-medium capitalize transition-colors ${
                    horizonUnit === u ? "bg-accent-cyan/20 text-accent-cyan" : "bg-base-900/60 text-base-500 hover:text-base-100"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1 text-[10px] text-base-500/80">= {draft.forecastHorizonWeeks} weeks (4–26 wk range)</div>
        </Field>

        <div className="flex items-end">
          <button
            onClick={runAnalysis}
            disabled={isRunning}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-cyan px-4 py-2.5 text-sm font-semibold text-base-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isRunning ? "Running Pipeline..." : "Run Analysis"}
          </button>
        </div>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(10, 14, 20, 0.8);
          padding: 0.55rem 0.7rem;
          font-size: 13px;
          color: #e6ebf2;
        }
        .input:focus {
          outline: none;
          border-color: rgba(61, 214, 200, 0.4);
          box-shadow: 0 0 0 1px rgba(61, 214, 200, 0.3);
        }
      `}</style>
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-base-500">{label}</div>
      {children}
    </label>
  );
}
