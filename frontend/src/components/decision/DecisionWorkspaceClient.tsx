"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useRawNetworkData } from "@/lib/useNetworkStats";
import { computeTce } from "@/lib/tce";
import { estimatedVoyageDays } from "@/lib/geo";
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
import { RecentActivityPanel } from "./RecentActivityPanel";

export function DecisionWorkspaceClient() {
  const searchParams = useSearchParams();
  const { draft, setDraft, result, error, isRunning, loadDemoScenario } = useWorkspaceStore();
  const [recentRuns, setRecentRuns] = useState<DecisionRunSummary[]>([]);
  const [initDone, setInitDone] = useState(false);
  const { routes } = useRawNetworkData();

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
    api.listDecisionRuns(25).then(setRecentRuns).catch(() => {});
  }, [result]);

  // TCE is computed here (not inside CharterTimingCard) because it needs the
  // route's distance, which the decision pipeline response doesn't carry -
  // only Route[] (already fetched for the map/nav ticker) has it.
  const tce = useMemo(() => {
    if (!result) return null;
    const route = routes.find(
      (r) =>
        r.origin_code === result.shipment.origin_code &&
        r.destination_code === result.shipment.destination_code &&
        r.cargo_type === result.shipment.cargo_type
    );
    const recommendedVesselCode = result.feasibility.recommended_vessel_code;
    const vesselResult = result.feasibility.results.find((v) => v.vessel_code === recommendedVesselCode);
    if (!route || !vesselResult) return null;
    return computeTce({
      freightCostUsd: result.cost.freight_cost_usd,
      dailyHireUsd: vesselResult.estimated_daily_hire_usd,
      voyageDays: estimatedVoyageDays(route.distance_nm),
    });
  }, [result, routes]);

  if (!initDone) return null;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-base-100">Decision Workspace</h1>
        <p className="mt-1 text-sm text-base-500">
          Full PREDICT → FEASIBILITY → RISK → OPTIMIZE → EXPLAIN → RECOMMEND pipeline for one shipment scenario.
        </p>
      </div>

      <SectionNav hasResult={!!result} />

      <div className="space-y-4">
        <ShipmentScenarioForm />

        {error && (
          <div className="flex items-start gap-2 rounded border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Could not run the decision pipeline</div>
              <div className="mt-0.5 text-xs text-accent-rose/80">{error}</div>
            </div>
          </div>
        )}

        {!result && !isRunning && !error && (
          <div className="rounded border border-dashed border-base-100/[0.12] bg-base-900/30 px-6 py-14 text-center">
            <p className="text-sm text-base-500">
              Configure the shipment scenario above and click <span className="text-base-100">Run Analysis</span>, or
              select a route on the{" "}
              <a href="/network" className="text-accent-gold hover:underline">
                Global Network map
              </a>
              .
            </p>
          </div>
        )}

        {result && (
          <>
            <ForecastPanel forecast={result.forecast} originCode={result.shipment.origin_code} cargoType={result.shipment.cargo_type} />
            <CharterTimingCard recommendation={result.recommendation} tce={tce} />
            <VesselOptimizerTable feasibility={result.feasibility} />
            <RiskPanel risk={result.risk} />
            <ScenarioSimulator scenarios={result.what_if} />
            <div className="grid gap-4 lg:grid-cols-2">
              <CostBreakdownPanel cost={result.cost} />
              <ExplainabilityPanel recommendation={result.recommendation} />
            </div>
          </>
        )}

        <RecentActivityPanel runs={recentRuns} />
      </div>
    </div>
  );
}
