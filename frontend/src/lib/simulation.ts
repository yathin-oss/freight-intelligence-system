// Deterministic, seeded simulation logic standing in for the real
// PREDICT -> FEASIBILITY -> RISK -> OPTIMIZE -> RECOMMEND pipeline. Every
// number here is synthetic (see data_status: "SYNTHETIC" throughout) - this
// is UI plumbing, not a forecasting model. Swapping in a real ML service
// later means replacing the internals of `buildForecast` only; every other
// function here operates on real port/vessel constraints already present in
// the Supabase reference tables.

import type {
  CostBreakdown,
  ExplanationItem,
  FeasibilityCheck,
  FeasibilityResponse,
  ForecastOut,
  ForecastPoint,
  Port,
  RecommendationAction,
  RecommendationOut,
  Route,
  RiskAssessmentOut,
  VesselClass,
  VesselFeasibilityOut,
  WhatIfScenario,
} from "@/types/api";

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandom(key: string): () => number {
  return mulberry32(hashSeed(key));
}

export function routeId(originCode: string, destinationCode: string, cargoType: string): string {
  return `${originCode}-${destinationCode}-${cargoType}`.toUpperCase().replace(/\s+/g, "");
}

function addWeeks(iso: string, weeks: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// PREDICT
// ---------------------------------------------------------------------------

export function buildForecast(
  originCode: string,
  cargoType: string,
  history: { date: string; rate_usd_per_tonne: number }[],
  horizonWeeks: number
): ForecastOut {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  const current_rate = last?.rate_usd_per_tonne ?? 10;
  const current_rate_date = last?.date ?? new Date().toISOString().slice(0, 10);

  // recent 8-point trend + volatility, both estimated from real history
  const recent = sorted.slice(-8);
  const changes = recent.slice(1).map((p, i) => p.rate_usd_per_tonne - recent[i].rate_usd_per_tonne);
  const avgChange = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
  const stdev = changes.length
    ? Math.sqrt(changes.reduce((a, b) => a + (b - avgChange) ** 2, 0) / changes.length)
    : current_rate * 0.03;
  const volatilityRatio = stdev / Math.max(current_rate, 1);
  const volatility: ForecastOut["volatility"] = volatilityRatio > 0.06 ? "high" : volatilityRatio > 0.03 ? "medium" : "low";

  const rng = seededRandom(`${originCode}-${cargoType}-forecast-${horizonWeeks}`);
  const weeklyDrift = avgChange * 0.6; // partial continuation of recent momentum, damped
  const points: ForecastPoint[] = [];
  let rate = current_rate;
  for (let w = 1; w <= horizonWeeks; w++) {
    rate = Math.max(2, rate + weeklyDrift + (rng() - 0.5) * stdev * 1.4);
    const spread = stdev * Math.sqrt(w) * 1.2 + current_rate * 0.01;
    points.push({
      week_offset: w,
      date: addWeeks(current_rate_date, w),
      predicted_rate: Math.round(rate * 100) / 100,
      lower: Math.round(Math.max(0, rate - spread) * 100) / 100,
      upper: Math.round((rate + spread) * 100) / 100,
    });
  }

  const lastPredicted = points[points.length - 1]?.predicted_rate ?? current_rate;
  const trend_pct = ((lastPredicted - current_rate) / current_rate) * 100;
  const trend: ForecastOut["trend"] = trend_pct > 1.5 ? "increasing" : trend_pct < -1.5 ? "decreasing" : "stable";
  const confidence = Math.max(0.4, Math.min(0.92, 0.88 - horizonWeeks * 0.012 - volatilityRatio * 2));

  return {
    origin_code: originCode,
    cargo_type: cargoType,
    current_rate,
    current_rate_date,
    forecast: points,
    trend,
    trend_pct: Math.round(trend_pct * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    volatility,
    model_version: "sim-v1",
    data_status: "SYNTHETIC",
    method_note: "Simulated forecast: seeded random-walk continuation of the historic rate series. No live ML model connected yet.",
  };
}

// ---------------------------------------------------------------------------
// FEASIBILITY
// ---------------------------------------------------------------------------

export function computeFeasibility(port: Port, quantityTonnes: number, vesselClasses: VesselClass[]): FeasibilityResponse {
  const results: VesselFeasibilityOut[] = vesselClasses.map((v) => {
    const checks: FeasibilityCheck[] = [
      { label: "Port-Compatible Class", passed: port.compatible_classes.includes(v.code), detail: `${port.name} accepts: ${port.compatible_classes.join(", ") || "none on file"}.` },
      { label: "Draft", passed: port.draft_limit_m == null || v.draft_m <= port.draft_limit_m, detail: `Vessel draft ${v.draft_m} m vs. port limit ${port.draft_limit_m ?? "unknown"} m.` },
      { label: "LOA", passed: port.loa_limit_m == null || v.loa_m <= port.loa_limit_m, detail: `Vessel LOA ${v.loa_m} m vs. port limit ${port.loa_limit_m ?? "unknown"} m.` },
      { label: "Beam", passed: port.beam_limit_m == null || v.beam_m <= port.beam_limit_m, detail: `Vessel beam ${v.beam_m} m vs. port limit ${port.beam_limit_m ?? "unknown"} m.` },
      { label: "Capacity", passed: v.cargo_capacity_tonnes * 3 >= quantityTonnes, detail: `${v.cargo_capacity_tonnes.toLocaleString()} t capacity vs. ${quantityTonnes.toLocaleString()} t shipment (max 3 voyages assumed).` },
    ];
    const feasible = checks.every((c) => c.passed);
    return {
      vessel_code: v.code,
      vessel_class: v.name,
      feasible,
      checks,
      rejection_reasons: checks.filter((c) => !c.passed).map((c) => `${c.label} check failed - ${c.detail}`),
      estimated_freight_cost_usd: null,
      estimated_daily_hire_usd: v.typical_daily_hire_usd,
    };
  });

  const feasibleSorted = results.filter((r) => r.feasible).sort((a, b) => {
    const va = vesselClasses.find((v) => v.code === a.vessel_code)!;
    const vb = vesselClasses.find((v) => v.code === b.vessel_code)!;
    return vb.cargo_capacity_tonnes - va.cargo_capacity_tonnes;
  });

  return {
    destination_code: port.code,
    quantity_tonnes: quantityTonnes,
    results,
    recommended_vessel_code: feasibleSorted[0]?.vessel_code ?? null,
    data_status: "SYNTHETIC",
  };
}

// ---------------------------------------------------------------------------
// RISK
// ---------------------------------------------------------------------------

const LEVEL_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;

export function computeRisk(port: Port, route: Route | undefined): RiskAssessmentOut {
  const factors = [
    { label: "Port Congestion", level: port.congestion, detail: `${port.name} congestion is currently rated ${port.congestion}.` },
    { label: "Port Operational Risk", level: port.risk, detail: port.notes || `${port.name} has no notable operational constraints on file.` },
    {
      label: "Route Risk",
      level: (route?.risk ?? "MEDIUM") as "LOW" | "MEDIUM" | "HIGH",
      detail: route ? `${route.origin_name} -> ${route.destination_name} lane risk rated ${route.risk}.` : "Route risk unavailable for this origin/destination/cargo combination.",
    },
  ];
  const overall = factors.reduce<"LOW" | "MEDIUM" | "HIGH">(
    (acc, f) => (LEVEL_ORDER[f.level] > LEVEL_ORDER[acc] ? f.level : acc),
    "LOW"
  );
  return { overall, factors, data_status: "SYNTHETIC" };
}

// ---------------------------------------------------------------------------
// COST
// ---------------------------------------------------------------------------

const RISK_COST_WEIGHT = { LOW: 0.01, MEDIUM: 0.04, HIGH: 0.09 } as const;
const RISK_IDLE_DAYS = { LOW: 1, MEDIUM: 3, HIGH: 6 } as const;

export function computeCost(rateUsdPerTonne: number, quantityTonnes: number, vessel: VesselClass, risk: RiskAssessmentOut, distanceNm: number): CostBreakdown {
  const freight_cost_usd = rateUsdPerTonne * quantityTonnes;
  const transitDays = distanceNm / (12 * 24); // ~12 knots assumed transit speed
  const expected_idle_cost_usd = vessel.typical_daily_hire_usd * RISK_IDLE_DAYS[risk.overall];
  const expected_demurrage_usd = vessel.typical_daily_hire_usd * (risk.overall === "HIGH" ? 2.5 : risk.overall === "MEDIUM" ? 1.2 : 0.4);
  const deadheading_cost_usd = vessel.typical_daily_hire_usd * transitDays * 0.15;
  const risk_penalty_usd = freight_cost_usd * RISK_COST_WEIGHT[risk.overall];
  const total_expected_cost_usd = freight_cost_usd + expected_idle_cost_usd + expected_demurrage_usd + deadheading_cost_usd + risk_penalty_usd;

  return {
    freight_cost_usd: Math.round(freight_cost_usd),
    expected_idle_cost_usd: Math.round(expected_idle_cost_usd),
    expected_demurrage_usd: Math.round(expected_demurrage_usd),
    deadheading_cost_usd: Math.round(deadheading_cost_usd),
    risk_penalty_usd: Math.round(risk_penalty_usd),
    total_expected_cost_usd: Math.round(total_expected_cost_usd),
    assumptions: [
      "Freight cost = simulated rate x quantity; not a quoted charter rate.",
      `Transit time assumes a flat 12-knot service speed over ${Math.round(distanceNm).toLocaleString()} nm.`,
      `Idle and demurrage days are heuristics keyed to overall risk (${risk.overall}), not observed port data.`,
    ],
    data_status: "SYNTHETIC",
  };
}

// ---------------------------------------------------------------------------
// RECOMMEND
// ---------------------------------------------------------------------------

export function computeRecommendation(forecast: ForecastOut, risk: RiskAssessmentOut, cost: CostBreakdown): RecommendationOut {
  let action: RecommendationAction;
  let headline: string;
  let wait_weeks_min: number | null = null;
  let wait_weeks_max: number | null = null;

  if (risk.overall === "HIGH") {
    action = "MONITOR";
    headline = "Monitor Closely — Elevated Risk on This Lane";
  } else if (forecast.trend === "increasing" && forecast.trend_pct > 5) {
    action = "BOOK_NOW";
    headline = "Book Now — Rates Trending Upward";
    wait_weeks_min = 0;
    wait_weeks_max = 0;
  } else if (forecast.trend === "decreasing" && forecast.trend_pct < -5) {
    action = "WAIT";
    const bottomIdx = forecast.forecast.reduce((best, p, i) => (p.predicted_rate < forecast.forecast[best].predicted_rate ? i : best), 0);
    wait_weeks_min = Math.max(1, forecast.forecast[bottomIdx].week_offset - 1);
    wait_weeks_max = forecast.forecast[bottomIdx].week_offset + 1;
    headline = `Wait — Rates Expected to Ease by Week ${forecast.forecast[bottomIdx].week_offset}`;
  } else {
    action = "BOOK_WITHIN_RANGE";
    headline = "Book Within the Next Few Weeks";
    wait_weeks_min = 0;
    wait_weeks_max = 3;
  }

  const explanation: ExplanationItem[] = [
    { order: 1, statement: `Forecast: ${forecast.trend} rate trend, ${forecast.trend_pct > 0 ? "+" : ""}${forecast.trend_pct}% over the ${forecast.forecast.length}-week horizon (confidence ${Math.round(forecast.confidence * 100)}%).` },
    { order: 2, statement: `Risk: overall lane risk rated ${risk.overall}, driven by ${risk.factors.map((f) => f.label).join(", ")}.` },
    { order: 3, statement: `Cost: total expected logistics cost of $${cost.total_expected_cost_usd.toLocaleString()}, including a $${cost.risk_penalty_usd.toLocaleString()} risk penalty.` },
    { order: 4, statement: `Recommendation: ${headline.toLowerCase()}, based on the forecast/risk combination above.` },
  ];

  return { action, headline, wait_weeks_min, wait_weeks_max, explanation, data_status: "SYNTHETIC" };
}

// ---------------------------------------------------------------------------
// OPTIMIZE (what-if scenarios)
// ---------------------------------------------------------------------------

export function computeWhatIf(
  forecast: ForecastOut,
  route: Route | undefined,
  destinationPort: Port,
  alternatePorts: Port[],
  vesselClasses: VesselClass[],
  feasibility: FeasibilityResponse,
  baseRisk: RiskAssessmentOut,
  quantityTonnes: number
): { scenarios: WhatIfScenario[]; bestId: string } {
  const recommendedVessel = vesselClasses.find((v) => v.code === feasibility.recommended_vessel_code) ?? vesselClasses[0];
  const distanceNm = route?.distance_nm ?? 8000;

  function scenario(id: string, label: string, description: string, vessel: VesselClass, port: Port, waitWeeks: number, rate: number, risk: RiskAssessmentOut, feasible: boolean, reasons: string[]): WhatIfScenario {
    const cost = computeCost(rate, quantityTonnes, vessel, risk, distanceNm);
    return {
      scenario_id: id,
      label,
      description,
      vessel_code: vessel.code,
      vessel_class: vessel.name,
      destination_code: port.code,
      destination_name: port.name,
      wait_weeks: waitWeeks,
      feasible,
      feasibility_reasons: reasons,
      freight_rate_used: rate,
      cost,
      risk,
      is_best: false,
    };
  }

  const scenarios: WhatIfScenario[] = [];

  scenarios.push(
    scenario(
      "book-now",
      "Book Now",
      "Charter immediately at the current reference rate on the recommended vessel class.",
      recommendedVessel,
      destinationPort,
      0,
      forecast.current_rate,
      baseRisk,
      Boolean(feasibility.recommended_vessel_code),
      feasibility.recommended_vessel_code ? [] : ["No feasible vessel class for this port/quantity."]
    )
  );

  const waitPoint = forecast.forecast[Math.min(3, forecast.forecast.length - 1)];
  scenarios.push(
    scenario(
      "wait-4wk",
      `Wait ${waitPoint?.week_offset ?? 4} Weeks`,
      "Delay booking to the forecasted rate a few weeks out.",
      recommendedVessel,
      destinationPort,
      waitPoint?.week_offset ?? 4,
      waitPoint?.predicted_rate ?? forecast.current_rate,
      baseRisk,
      Boolean(feasibility.recommended_vessel_code),
      feasibility.recommended_vessel_code ? [] : ["No feasible vessel class for this port/quantity."]
    )
  );

  const altVessel = vesselClasses.find((v) => v.code !== recommendedVessel.code && feasibility.results.find((r) => r.vessel_code === v.code)?.feasible);
  if (altVessel) {
    scenarios.push(
      scenario(
        "alt-vessel",
        `Alternative Vessel: ${altVessel.name}`,
        "Use a different feasible vessel class on the same lane and destination.",
        altVessel,
        destinationPort,
        0,
        forecast.current_rate,
        baseRisk,
        true,
        []
      )
    );
  }

  const altPort = alternatePorts.find((p) => p.code !== destinationPort.code && p.compatible_classes.includes(recommendedVessel.code));
  if (altPort) {
    const altRisk = computeRisk(altPort, route);
    scenarios.push(
      scenario(
        "alt-port",
        `Alternative Port: ${altPort.name}`,
        "Route the same shipment to a different East Coast port.",
        recommendedVessel,
        altPort,
        0,
        forecast.current_rate,
        altRisk,
        true,
        []
      )
    );
  }

  const feasibleOnes = scenarios.filter((s) => s.feasible);
  const best = feasibleOnes.sort((a, b) => a.cost.total_expected_cost_usd - b.cost.total_expected_cost_usd)[0];
  if (best) best.is_best = true;

  return { scenarios, bestId: best?.scenario_id ?? scenarios[0].scenario_id };
}
