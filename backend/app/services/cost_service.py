"""
Total expected logistics cost = freight + expected idle cost + expected
demurrage + deadheading/repositioning + risk penalty.

Every component's formula is documented inline and every result carries
`assumptions` strings so the number is never presented as more precise than
it is. This is a PROTOTYPE cost model - see README "Cost Intelligence" for
the production replacement path (real port tariff schedules, real charter
party demurrage clauses, real bunker prices at time of fixture).
"""
from __future__ import annotations

from app.core.config import settings
from app.models.reference import Port, Route, VesselClass
from app.schemas.decision import CostBreakdown, RiskAssessmentOut

CONGESTION_EXPECTED_WAIT_DAYS = {"LOW": 1.0, "MEDIUM": 3.0, "HIGH": 7.0}
RISK_PENALTY_USD_PER_TONNE = {"LOW": 0.0, "MEDIUM": 0.15, "HIGH": 0.40}
DEMURRAGE_MULTIPLIER = 1.5  # demurrage rate = 1.5x daily hire, a common charter-party convention
DEADHEAD_COST_PER_NM_PER_1000T = 0.9  # USD, illustrative repositioning cost proxy


def estimate_cost(
    *,
    freight_rate_usd_per_tonne: float,
    quantity_tonnes: float,
    vessel: VesselClass,
    port: Port,
    risk: RiskAssessmentOut,
    distance_nm: float,
    baseline_distance_nm: float | None = None,
) -> CostBreakdown:
    freight_cost = freight_rate_usd_per_tonne * quantity_tonnes

    expected_wait_days = CONGESTION_EXPECTED_WAIT_DAYS.get(port.congestion.upper(), 3.0)
    expected_idle_cost = expected_wait_days * vessel.typical_daily_hire_usd

    laytime = settings.LAYTIME_DAYS
    demurrage_days = max(0.0, expected_wait_days - laytime)
    expected_demurrage = demurrage_days * vessel.typical_daily_hire_usd * DEMURRAGE_MULTIPLIER

    deadheading_cost = 0.0
    if baseline_distance_nm is not None:
        extra_nm = max(0.0, distance_nm - baseline_distance_nm)
        deadheading_cost = extra_nm * DEADHEAD_COST_PER_1000T_RATE(quantity_tonnes)

    risk_penalty = RISK_PENALTY_USD_PER_TONNE.get(risk.overall.upper(), 0.15) * quantity_tonnes

    total = freight_cost + expected_idle_cost + expected_demurrage + deadheading_cost + risk_penalty

    assumptions = [
        f"Freight cost = forecast rate (${freight_rate_usd_per_tonne:.2f}/t) x {quantity_tonnes:,.0f} t.",
        f"Expected idle cost assumes {expected_wait_days:.1f} waiting days at {port.name} "
        f"(congestion={port.congestion}) x ${vessel.typical_daily_hire_usd:,.0f}/day charter hire (ESTIMATED).",
        f"Demurrage assumes {laytime} free laytime days per charter-party convention; "
        f"{demurrage_days:.1f} demurrage day(s) at {DEMURRAGE_MULTIPLIER}x daily hire (SIMULATED methodology).",
        "Deadheading/repositioning cost is only non-zero when comparing an alternative destination "
        "port against the primary port's distance (SIMULATED proxy, $/nm/1000t).",
        f"Risk penalty is a monetised proxy for overall risk ({risk.overall}): "
        f"${RISK_PENALTY_USD_PER_TONNE.get(risk.overall.upper(), 0.15):.2f}/t (ESTIMATED, not an insurance premium).",
    ]

    return CostBreakdown(
        freight_cost_usd=round(freight_cost, 2),
        expected_idle_cost_usd=round(expected_idle_cost, 2),
        expected_demurrage_usd=round(expected_demurrage, 2),
        deadheading_cost_usd=round(deadheading_cost, 2),
        risk_penalty_usd=round(risk_penalty, 2),
        total_expected_cost_usd=round(total, 2),
        assumptions=assumptions,
        data_status="prototype",
    )


def DEADHEAD_COST_PER_1000T_RATE(quantity_tonnes: float) -> float:
    return DEADHEAD_COST_PER_NM_PER_1000T * (quantity_tonnes / 1000.0)
