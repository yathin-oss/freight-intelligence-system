from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Forecast
# ---------------------------------------------------------------------------
class ForecastRequest(BaseModel):
    origin_code: str
    cargo_type: str
    horizon_weeks: int = Field(default=12, ge=1, le=26)


class ForecastPointOut(BaseModel):
    week_offset: int
    date: str
    predicted_rate: float
    lower: float
    upper: float


class ForecastOut(BaseModel):
    origin_code: str
    cargo_type: str
    current_rate: float
    current_rate_date: str
    forecast: list[ForecastPointOut]
    trend: str
    trend_pct: float
    confidence: float
    volatility: str
    model_version: str
    data_status: str
    method_note: str


# ---------------------------------------------------------------------------
# Feasibility
# ---------------------------------------------------------------------------
class FeasibilityCheck(BaseModel):
    label: str
    passed: bool
    detail: str


class VesselFeasibilityOut(BaseModel):
    vessel_code: str
    vessel_class: str
    feasible: bool
    checks: list[FeasibilityCheck]
    rejection_reasons: list[str]
    estimated_freight_cost_usd: float | None = None
    estimated_daily_hire_usd: float


class FeasibilityRequest(BaseModel):
    destination_code: str
    cargo_type: str
    quantity_tonnes: float = Field(gt=0)


class FeasibilityResponse(BaseModel):
    destination_code: str
    quantity_tonnes: float
    results: list[VesselFeasibilityOut]
    recommended_vessel_code: str | None
    data_status: str


# ---------------------------------------------------------------------------
# Risk
# ---------------------------------------------------------------------------
class RiskFactor(BaseModel):
    label: str
    level: str  # LOW / MEDIUM / HIGH / UNAVAILABLE
    detail: str


class RiskAssessmentOut(BaseModel):
    overall: str
    factors: list[RiskFactor]
    data_status: str


# ---------------------------------------------------------------------------
# Cost
# ---------------------------------------------------------------------------
class CostBreakdown(BaseModel):
    freight_cost_usd: float
    expected_idle_cost_usd: float
    expected_demurrage_usd: float
    deadheading_cost_usd: float
    risk_penalty_usd: float
    total_expected_cost_usd: float
    assumptions: list[str]
    data_status: str


# ---------------------------------------------------------------------------
# Shipment / decision pipeline
# ---------------------------------------------------------------------------
class ShipmentScenarioRequest(BaseModel):
    origin_code: str
    destination_code: str
    cargo_type: str
    quantity_tonnes: float = Field(gt=0)
    shipment_date: str
    contract_duration_months: int = Field(default=3, ge=1, le=24)
    forecast_horizon_weeks: int = Field(default=12, ge=4, le=26)
    vessel_code: str | None = None  # optional explicit vessel override


class ExplanationItem(BaseModel):
    order: int
    statement: str


class RecommendationOut(BaseModel):
    action: str  # BOOK_NOW | WAIT | BOOK_WITHIN_RANGE | MONITOR
    headline: str
    wait_weeks_min: int | None = None
    wait_weeks_max: int | None = None
    explanation: list[ExplanationItem]
    data_status: str


class WhatIfScenario(BaseModel):
    scenario_id: str
    label: str
    description: str
    vessel_code: str
    vessel_class: str
    destination_code: str
    destination_name: str
    wait_weeks: int
    feasible: bool
    feasibility_reasons: list[str]
    freight_rate_used: float
    cost: CostBreakdown
    risk: RiskAssessmentOut
    is_best: bool = False


class DecisionPipelineResponse(BaseModel):
    run_id: int | None
    shipment: ShipmentScenarioRequest
    forecast: ForecastOut
    feasibility: FeasibilityResponse
    risk: RiskAssessmentOut
    cost: CostBreakdown
    recommendation: RecommendationOut
    what_if: list[WhatIfScenario]
    best_scenario_id: str
    generated_at: str
    data_status: str


class DecisionRunSummary(BaseModel):
    id: int
    created_at: str
    origin_code: str
    destination_code: str
    cargo_type: str
    quantity_tonnes: float
    recommended_action: str
    overall_risk: str
    total_expected_cost_usd: float
    model_version: str
