"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, History } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useDisruptionStore } from "@/lib/disruptionStore";
import { applyDisruptionToDecision, getDisruptionForRoute } from "@/lib/disruption";
import { routeId } from "@/lib/simulation";
import { formatCurrency } from "@/lib/currency";
import { useCurrencyStore } from "@/lib/currencyStore";
import type { DecisionRunSummary, Route } from "@/types/api";
import { SectionNav } from "./SectionNav";
import { ShipmentScenarioForm } from "./ShipmentScenarioForm";
import { ForecastPanel } from "./ForecastPanel";
import { CharterTimingCard } from "./CharterTimingCard";
import { VesselOptimizerTable } from "./VesselOptimizerTable";
import { RiskPanel } from "./RiskPanel";
import { ScenarioSimulator } from "./ScenarioSimulator";
import { CostBreakdownPanel } from "./CostBreakdownPanel";
import { ExplainabilityPanel } from "./ExplainabilityPanel";

export function DecisionWorkspaceClient() {
  const searchParams = useSearchParams();
  const { draft, setDraft, result, error, isRunning, loadDemoScenario } = useWorkspaceStore();
  const [recentRuns, setRecentRuns] = useState<DecisionRunSummary[]>([]);
  const [initDone, setInitDone] = useState(false);

  useEffect(() => {
    const demo = searchParams.get("demo");
    const routeCode = searchParams.get("route");
    if (demo === "1") {
      loadDemoScenario();
    } else if (routeCode) {
      api
        .listRoutes()
        .then((routes: Route[]) => {
          const r = routes.find((x) => x.route_id === routeCode);
          if (r) setDraft({ originCode: r.origin_code, destinationCode: r.destination_code, cargoType: r.cargo_type });
        })
        .catch(() => {});
    }
    setInitDone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.listDecisionRuns(8).then(setRecentRuns).catch(() => {});
  }, [result]);

  const { currency } = useCurrencyStore();
  const { events: disruptionEvents, init: initDisruptions } = useDisruptionStore();
  useEffect(() => {
    initDisruptions();
  }, [initDisruptions]);

  const activeDisruption = result
    ? getDisruptionForRoute(routeId(result.shipment.origin_code, result.shipment.destination_code, result.shipment.cargo_type), disruptionEvents)
    : undefined;
  const effectiveResult = result && activeDisruption ? applyDisruptionToDecision(result, activeDisruption) : result;

  if (!initDone) return null;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-white">Decision Workspace</h1>
        <p className="mt-1 text-sm text-base-500">
          Full PREDICT → FEASIBILITY → RISK → OPTIMIZE → EXPLAIN → RECOMMEND pipeline for one shipment scenario.
        </p>
      </div>

      <SectionNav hasResult={!!result} />

      <div className="space-y-4">
        <ShipmentScenarioForm />

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Could not run the decision pipeline</div>
              <div className="mt-0.5 text-xs text-accent-rose/80">{error}</div>
            </div>
          </div>
        )}

        {!result && !isRunning && !error && (
          <div className="rounded-xl border border-dashed border-white/[0.1] bg-base-900/30 px-6 py-14 text-center">
            <p className="text-sm text-base-500">
              Configure the shipment scenario above and click <span className="text-base-100">Run Analysis</span>, or
              select a route on the{" "}
              <a href="/network" className="text-accent-cyan hover:underline">
                Global Network map
              </a>
              .
            </p>
          </div>
        )}

        {effectiveResult && (
          <>
            {activeDisruption && (
              <div className="flex items-start gap-2 rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">Active Disruption: {activeDisruption.label}</div>
                  <div className="mt-0.5 text-xs text-accent-rose/80">
                    Simulated +{activeDisruption.bdi_impact_pct}% BDI impact, {activeDisruption.delay_days}-day delay
                    {activeDisruption.reroute ? ", rerouted" : ""}. Forecast, risk and cost below are adjusted for it — manage
                    disruptions from the Disruption Simulator on the{" "}
                    <a href="/network" className="underline hover:text-accent-rose">
                      Global Network map
                    </a>
                    . (Scenario Simulator cards below still reflect baseline, undisrupted rates.)
                  </div>
                </div>
              </div>
            )}
            <ForecastPanel forecast={effectiveResult.forecast} originCode={effectiveResult.shipment.origin_code} cargoType={effectiveResult.shipment.cargo_type} />
            <CharterTimingCard recommendation={effectiveResult.recommendation} />
            <VesselOptimizerTable feasibility={effectiveResult.feasibility} />
            <RiskPanel risk={effectiveResult.risk} />
            <ScenarioSimulator scenarios={effectiveResult.what_if} />
            <div className="grid gap-4 lg:grid-cols-2">
              <CostBreakdownPanel cost={effectiveResult.cost} />
              <ExplainabilityPanel recommendation={effectiveResult.recommendation} />
            </div>
          </>
        )}

        {recentRuns.length > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-base-850/60 p-4">
            <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-base-500">
              <History className="h-3.5 w-3.5" /> Recent Scenario Runs
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="text-base-500">
                    <th className="pb-2 pr-4 font-medium">Route</th>
                    <th className="pb-2 pr-4 font-medium">Cargo</th>
                    <th className="pb-2 pr-4 font-medium">Qty</th>
                    <th className="pb-2 pr-4 font-medium">Action</th>
                    <th className="pb-2 pr-4 font-medium">Risk</th>
                    <th className="pb-2 font-medium">Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((r) => (
                    <tr key={r.id} className="border-t border-white/[0.05] text-base-100">
                      <td className="py-2 pr-4">
                        {r.origin_code} → {r.destination_code}
                      </td>
                      <td className="py-2 pr-4">{r.cargo_type}</td>
                      <td className="py-2 pr-4">{r.quantity_tonnes.toLocaleString()} t</td>
                      <td className="py-2 pr-4">{r.recommended_action}</td>
                      <td className="py-2 pr-4">{r.overall_risk}</td>
                      <td className="py-2">{formatCurrency(r.total_expected_cost_usd, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
