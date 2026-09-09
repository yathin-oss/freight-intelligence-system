"""Unit tests for the deterministic charter-timing recommendation logic."""
from app.schemas.decision import CostBreakdown, ForecastOut, RiskAssessmentOut, WhatIfScenario
from app.services import recommendation_service


def make_forecast(confidence=0.8, trend="stable", trend_pct=0.0, n_points=8):
    return ForecastOut(
        origin_code="AUNTL", cargo_type="Coal", current_rate=16.0, current_rate_date="2026-09-01",
        forecast=[{"week_offset": i, "date": "2026-09-01", "predicted_rate": 16.0, "lower": 14, "upper": 18}
                  for i in range(1, n_points + 1)],
        trend=trend, trend_pct=trend_pct, confidence=confidence, volatility="medium",
        model_version="freight-v1", data_status="prototype", method_note="test",
    )


def make_cost(total):
    return CostBreakdown(
        freight_cost_usd=total * 0.8, expected_idle_cost_usd=total * 0.1, expected_demurrage_usd=0,
        deadheading_cost_usd=0, risk_penalty_usd=total * 0.1, total_expected_cost_usd=total,
        assumptions=[], data_status="prototype",
    )


def make_risk(overall="MEDIUM"):
    return RiskAssessmentOut(overall=overall, factors=[], data_status="prototype")


def make_scenario(scenario_id, wait_weeks, total_cost, feasible=True):
    return WhatIfScenario(
        scenario_id=scenario_id, label=scenario_id, description="", vessel_code="CAPE",
        vessel_class="Capesize", destination_code="INPAR", destination_name="Paradip",
        wait_weeks=wait_weeks, feasible=feasible, feasibility_reasons=[], freight_rate_used=16.0,
        cost=make_cost(total_cost), risk=make_risk(),
    )


def test_book_now_when_no_feasible_vessel():
    forecast = make_forecast()
    risk = make_risk()
    rec = recommendation_service.recommend(
        forecast=forecast, risk=risk, what_if=[], port_name="Paradip",
        recommended_vessel_class=None, feasible_count=0, total_evaluated=4,
    )
    assert rec.action == "MONITOR"


def test_book_now_when_waiting_is_not_cheaper():
    forecast = make_forecast()
    risk = make_risk("LOW")
    what_if = [make_scenario("BOOK_NOW", 0, 100000), make_scenario("WAIT_BEST", 4, 105000)]
    rec = recommendation_service.recommend(
        forecast=forecast, risk=risk, what_if=what_if, port_name="Paradip",
        recommended_vessel_class="Capesize", feasible_count=1, total_evaluated=4,
    )
    assert rec.action == "BOOK_NOW"


def test_wait_recommended_when_cheaper_confident_and_low_risk():
    forecast = make_forecast(confidence=0.85, trend="decreasing", trend_pct=-8.0)
    risk = make_risk("LOW")
    what_if = [make_scenario("BOOK_NOW", 0, 110000), make_scenario("WAIT_BEST", 5, 95000)]
    rec = recommendation_service.recommend(
        forecast=forecast, risk=risk, what_if=what_if, port_name="Paradip",
        recommended_vessel_class="Capesize", feasible_count=2, total_evaluated=4,
    )
    assert rec.action == "BOOK_WITHIN_RANGE"
    assert rec.wait_weeks_min is not None and rec.wait_weeks_max is not None
    assert rec.wait_weeks_min <= 5 <= rec.wait_weeks_max


def test_monitor_when_wait_cheaper_but_confidence_too_low():
    forecast = make_forecast(confidence=0.4, trend="decreasing", trend_pct=-8.0)
    risk = make_risk("LOW")
    what_if = [make_scenario("BOOK_NOW", 0, 110000), make_scenario("WAIT_BEST", 5, 95000)]
    rec = recommendation_service.recommend(
        forecast=forecast, risk=risk, what_if=what_if, port_name="Paradip",
        recommended_vessel_class="Capesize", feasible_count=2, total_evaluated=4,
    )
    assert rec.action == "MONITOR"


def test_high_risk_overrides_cheaper_wait_scenario():
    forecast = make_forecast(confidence=0.85, trend="decreasing", trend_pct=-8.0)
    risk = make_risk("HIGH")
    what_if = [make_scenario("BOOK_NOW", 0, 110000), make_scenario("WAIT_BEST", 5, 95000)]
    rec = recommendation_service.recommend(
        forecast=forecast, risk=risk, what_if=what_if, port_name="Paradip",
        recommended_vessel_class="Capesize", feasible_count=2, total_evaluated=4,
    )
    assert rec.action == "BOOK_NOW"
    assert "risk" in rec.headline.lower()


def test_explanation_is_never_empty_and_traces_real_numbers():
    forecast = make_forecast(confidence=0.8, trend="stable")
    risk = make_risk("LOW")
    what_if = [make_scenario("BOOK_NOW", 0, 100000)]
    rec = recommendation_service.recommend(
        forecast=forecast, risk=risk, what_if=what_if, port_name="Paradip",
        recommended_vessel_class="Capesize", feasible_count=1, total_evaluated=4,
    )
    assert len(rec.explanation) >= 3
    joined = " ".join(e.statement for e in rec.explanation)
    assert "80%" in joined  # confidence traced through to the explanation text
