"""
What-If Scenario Simulator / optimizer.

Formulates (informally) the classic charter-timing trade-off:

    MINIMIZE   FreightCost + ExpectedIdleCost + ExpectedDemurrage
               + Deadheading + RiskPenalty
    subject to  vessel-port feasibility (deterministic constraints from
                feasibility_service), cargo capacity, and the shipment's
                forecast horizon.

For a prototype with 4 well-understood discrete decision axes (timing,
vessel, port) an explicit enumerate-and-compare over meaningful candidate
scenarios is more transparent and easier to explain to a judge than a
generic MILP solver, so that is what this module does. (OR-Tools /
scipy.optimize would earn their keep once the action space grows -
continuous timing, multi-leg routing, multi-vessel portfolios - see
README "Production Roadmap".)
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.reference import Port, Route, VesselClass
from app.schemas.decision import CostBreakdown, ForecastOut, RiskAssessmentOut, VesselFeasibilityOut, WhatIfScenario
from app.services import cost_service, feasibility_service, risk_service


def _best_forecast_week(forecast: ForecastOut) -> tuple[int, float]:
    """Returns (week_offset, predicted_rate) of the lowest-cost point in the forecast horizon."""
    if not forecast.forecast:
        return 0, forecast.current_rate
    best = min(forecast.forecast, key=lambda p: p.predicted_rate)
    return best.week_offset, best.predicted_rate


def build_scenarios(
    db: Session,
    *,
    forecast: ForecastOut,
    origin_code: str,
    destination_code: str,
    cargo_type: str,
    quantity_tonnes: float,
) -> list[WhatIfScenario]:
    primary_port = db.query(Port).filter(Port.code == destination_code).one()
    vessels = db.query(VesselClass).order_by(VesselClass.cargo_capacity_tonnes).all()

    primary_feasibility = feasibility_service.evaluate_all(vessels, primary_port, quantity_tonnes)
    primary_risk = risk_service.assess(forecast, primary_port, primary_feasibility)
    primary_vessel_code = feasibility_service.recommended_vessel_code(primary_feasibility)

    primary_route = (
        db.query(Route)
        .filter(Route.origin_code == origin_code, Route.destination_code == destination_code,
                Route.cargo_type == cargo_type)
        .first()
    )
    primary_distance = primary_route.distance_nm if primary_route else 0.0

    scenarios: list[WhatIfScenario] = []

    # ---- Scenario A: BOOK NOW -------------------------------------------------
    if primary_vessel_code:
        vessel = next(v for v in vessels if v.code == primary_vessel_code)
        cost = cost_service.estimate_cost(
            freight_rate_usd_per_tonne=forecast.current_rate, quantity_tonnes=quantity_tonnes,
            vessel=vessel, port=primary_port, risk=primary_risk, distance_nm=primary_distance,
        )
        scenarios.append(WhatIfScenario(
            scenario_id="BOOK_NOW", label="Book Now",
            description="Charter immediately at today's reference freight rate.",
            vessel_code=vessel.code, vessel_class=vessel.name,
            destination_code=primary_port.code, destination_name=primary_port.name,
            wait_weeks=0, feasible=True, feasibility_reasons=[],
            freight_rate_used=forecast.current_rate, cost=cost, risk=primary_risk,
        ))
    else:
        scenarios.append(_infeasible_scenario(
            "BOOK_NOW", "Book Now", primary_port, forecast.current_rate,
            "No evaluated vessel class is feasible at this port for this cargo quantity.",
        ))

    # ---- Scenario B: WAIT (to the lowest-forecast week within horizon) --------
    best_week, best_rate = _best_forecast_week(forecast)
    if primary_vessel_code and best_week > 0:
        vessel = next(v for v in vessels if v.code == primary_vessel_code)
        cost = cost_service.estimate_cost(
            freight_rate_usd_per_tonne=best_rate, quantity_tonnes=quantity_tonnes,
            vessel=vessel, port=primary_port, risk=primary_risk, distance_nm=primary_distance,
        )
        scenarios.append(WhatIfScenario(
            scenario_id="WAIT_BEST", label=f"Wait {best_week} Week(s)",
            description=f"Delay chartering {best_week} week(s) to the model's lowest forecast point "
                        f"in the {len(forecast.forecast)}-week horizon.",
            vessel_code=vessel.code, vessel_class=vessel.name,
            destination_code=primary_port.code, destination_name=primary_port.name,
            wait_weeks=best_week, feasible=True, feasibility_reasons=[],
            freight_rate_used=best_rate, cost=cost, risk=primary_risk,
        ))

    # ---- Scenario C: ALTERNATIVE VESSEL ---------------------------------------
    feasible_vessels = [r for r in primary_feasibility if r.feasible]
    alt_candidates = [r for r in feasible_vessels if r.vessel_code != primary_vessel_code]
    if alt_candidates:
        alt_result = min(alt_candidates, key=lambda r: r.estimated_daily_hire_usd)
        vessel = next(v for v in vessels if v.code == alt_result.vessel_code)
        cost = cost_service.estimate_cost(
            freight_rate_usd_per_tonne=forecast.current_rate, quantity_tonnes=quantity_tonnes,
            vessel=vessel, port=primary_port, risk=primary_risk, distance_nm=primary_distance,
        )
        scenarios.append(WhatIfScenario(
            scenario_id="ALT_VESSEL", label=f"Alternative Vessel: {vessel.name}",
            description=f"Charter a {vessel.name} instead of the primary recommendation, same port and timing.",
            vessel_code=vessel.code, vessel_class=vessel.name,
            destination_code=primary_port.code, destination_name=primary_port.name,
            wait_weeks=0, feasible=True, feasibility_reasons=[],
            freight_rate_used=forecast.current_rate, cost=cost, risk=primary_risk,
        ))
    else:
        scenarios.append(_infeasible_scenario(
            "ALT_VESSEL", "Alternative Vessel", primary_port, forecast.current_rate,
            "No second feasible vessel class exists for this shipment at this port.",
        ))

    # ---- Scenario D: ALTERNATIVE PORT -----------------------------------------
    alt_routes = (
        db.query(Route)
        .filter(Route.origin_code == origin_code, Route.cargo_type == cargo_type,
                Route.destination_code != destination_code)
        .order_by(Route.congestion, Route.distance_nm)
        .all()
    )
    if alt_routes and primary_vessel_code:
        # prefer a lower-congestion alternative; LOW < MEDIUM < HIGH alphabetically doesn't sort right,
        # so rank explicitly.
        congestion_rank = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
        alt_routes_sorted = sorted(alt_routes, key=lambda r: (congestion_rank.get(r.congestion, 1), r.distance_nm))
        alt_route = alt_routes_sorted[0]
        alt_port = db.query(Port).filter(Port.code == alt_route.destination_code).one()
        alt_feasibility = feasibility_service.evaluate_all(vessels, alt_port, quantity_tonnes)
        alt_vessel_code = feasibility_service.recommended_vessel_code(alt_feasibility) or primary_vessel_code
        vessel = next(v for v in vessels if v.code == alt_vessel_code)
        alt_result = next((r for r in alt_feasibility if r.vessel_code == alt_vessel_code), None)
        alt_risk = risk_service.assess(forecast, alt_port, alt_feasibility)
        feasible = alt_result.feasible if alt_result else False
        cost = cost_service.estimate_cost(
            freight_rate_usd_per_tonne=alt_route.reference_freight_usd_per_tonne, quantity_tonnes=quantity_tonnes,
            vessel=vessel, port=alt_port, risk=alt_risk, distance_nm=alt_route.distance_nm,
            baseline_distance_nm=primary_distance,
        )
        scenarios.append(WhatIfScenario(
            scenario_id="ALT_PORT", label=f"Alternative Port: {alt_port.name}",
            description=f"Route the same cargo to {alt_port.name} instead of {primary_port.name} "
                        f"(congestion {alt_port.congestion.lower()} vs {primary_port.congestion.lower()}).",
            vessel_code=vessel.code, vessel_class=vessel.name,
            destination_code=alt_port.code, destination_name=alt_port.name,
            wait_weeks=0, feasible=feasible,
            feasibility_reasons=[] if feasible else (alt_result.rejection_reasons if alt_result else ["Not evaluated"]),
            freight_rate_used=alt_route.reference_freight_usd_per_tonne, cost=cost, risk=alt_risk,
        ))

    # ---- pick BEST EXPECTED OPTION among FEASIBLE scenarios --------------------
    feasible_scenarios = [s for s in scenarios if s.feasible]
    if feasible_scenarios:
        best = min(feasible_scenarios, key=lambda s: s.cost.total_expected_cost_usd)
        for s in scenarios:
            s.is_best = s.scenario_id == best.scenario_id

    return scenarios


def _infeasible_scenario(scenario_id: str, label: str, port: Port, rate: float, reason: str) -> WhatIfScenario:
    # NOTE: use a large finite sentinel (not float('inf')) so the response stays
    # valid JSON for the frontend's JSON.parse - infeasible scenarios are also
    # marked feasible=False, which the UI uses to grey the card out rather than
    # relying on the cost value.
    zero_cost = CostBreakdown(
        freight_cost_usd=0, expected_idle_cost_usd=0, expected_demurrage_usd=0,
        deadheading_cost_usd=0, risk_penalty_usd=0, total_expected_cost_usd=999_999_999.0,
        assumptions=["Scenario is infeasible - cost not meaningful."], data_status="prototype",
    )
    # No feasibility/risk evaluation applies to a scenario that never gets off the
    # ground - HIGH is a conservative placeholder that only ever reaches the UI
    # alongside feasible=False, which is what the frontend actually branches on.
    not_applicable_risk = RiskAssessmentOut(overall="HIGH", factors=[], data_status="prototype")
    return WhatIfScenario(
        scenario_id=scenario_id, label=label, description=reason,
        vessel_code="", vessel_class="", destination_code=port.code, destination_name=port.name,
        wait_weeks=0, feasible=False, feasibility_reasons=[reason],
        freight_rate_used=rate, cost=zero_cost, risk=not_applicable_risk,
    )
