// Data layer: Supabase is the sole data store (no separate FastAPI backend
// exists). Reference data (ports/origins/vessel classes/routes/history)
// comes straight from Supabase tables; the PREDICT/FEASIBILITY/RISK/
// OPTIMIZE/RECOMMEND pipeline is computed by the deterministic simulation
// functions in lib/simulation.ts and persisted to decision_runs for history.
// See supabase/schema.sql + supabase/seed.sql for the table definitions.
import { supabase, supabaseConfigured } from "./supabaseClient";
import {
  buildForecast,
  computeCost,
  computeFeasibility,
  computeRecommendation,
  computeRisk,
  computeWhatIf,
} from "./simulation";
import type {
  DecisionPipelineResponse,
  DecisionRunSummary,
  FeasibilityResponse,
  ForecastOut,
  FreightRatePoint,
  Origin,
  Port,
  Route,
  SearchResponse,
  SearchResultItem,
  ShipmentScenarioRequest,
  SystemStatus,
  VesselClass,
} from "@/types/api";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function assertConfigured() {
  if (!supabaseConfigured) {
    throw new ApiError(
      "Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
      0,
      { reason: "not_configured" }
    );
  }
}

function fail(message: string, payload: unknown): never {
  throw new ApiError(message, 0, payload);
}

async function listPortsInternal(): Promise<Port[]> {
  assertConfigured();
  const { data, error } = await supabase.from("ports").select("*").order("code");
  if (error) fail(error.message, error);
  return data as Port[];
}

async function getPortInternal(code: string): Promise<Port> {
  assertConfigured();
  const { data, error } = await supabase.from("ports").select("*").eq("code", code).single();
  if (error) fail(error.message, error);
  return data as Port;
}

async function listOriginsInternal(): Promise<Origin[]> {
  assertConfigured();
  const { data, error } = await supabase.from("origins").select("*").order("code");
  if (error) fail(error.message, error);
  return data as Origin[];
}

async function listVesselClassesInternal(): Promise<VesselClass[]> {
  assertConfigured();
  const { data, error } = await supabase.from("vessel_classes").select("*").order("cargo_capacity_tonnes");
  if (error) fail(error.message, error);
  return data as VesselClass[];
}

async function listRoutesInternal(params?: Record<string, string>): Promise<Route[]> {
  assertConfigured();
  let query = supabase.from("routes").select("*");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      query = query.eq(key, value);
    }
  }
  const { data, error } = await query.order("route_id");
  if (error) fail(error.message, error);
  return data as Route[];
}

async function freightRateHistoryInternal(originCode: string, cargoType: string, weeks = 52): Promise<FreightRatePoint[]> {
  assertConfigured();
  const { data, error } = await supabase
    .from("freight_rate_history")
    .select("date, rate_usd_per_tonne")
    .eq("origin_code", originCode)
    .eq("cargo_type", cargoType)
    .order("date", { ascending: true });
  if (error) fail(error.message, error);
  const rows = (data ?? []) as FreightRatePoint[];
  return rows.slice(Math.max(0, rows.length - weeks));
}

async function forecastInternal(originCode: string, cargoType: string, horizonWeeks: number): Promise<ForecastOut> {
  const history = await freightRateHistoryInternal(originCode, cargoType, 104);
  return buildForecast(originCode, cargoType, history, horizonWeeks);
}

async function feasibilityInternal(destinationCode: string, cargoType: string, quantityTonnes: number): Promise<FeasibilityResponse> {
  const [port, vesselClasses] = await Promise.all([getPortInternal(destinationCode), listVesselClassesInternal()]);
  return computeFeasibility(port, quantityTonnes, vesselClasses);
}

async function runDecisionInternal(payload: ShipmentScenarioRequest): Promise<DecisionPipelineResponse> {
  const { origin_code, destination_code, cargo_type, quantity_tonnes, forecast_horizon_weeks } = payload;

  const [port, vesselClasses, routes, allPorts, forecast] = await Promise.all([
    getPortInternal(destination_code),
    listVesselClassesInternal(),
    listRoutesInternal({ origin_code, destination_code, cargo_type }),
    listPortsInternal(),
    forecastInternal(origin_code, cargo_type, forecast_horizon_weeks),
  ]);

  const route = routes[0];
  const feasibility = computeFeasibility(port, quantity_tonnes, vesselClasses);
  const risk = computeRisk(port, route);
  const recommendedVessel = vesselClasses.find((v) => v.code === feasibility.recommended_vessel_code) ?? vesselClasses[0];
  const cost = computeCost(forecast.current_rate, quantity_tonnes, recommendedVessel, risk, route?.distance_nm ?? 8000);
  const recommendation = computeRecommendation(forecast, risk, cost);
  const { scenarios, bestId } = computeWhatIf(forecast, route, port, allPorts, vesselClasses, feasibility, risk, quantity_tonnes);

  const result: DecisionPipelineResponse = {
    run_id: null,
    shipment: payload,
    forecast,
    feasibility,
    risk,
    cost,
    recommendation,
    what_if: scenarios,
    best_scenario_id: bestId,
    generated_at: new Date().toISOString(),
    data_status: "SYNTHETIC",
  };

  // Best-effort persistence: the workspace still renders the result even if
  // this insert fails (e.g. schema.sql hasn't been run against this project
  // yet), it just won't show up in "Recent Scenario Runs".
  try {
    const { data, error } = await supabase
      .from("decision_runs")
      .insert({
        origin_code,
        destination_code,
        cargo_type,
        quantity_tonnes,
        recommended_action: recommendation.action,
        overall_risk: risk.overall,
        total_expected_cost_usd: cost.total_expected_cost_usd,
        model_version: forecast.model_version,
        full_result: result,
      })
      .select("id")
      .single();
    if (!error && data) result.run_id = data.id as number;
  } catch {
    /* non-fatal, see comment above */
  }

  return result;
}

async function listDecisionRunsInternal(limit = 25): Promise<DecisionRunSummary[]> {
  assertConfigured();
  const { data, error } = await supabase
    .from("decision_runs")
    .select("id, created_at, origin_code, destination_code, cargo_type, quantity_tonnes, recommended_action, overall_risk, total_expected_cost_usd, model_version")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail(error.message, error);
  return data as DecisionRunSummary[];
}

async function getDecisionRunInternal(id: number): Promise<DecisionPipelineResponse> {
  assertConfigured();
  const { data, error } = await supabase.from("decision_runs").select("full_result").eq("id", id).single();
  if (error) fail(error.message, error);
  return (data as { full_result: DecisionPipelineResponse }).full_result;
}

async function searchInternal(q: string): Promise<SearchResponse> {
  assertConfigured();
  if (q.trim().length < 2) return { query: q, results: [] };
  const like = `%${q}%`;

  const [portsRes, originsRes, vesselsRes] = await Promise.all([
    supabase.from("ports").select("code, name, state").ilike("name", like).limit(5),
    supabase.from("origins").select("code, name, country").ilike("name", like).limit(5),
    supabase.from("vessel_classes").select("code, name").ilike("name", like).limit(5),
  ]);

  const results: SearchResultItem[] = [
    ...((portsRes.data ?? []) as { code: string; name: string; state: string }[]).map((p) => ({
      type: "port" as const,
      code: p.code,
      label: p.name,
      subtitle: `${p.state}, India`,
      action: `/ports/${p.code}`,
    })),
    ...((originsRes.data ?? []) as { code: string; name: string; country: string }[]).map((o) => ({
      type: "origin" as const,
      code: o.code,
      label: o.name,
      subtitle: o.country,
      action: "/decision",
    })),
    ...((vesselsRes.data ?? []) as { code: string; name: string }[]).map((v) => ({
      type: "vessel_class" as const,
      code: v.code,
      label: v.name,
      subtitle: "Vessel class",
      action: "/decision",
    })),
  ];

  return { query: q, results };
}

async function statusInternal(): Promise<SystemStatus> {
  const items: SystemStatus["items"] = [];
  let dbState: "available" | "error" | "not_connected" = "not_connected";

  if (!supabaseConfigured) {
    items.push({ name: "Supabase Connection", state: "not_connected", detail: "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set." });
  } else {
    const { error, count } = await supabase.from("ports").select("code", { count: "exact", head: true });
    if (error) {
      dbState = "error";
      items.push({ name: "Supabase Connection", state: "error", detail: error.message });
    } else {
      dbState = "available";
      items.push({ name: "Supabase Connection", state: "available", detail: `Connected — ${count ?? 0} ports on file.` });
    }
  }

  items.push({ name: "Forecast Engine", state: "prototype", detail: "Seeded random-walk simulation (lib/simulation.ts) — no live ML model connected." });
  items.push({ name: "Disruption Simulator", state: "prototype", detail: "Manual preset-based disruption events, stored in Supabase with realtime sync." });
  items.push({ name: "FastAPI Backend", state: "not_connected", detail: "No backend service in this deployment — the frontend talks to Supabase directly." });

  return {
    items,
    ml_model_version: "sim-v1",
    ml_model_ready: false,
    database_url_kind: dbState === "available" ? "supabase (postgres)" : "supabase (unreachable)",
    generated_at: new Date().toISOString(),
  };
}

// Not part of the original backend-mirrored `api` contract — this is the
// "loads" (per-vessel-class historic rate) data described in
// implementation_plan.txt Section 1b, consumed only by VesselOptimizerTable.
export async function vesselClassRateHistory(vesselCode: string, weeks = 26): Promise<{ date: string; daily_hire_usd: number }[]> {
  assertConfigured();
  const { data, error } = await supabase
    .from("vessel_class_rate_history")
    .select("date, daily_hire_usd")
    .eq("vessel_code", vesselCode)
    .order("date", { ascending: true });
  if (error) fail(error.message, error);
  const rows = (data ?? []) as { date: string; daily_hire_usd: number }[];
  return rows.slice(Math.max(0, rows.length - weeks));
}

export const api = {
  listPorts: listPortsInternal,
  getPort: getPortInternal,
  listOrigins: listOriginsInternal,
  listVesselClasses: listVesselClassesInternal,
  listRoutes: listRoutesInternal,
  freightRateHistory: freightRateHistoryInternal,
  forecast: forecastInternal,
  feasibility: feasibilityInternal,
  runDecision: runDecisionInternal,
  listDecisionRuns: listDecisionRunsInternal,
  getDecisionRun: getDecisionRunInternal,
  search: searchInternal,
  status: statusInternal,
};
