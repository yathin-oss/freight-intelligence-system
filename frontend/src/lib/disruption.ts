// Pure functions that layer an active disruption's effect on top of an
// already-computed forecast/decision result. Kept separate from the
// Supabase-backed disruptionStore so the math is trivially unit-testable and
// has no dependency on where the disruption list came from.

import type { CostBreakdown, DecisionPipelineResponse, ForecastOut, RiskAssessmentOut } from "@/types/api";
import type { DisruptionEvent } from "@/types/disruption";

export function getDisruptionForRoute(routeId: string | undefined, events: DisruptionEvent[]): DisruptionEvent | undefined {
  if (!routeId) return undefined;
  return events.find((e) => e.route_id === routeId);
}

export function applyDisruptionToForecast(forecast: ForecastOut, disruption: DisruptionEvent): ForecastOut {
  const impact = disruption.bdi_impact_pct / 100;
  const rampWeeks = Math.max(2, Math.round(disruption.delay_days / 7) + 1);

  const adjusted = forecast.forecast.map((p, i) => {
    const ramp = Math.min(1, (i + 1) / rampWeeks);
    const bump = 1 + impact * ramp;
    const widen = 1 + 0.5 * ramp;
    const mid = p.predicted_rate * bump;
    const halfSpread = ((p.upper - p.lower) / 2) * widen;
    return { ...p, predicted_rate: mid, lower: Math.max(0, mid - halfSpread), upper: mid + halfSpread };
  });

  const lastAdjusted = adjusted[adjusted.length - 1]?.predicted_rate ?? forecast.current_rate;
  const trend_pct = ((lastAdjusted - forecast.current_rate) / forecast.current_rate) * 100;
  const confidencePenalty = disruption.severity === "HIGH" ? 0.25 : 0.15;

  return {
    ...forecast,
    forecast: adjusted,
    trend: trend_pct > 1 ? "increasing" : trend_pct < -1 ? "decreasing" : "stable",
    trend_pct,
    volatility: disruption.severity === "HIGH" ? "high" : "medium",
    confidence: Math.max(0.35, forecast.confidence - confidencePenalty),
    method_note: `${forecast.method_note} | Adjusted for active disruption: ${disruption.label} (simulated, +${disruption.bdi_impact_pct}% BDI impact).`,
  };
}

function bumpRisk(risk: RiskAssessmentOut, disruption: DisruptionEvent): RiskAssessmentOut {
  const order = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
  const overall = order[disruption.severity] > order[risk.overall] ? disruption.severity : risk.overall;
  return {
    ...risk,
    overall,
    factors: [
      ...risk.factors,
      {
        label: `Active Disruption: ${disruption.label}`,
        level: disruption.severity,
        detail: disruption.description,
      },
    ],
  };
}

function bumpCost(cost: CostBreakdown, disruption: DisruptionEvent, forecastRateShiftPct: number): CostBreakdown {
  const freight_cost_usd = cost.freight_cost_usd * (1 + forecastRateShiftPct / 100);
  const riskBump = disruption.severity === "HIGH" ? 0.12 : 0.06;
  const risk_penalty_usd = cost.risk_penalty_usd + cost.total_expected_cost_usd * riskBump;
  const total_expected_cost_usd = cost.expected_idle_cost_usd + cost.expected_demurrage_usd + cost.deadheading_cost_usd + risk_penalty_usd + freight_cost_usd;
  return {
    ...cost,
    freight_cost_usd,
    risk_penalty_usd,
    total_expected_cost_usd,
    assumptions: [...cost.assumptions, `Cost adjusted for active disruption "${disruption.label}" (simulated).`],
  };
}

export function applyDisruptionToDecision(result: DecisionPipelineResponse, disruption: DisruptionEvent): DecisionPipelineResponse {
  const forecast = applyDisruptionToForecast(result.forecast, disruption);
  const risk = bumpRisk(result.risk, disruption);
  const cost = bumpCost(result.cost, disruption, forecast.trend_pct);

  const recommendation =
    disruption.severity === "HIGH"
      ? {
          ...result.recommendation,
          action: "MONITOR" as const,
          headline: `Monitor Closely — ${disruption.label} in effect`,
        }
      : result.recommendation;

  return { ...result, forecast, risk, cost, recommendation };
}
