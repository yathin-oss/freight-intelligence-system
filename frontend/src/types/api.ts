// Mirrors backend/app/schemas/*.py exactly. The frontend never computes or
// hardcodes forecast/risk/cost/recommendation numbers - every field here is
// populated straight from the FastAPI response.

export type DataStatus = "ESTIMATED" | "SYNTHETIC" | "prototype" | "prototype-fallback" | "unavailable" | "available" | "error";

export interface Port {
  code: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  port_type: string;
  draft_limit_m: number | null;
  loa_limit_m: number | null;
  beam_limit_m: number | null;
  congestion: "LOW" | "MEDIUM" | "HIGH";
  risk: "LOW" | "MEDIUM" | "HIGH";
  compatible_classes: string[];
  notes: string;
  data_status: string;
}

export interface Origin {
  code: string;
  country: string;
  name: string;
  lat: number;
  lon: number;
  cargoes: string[];
  data_status: string;
}

export interface VesselClass {
  code: string;
  name: string;
  dwt_tonnes: number;
  draft_m: number;
  loa_m: number;
  beam_m: number;
  cargo_capacity_tonnes: number;
  typical_daily_hire_usd: number;
  data_status: string;
}

export interface Route {
  route_id: string;
  origin_code: string;
  origin_country: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  cargo_type: string;
  distance_nm: number;
  reference_freight_usd_per_tonne: number;
  indicative_annual_volume_tonnes: number;
  trend: "increasing" | "decreasing" | "stable";
  trend_pct_8wk: number;
  congestion: "LOW" | "MEDIUM" | "HIGH";
  risk: "LOW" | "MEDIUM" | "HIGH";
  route_status: string;
  data_status: string;
}

export interface FreightRatePoint {
  date: string;
  rate_usd_per_tonne: number;
}

export interface ForecastPoint {
  week_offset: number;
  date: string;
  predicted_rate: number;
  lower: number;
  upper: number;
}

export interface ForecastOut {
  origin_code: string;
  cargo_type: string;
  current_rate: number;
  current_rate_date: string;
  forecast: ForecastPoint[];
  trend: "increasing" | "decreasing" | "stable";
  trend_pct: number;
  confidence: number;
  volatility: "low" | "medium" | "high";
  model_version: string;
  data_status: string;
  method_note: string;
}

export interface FeasibilityCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface VesselFeasibilityOut {
  vessel_code: string;
  vessel_class: string;
  feasible: boolean;
  checks: FeasibilityCheck[];
  rejection_reasons: string[];
  estimated_freight_cost_usd: number | null;
  estimated_daily_hire_usd: number;
}

export interface FeasibilityResponse {
  destination_code: string;
  quantity_tonnes: number;
  results: VesselFeasibilityOut[];
  recommended_vessel_code: string | null;
  data_status: string;
}

export interface RiskFactor {
  label: string;
  level: "LOW" | "MEDIUM" | "HIGH" | "UNAVAILABLE";
  detail: string;
}

export interface RiskAssessmentOut {
  overall: "LOW" | "MEDIUM" | "HIGH";
  factors: RiskFactor[];
  data_status: string;
}

export interface CostBreakdown {
  freight_cost_usd: number;
  expected_idle_cost_usd: number;
  expected_demurrage_usd: number;
  deadheading_cost_usd: number;
  risk_penalty_usd: number;
  total_expected_cost_usd: number;
  assumptions: string[];
  data_status: string;
}

export interface ShipmentScenarioRequest {
  origin_code: string;
  destination_code: string;
  cargo_type: string;
  quantity_tonnes: number;
  shipment_date: string;
  contract_duration_months: number;
  forecast_horizon_weeks: number;
  vessel_code?: string | null;
}

export interface ExplanationItem {
  order: number;
  statement: string;
}

export type RecommendationAction = "BOOK_NOW" | "WAIT" | "BOOK_WITHIN_RANGE" | "MONITOR";

export interface RecommendationOut {
  action: RecommendationAction;
  headline: string;
  wait_weeks_min: number | null;
  wait_weeks_max: number | null;
  explanation: ExplanationItem[];
  data_status: string;
}

export interface WhatIfScenario {
  scenario_id: string;
  label: string;
  description: string;
  vessel_code: string;
  vessel_class: string;
  destination_code: string;
  destination_name: string;
  wait_weeks: number;
  feasible: boolean;
  feasibility_reasons: string[];
  freight_rate_used: number;
  cost: CostBreakdown;
  risk: RiskAssessmentOut;
  is_best: boolean;
}

export interface DecisionPipelineResponse {
  run_id: number | null;
  shipment: ShipmentScenarioRequest;
  forecast: ForecastOut;
  feasibility: FeasibilityResponse;
  risk: RiskAssessmentOut;
  cost: CostBreakdown;
  recommendation: RecommendationOut;
  what_if: WhatIfScenario[];
  best_scenario_id: string;
  generated_at: string;
  data_status: string;
}

export interface DecisionRunSummary {
  id: number;
  created_at: string;
  origin_code: string;
  destination_code: string;
  cargo_type: string;
  quantity_tonnes: number;
  recommended_action: string;
  overall_risk: string;
  total_expected_cost_usd: number;
  model_version: string;
}

export interface StatusItem {
  name: string;
  state: "available" | "prototype" | "not_connected" | "error";
  detail: string;
}

export interface SystemStatus {
  items: StatusItem[];
  ml_model_version: string;
  ml_model_ready: boolean;
  database_url_kind: string;
  generated_at: string;
}

export interface SearchResultItem {
  type: "port" | "origin" | "route" | "vessel_class";
  code: string;
  label: string;
  subtitle: string;
  action: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
}

export interface ApiErrorPayload {
  message?: string;
  detail?: unknown;
  data_status?: string;
  reason?: string;
}
