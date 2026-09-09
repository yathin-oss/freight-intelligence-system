"use client";

import { useEffect, useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useWorkspaceStore } from "@/lib/store";
import { Panel } from "@/components/ui/Panel";
import type { Origin, Port, VesselClass } from "@/types/api";

const CARGO_TYPES = ["Coal", "Iron Ore"];

export function ShipmentScenarioForm() {
  const { draft, setDraft, setResult, isRunning, setIsRunning, setError } = useWorkspaceStore();
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [vesselClasses, setVesselClasses] = useState<VesselClass[]>([]);
  const [validCargoes, setValidCargoes] = useState<string[]>(CARGO_TYPES);

  useEffect(() => {
    api.listOrigins().then(setOrigins).catch(() => {});
    api.listPorts().then(setPorts).catch(() => {});
    api.listVesselClasses().then(setVesselClasses).catch(() => {});
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
        vessel_code: draft.vesselCode || undefined,
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

        <Field label="Forecast Horizon (weeks)">
          <input
            type="number"
            min={4}
            max={26}
            value={draft.forecastHorizonWeeks}
            onChange={(e) => setDraft({ forecastHorizonWeeks: Number(e.target.value) })}
            className="input"
          />
        </Field>

        <Field label="Vessel Class (optional override)">
          <select
            value={draft.vesselCode || ""}
            onChange={(e) => setDraft({ vesselCode: e.target.value || undefined })}
            className="input"
            title="Leave on Auto to let the feasibility engine pick the cheapest feasible class. An explicit choice is sent as vessel_code and used even if another class would normally be recommended."
          >
            <option value="">Auto (recommended by feasibility engine)</option>
            {vesselClasses.map((v) => (
              <option key={v.code} value={v.code}>
                {v.name} — {v.cargo_capacity_tonnes.toLocaleString()} t capacity
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-end">
          <button
            onClick={runAnalysis}
            disabled={isRunning}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-gold px-4 py-2.5 text-sm font-semibold text-base-950 transition-opacity hover:opacity-90 disabled:opacity-50"
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
          border: 1px solid rgb(var(--c-base-100) / 0.08);
          background: rgb(var(--c-base-900) / 0.8);
          padding: 0.55rem 0.7rem;
          font-size: 13px;
          color: rgb(var(--c-base-100));
        }
        .input:focus {
          outline: none;
          border-color: rgb(var(--c-gold) / 0.4);
          box-shadow: 0 0 0 1px rgb(var(--c-gold) / 0.3);
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
