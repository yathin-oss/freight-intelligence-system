"""
Explainable, deterministic risk engine.

Every factor is computed from an actual input (forecast confidence/
volatility, the destination port's prototype congestion/risk rating, and
the count of feasible vessel candidates) - never a random draw. The overall
score is the average of the four factor scores, rounded, which keeps the
mapping from "why" to "what" auditable (see explanation strings).
"""
from __future__ import annotations

from app.models.reference import Port
from app.schemas.decision import ForecastOut, RiskAssessmentOut, RiskFactor, VesselFeasibilityOut

LEVEL_SCORE = {"LOW": 1, "MEDIUM": 2, "HIGH": 3}
SCORE_LEVEL = {1: "LOW", 2: "MEDIUM", 3: "HIGH"}


def _forecast_uncertainty(forecast: ForecastOut) -> RiskFactor:
    if forecast.confidence >= 0.75:
        level = "LOW"
    elif forecast.confidence >= 0.60:
        level = "MEDIUM"
    else:
        level = "HIGH"
    return RiskFactor(
        label="Forecast uncertainty",
        level=level,
        detail=f"Model confidence {forecast.confidence * 100:.0f}% over a "
                f"{len(forecast.forecast)}-week horizon (volatility: {forecast.volatility}).",
    )


def _freight_volatility(forecast: ForecastOut) -> RiskFactor:
    level = forecast.volatility.upper()
    if level not in LEVEL_SCORE:
        level = "MEDIUM"
    return RiskFactor(
        label="Freight rate volatility",
        level=level,
        detail=f"Recent 12-week rate volatility for this lane classified {level.lower()} "
                f"(prototype thresholds on coefficient of variation).",
    )


def _port_congestion(port: Port) -> RiskFactor:
    level = port.congestion.upper()
    return RiskFactor(
        label="Port congestion",
        level=level,
        detail=f"{port.name} congestion classified {level.lower()} "
                f"(data_status={port.data_status}; production would source this from live VTMS/AIS).",
    )


def _vessel_availability(feasibility_results: list[VesselFeasibilityOut]) -> RiskFactor:
    feasible_count = sum(1 for r in feasibility_results if r.feasible)
    if feasible_count == 0:
        level = "HIGH"
    elif feasible_count == 1:
        level = "MEDIUM"
    else:
        level = "LOW"
    return RiskFactor(
        label="Vessel availability",
        level=level,
        detail=f"{feasible_count} of {len(feasibility_results)} evaluated vessel classes are "
                f"feasible for this shipment (more feasible classes -> more chartering options -> lower risk).",
    )


def assess(forecast: ForecastOut, port: Port, feasibility_results: list[VesselFeasibilityOut]) -> RiskAssessmentOut:
    factors = [
        _freight_volatility(forecast),
        _forecast_uncertainty(forecast),
        _port_congestion(port),
        _vessel_availability(feasibility_results),
    ]
    avg_score = sum(LEVEL_SCORE[f.level] for f in factors) / len(factors)
    overall_score = round(avg_score)
    overall = SCORE_LEVEL[max(1, min(3, overall_score))]

    data_status = "prototype"
    if forecast.data_status == "prototype-fallback":
        data_status = "prototype-fallback"

    return RiskAssessmentOut(overall=overall, factors=factors, data_status=data_status)
