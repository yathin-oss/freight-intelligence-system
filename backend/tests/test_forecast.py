"""Integration tests for POST /api/forecast."""


def test_forecast_valid_lane_returns_full_payload(client):
    resp = client.post("/api/forecast", json={"origin_code": "AUNTL", "cargo_type": "Coal", "horizon_weeks": 8})
    assert resp.status_code == 200
    body = resp.json()
    assert body["origin_code"] == "AUNTL"
    assert body["cargo_type"] == "Coal"
    assert len(body["forecast"]) == 8
    assert body["forecast"][0]["week_offset"] == 1
    assert 0.0 <= body["confidence"] <= 1.0
    assert body["trend"] in ("increasing", "decreasing", "stable")
    assert body["volatility"] in ("low", "medium", "high")
    assert body["model_version"]
    assert body["data_status"] in ("prototype", "prototype-fallback")


def test_forecast_confidence_band_widens_with_horizon(client):
    resp = client.post("/api/forecast", json={"origin_code": "AUNTL", "cargo_type": "Coal", "horizon_weeks": 12})
    points = resp.json()["forecast"]
    early_width = points[0]["upper"] - points[0]["lower"]
    late_width = points[-1]["upper"] - points[-1]["lower"]
    assert late_width >= early_width  # recursive multi-step forecasts should not get MORE confident with horizon


def test_forecast_unknown_lane_returns_explicit_unavailable_not_fabricated_data(client):
    resp = client.post("/api/forecast", json={"origin_code": "USNFK", "cargo_type": "Iron Ore", "horizon_weeks": 8})
    assert resp.status_code == 422
    body = resp.json()["detail"]
    assert body["data_status"] == "unavailable"


def test_forecast_rejects_horizon_out_of_bounds(client):
    resp = client.post("/api/forecast", json={"origin_code": "AUNTL", "cargo_type": "Coal", "horizon_weeks": 999})
    assert resp.status_code == 422


def test_forecast_missing_required_field(client):
    resp = client.post("/api/forecast", json={"cargo_type": "Coal"})
    assert resp.status_code == 422
