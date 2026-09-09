"""
End-to-end test of the full decision pipeline via the HTTP API - this is
the automated version of the mandatory
    Australia -> Paradip -> Coal -> 80,000t -> Forecast -> Vessel selection
    -> Port feasibility -> Risk -> Scenario comparison -> Recommendation
path called out in the project brief. If this test passes, the primary demo
scenario works end-to-end.
"""

PRIMARY_SCENARIO = {
    "origin_code": "AUNTL",
    "destination_code": "INPAR",
    "cargo_type": "Coal",
    "quantity_tonnes": 80000,
    "shipment_date": "2026-09-15",
    "contract_duration_months": 3,
    "forecast_horizon_weeks": 12,
}


def test_primary_demo_scenario_end_to_end(client):
    resp = client.post("/api/decision/run", json=PRIMARY_SCENARIO)
    assert resp.status_code == 200
    body = resp.json()

    # 1. forecast present and well-formed
    assert body["forecast"]["origin_code"] == "AUNTL"
    assert len(body["forecast"]["forecast"]) == 12

    # 2. feasibility: every vessel class evaluated, none silently dropped
    assert len(body["feasibility"]["results"]) == 4
    feasible = [r for r in body["feasibility"]["results"] if r["feasible"]]
    assert len(feasible) >= 1  # Capesize should be feasible at Paradip for 80,000t

    # 3. risk assessed with all four factors
    assert body["risk"]["overall"] in ("LOW", "MEDIUM", "HIGH")
    assert len(body["risk"]["factors"]) == 4

    # 4. cost breakdown present and internally consistent
    cost = body["cost"]
    component_sum = (
        cost["freight_cost_usd"] + cost["expected_idle_cost_usd"] + cost["expected_demurrage_usd"]
        + cost["deadheading_cost_usd"] + cost["risk_penalty_usd"]
    )
    assert abs(component_sum - cost["total_expected_cost_usd"]) < 0.01

    # 5. what-if scenarios generated and best flagged
    assert len(body["what_if"]) >= 2
    best_flagged = [s for s in body["what_if"] if s["is_best"]]
    assert len(best_flagged) == 1

    # 6. explainable recommendation
    assert body["recommendation"]["action"] in ("BOOK_NOW", "WAIT", "BOOK_WITHIN_RANGE", "MONITOR")
    assert len(body["recommendation"]["explanation"]) >= 3

    # 7. persisted to DB with a real run_id
    assert isinstance(body["run_id"], int)


def test_decision_run_is_retrievable_by_id(client):
    create_resp = client.post("/api/decision/run", json=PRIMARY_SCENARIO)
    run_id = create_resp.json()["run_id"]
    get_resp = client.get(f"/api/decision/runs/{run_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["run_id"] == run_id


def test_decision_runs_list_returns_history(client):
    client.post("/api/decision/run", json=PRIMARY_SCENARIO)
    resp = client.get("/api/decision/runs")
    assert resp.status_code == 200
    runs = resp.json()
    assert len(runs) >= 1
    assert runs[0]["origin_code"] == "AUNTL"


def test_unknown_route_returns_404_not_fabricated_result(client):
    bad = dict(PRIMARY_SCENARIO, origin_code="USNFK", cargo_type="Iron Ore")
    resp = client.post("/api/decision/run", json=bad)
    assert resp.status_code == 404


def test_unknown_port_returns_404(client):
    bad = dict(PRIMARY_SCENARIO, destination_code="ZZZZ")
    resp = client.post("/api/decision/run", json=bad)
    assert resp.status_code == 404


def test_oversized_cargo_for_all_vessels_yields_monitor_not_a_crash(client):
    tiny_port_huge_cargo = dict(PRIMARY_SCENARIO, quantity_tonnes=500000)  # exceeds even Capesize
    resp = client.post("/api/decision/run", json=tiny_port_huge_cargo)
    assert resp.status_code == 200
    assert resp.json()["recommendation"]["action"] == "MONITOR"


def test_invalid_quantity_rejected(client):
    bad = dict(PRIMARY_SCENARIO, quantity_tonnes=0)
    resp = client.post("/api/decision/run", json=bad)
    assert resp.status_code == 422
