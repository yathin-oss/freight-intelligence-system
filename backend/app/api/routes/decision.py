"""
The main Decision Workspace endpoint: runs the full
PREDICT -> FEASIBILITY -> RISK -> OPTIMIZE -> EXPLAIN -> RECOMMEND pipeline
for one shipment scenario in a single request, and persists the result as a
DecisionRun row (audit trail / scenario history).
"""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.decision import DecisionRun
from app.models.reference import Port, Route, VesselClass
from app.schemas.decision import (
    DecisionPipelineResponse,
    DecisionRunSummary,
    ShipmentScenarioRequest,
)
from app.services import cost_service, feasibility_service, forecast_service, optimization_service, recommendation_service, risk_service

router = APIRouter()


@router.post("/decision/run", response_model=DecisionPipelineResponse)
def run_decision_pipeline(payload: ShipmentScenarioRequest, db: Session = Depends(get_db)):
    origin_code = payload.origin_code.upper()
    destination_code = payload.destination_code.upper()

    port = db.query(Port).filter(Port.code == destination_code).first()
    if not port:
        raise HTTPException(404, f"Destination port '{destination_code}' not found")

    route = (
        db.query(Route)
        .filter(Route.origin_code == origin_code, Route.destination_code == destination_code,
                Route.cargo_type == payload.cargo_type)
        .first()
    )
    if not route:
        raise HTTPException(
            404,
            f"No route on file for {origin_code} -> {destination_code} carrying {payload.cargo_type}. "
            "Try a different origin/destination/cargo combination from the Global Network map.",
        )

    # 1. PREDICT ----------------------------------------------------------
    try:
        forecast = forecast_service.get_forecast(origin_code, payload.cargo_type, payload.forecast_horizon_weeks)
    except forecast_service.ForecastUnavailableError as exc:
        raise HTTPException(422, {"message": "Forecast unavailable for this lane.", "data_status": "unavailable",
                                   "reason": exc.message}) from exc

    # 2. CHECK FEASIBILITY --------------------------------------------------
    vessels = db.query(VesselClass).order_by(VesselClass.cargo_capacity_tonnes).all()
    feasibility_results = feasibility_service.evaluate_all(vessels, port, payload.quantity_tonnes)
    recommended_vessel_code = payload.vessel_code or feasibility_service.recommended_vessel_code(feasibility_results)
    recommended_vessel = next((v for v in vessels if v.code == recommended_vessel_code), None)
    feasible_count = sum(1 for r in feasibility_results if r.feasible)

    from app.schemas.decision import FeasibilityResponse
    feasibility_response = FeasibilityResponse(
        destination_code=port.code, quantity_tonnes=payload.quantity_tonnes,
        results=feasibility_results, recommended_vessel_code=recommended_vessel_code,
        data_status=port.data_status,
    )

    # 3. ASSESS RISK ----------------------------------------------------------
    risk = risk_service.assess(forecast, port, feasibility_results)

    # 4. COMPARE OPTIONS / 5. OPTIMIZE ------------------------------------------
    what_if = optimization_service.build_scenarios(
        db, forecast=forecast, origin_code=origin_code, destination_code=destination_code,
        cargo_type=payload.cargo_type, quantity_tonnes=payload.quantity_tonnes,
    )
    best_scenario = next((s for s in what_if if s.is_best), what_if[0] if what_if else None)

    # cost for the PRIMARY recommended (book-now, recommended vessel) configuration,
    # shown as the headline cost breakdown in the Decision Workspace
    if recommended_vessel:
        cost = cost_service.estimate_cost(
            freight_rate_usd_per_tonne=forecast.current_rate, quantity_tonnes=payload.quantity_tonnes,
            vessel=recommended_vessel, port=port, risk=risk, distance_nm=route.distance_nm,
        )
    else:
        cost = cost_service.estimate_cost(
            freight_rate_usd_per_tonne=forecast.current_rate, quantity_tonnes=payload.quantity_tonnes,
            vessel=vessels[0], port=port, risk=risk, distance_nm=route.distance_nm,
        )

    # 6. EXPLAIN / 7. RECOMMEND ------------------------------------------------
    recommendation = recommendation_service.recommend(
        forecast=forecast, risk=risk, what_if=what_if, port_name=port.name,
        recommended_vessel_class=recommended_vessel.name if recommended_vessel else None,
        feasible_count=feasible_count, total_evaluated=len(feasibility_results),
    )

    response = DecisionPipelineResponse(
        run_id=None,
        shipment=payload,
        forecast=forecast,
        feasibility=feasibility_response,
        risk=risk,
        cost=cost,
        recommendation=recommendation,
        what_if=what_if,
        best_scenario_id=best_scenario.scenario_id if best_scenario else "",
        generated_at=dt.datetime.utcnow().isoformat(),
        data_status="prototype",
    )

    run = DecisionRun(
        origin_code=origin_code, destination_code=destination_code, cargo_type=payload.cargo_type,
        quantity_tonnes=payload.quantity_tonnes, shipment_date=payload.shipment_date,
        contract_duration_months=payload.contract_duration_months,
        forecast_horizon_weeks=payload.forecast_horizon_weeks,
        recommended_action=recommendation.action, overall_risk=risk.overall,
        total_expected_cost_usd=cost.total_expected_cost_usd, model_version=forecast.model_version,
        data_status="prototype", result_json={},
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # run_id is only known after the initial insert, so stamp it into the response
    # THEN persist the final result_json blob (a second, cheap update) so a later
    # GET /api/decision/runs/{id} returns a payload with a populated run_id.
    response.run_id = run.id
    run.result_json = response.model_dump()
    db.add(run)
    db.commit()

    return response


@router.get("/decision/runs", response_model=list[DecisionRunSummary])
def list_decision_runs(db: Session = Depends(get_db), limit: int = 25):
    rows = db.query(DecisionRun).order_by(DecisionRun.created_at.desc()).limit(limit).all()
    return [
        DecisionRunSummary(
            id=r.id, created_at=r.created_at.isoformat(), origin_code=r.origin_code,
            destination_code=r.destination_code, cargo_type=r.cargo_type, quantity_tonnes=r.quantity_tonnes,
            recommended_action=r.recommended_action, overall_risk=r.overall_risk,
            total_expected_cost_usd=r.total_expected_cost_usd, model_version=r.model_version,
        )
        for r in rows
    ]


@router.get("/decision/runs/{run_id}", response_model=DecisionPipelineResponse)
def get_decision_run(run_id: int, db: Session = Depends(get_db)):
    row = db.query(DecisionRun).filter(DecisionRun.id == run_id).first()
    if not row:
        raise HTTPException(404, f"Decision run {run_id} not found")
    return row.result_json
