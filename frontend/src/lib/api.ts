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
  ShipmentScenarioRequest,
  SystemStatus,
  VesselClass,
} from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
  } catch (err) {
    // Network-level failure (backend down, CORS, offline) - never let this crash
    // a React render; callers surface this via the shared unavailable-state UI.
    throw new ApiError(
      "Cannot reach the Freight Intelligence API. Is the backend running?",
      0,
      { reason: String(err) }
    );
  }

  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      /* body wasn't JSON */
    }
    const message =
      (payload as { detail?: { message?: string } | string })?.detail &&
      typeof (payload as { detail?: unknown }).detail === "object"
        ? ((payload as { detail: { message?: string } }).detail.message as string)
        : (payload as { detail?: string })?.detail || res.statusText;
    throw new ApiError(message || `Request failed (${res.status})`, res.status, payload);
  }

  return res.json() as Promise<T>;
}

export const api = {
  listPorts: () => request<Port[]>("/ports"),
  getPort: (code: string) => request<Port>(`/ports/${code}`),
  listOrigins: () => request<Origin[]>("/origins"),
  listVesselClasses: () => request<VesselClass[]>("/vessel-classes"),
  listRoutes: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
    return request<Route[]>(`/routes${qs}`);
  },
  freightRateHistory: (originCode: string, cargoType: string, weeks = 52) =>
    request<FreightRatePoint[]>(
      `/freight-rate-history?${new URLSearchParams({ origin_code: originCode, cargo_type: cargoType, weeks: String(weeks) })}`
    ),
  forecast: (originCode: string, cargoType: string, horizonWeeks: number) =>
    request<ForecastOut>("/forecast", {
      method: "POST",
      body: JSON.stringify({ origin_code: originCode, cargo_type: cargoType, horizon_weeks: horizonWeeks }),
    }),
  feasibility: (destinationCode: string, cargoType: string, quantityTonnes: number) =>
    request<FeasibilityResponse>("/feasibility", {
      method: "POST",
      body: JSON.stringify({ destination_code: destinationCode, cargo_type: cargoType, quantity_tonnes: quantityTonnes }),
    }),
  runDecision: (payload: ShipmentScenarioRequest) =>
    request<DecisionPipelineResponse>("/decision/run", { method: "POST", body: JSON.stringify(payload) }),
  listDecisionRuns: (limit = 25) => request<DecisionRunSummary[]>(`/decision/runs?limit=${limit}`),
  getDecisionRun: (id: number) => request<DecisionPipelineResponse>(`/decision/runs/${id}`),
  search: (q: string) => request<SearchResponse>(`/search?${new URLSearchParams({ q })}`),
  status: () => request<SystemStatus>("/status"),
};
