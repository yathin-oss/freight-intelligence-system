"""Unit tests for the explainable risk engine."""
from app.models.reference import Port
from app.schemas.decision import ForecastOut, VesselFeasibilityOut
from app.services import risk_service


def make_forecast(confidence=0.8, volatility="low", trend_pct=1.0):
    return ForecastOut(
        origin_code="AUNTL", cargo_type="Coal", current_rate=16.0, current_rate_date="2026-09-01",
        forecast=[], trend="stable", trend_pct=trend_pct, confidence=confidence, volatility=volatility,
        model_version="freight-v1", data_status="prototype", method_note="test",
    )


def make_port(congestion="LOW"):
    return Port(
        code="TEST", name="Test", state="Odisha", lat=0, lon=0, port_type="Bulk",
        draft_limit_m=18, loa_limit_m=300, beam_limit_m=50, congestion=congestion, risk="LOW",
        compatible_classes=[], notes="", data_status="ESTIMATED",
    )


def make_feasibility(n_feasible, n_total=4):
    return [
        VesselFeasibilityOut(vessel_code=f"V{i}", vessel_class=f"Class{i}", feasible=(i < n_feasible),
                              checks=[], rejection_reasons=[], estimated_daily_hire_usd=10000)
        for i in range(n_total)
    ]


def test_low_risk_when_all_factors_favorable():
    forecast = make_forecast(confidence=0.9, volatility="low")
    port = make_port(congestion="LOW")
    feasibility = make_feasibility(4)
    result = risk_service.assess(forecast, port, feasibility)
    assert result.overall == "LOW"


def test_high_risk_when_all_factors_unfavorable():
    forecast = make_forecast(confidence=0.3, volatility="high")
    port = make_port(congestion="HIGH")
    feasibility = make_feasibility(0)
    result = risk_service.assess(forecast, port, feasibility)
    assert result.overall == "HIGH"


def test_zero_feasible_vessels_drives_high_availability_risk():
    forecast = make_forecast()
    port = make_port()
    feasibility = make_feasibility(0)
    result = risk_service.assess(forecast, port, feasibility)
    availability_factor = next(f for f in result.factors if f.label == "Vessel availability")
    assert availability_factor.level == "HIGH"


def test_low_confidence_drives_high_forecast_uncertainty():
    forecast = make_forecast(confidence=0.4)
    port = make_port()
    feasibility = make_feasibility(4)
    result = risk_service.assess(forecast, port, feasibility)
    uncertainty_factor = next(f for f in result.factors if f.label == "Forecast uncertainty")
    assert uncertainty_factor.level == "HIGH"


def test_risk_is_explainable_with_four_factors():
    forecast = make_forecast()
    port = make_port()
    feasibility = make_feasibility(2)
    result = risk_service.assess(forecast, port, feasibility)
    labels = {f.label for f in result.factors}
    assert labels == {"Freight rate volatility", "Forecast uncertainty", "Port congestion", "Vessel availability"}
    for f in result.factors:
        assert f.detail  # every factor must carry a human-readable explanation, never blank
