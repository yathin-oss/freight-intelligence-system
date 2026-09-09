"""Unit tests for the total expected logistics cost model."""
from app.models.reference import Port, VesselClass
from app.schemas.decision import RiskAssessmentOut
from app.services import cost_service


def make_port(congestion="LOW"):
    return Port(code="T", name="Test", state="X", lat=0, lon=0, port_type="Bulk", draft_limit_m=18,
                loa_limit_m=300, beam_limit_m=50, congestion=congestion, risk="LOW",
                compatible_classes=[], notes="", data_status="ESTIMATED")


def make_vessel(daily_hire=20000):
    return VesselClass(code="CAPE", name="Capesize", dwt_tonnes=180000, draft_m=18, loa_m=300, beam_m=45,
                        cargo_capacity_tonnes=175000, typical_daily_hire_usd=daily_hire, data_status="ESTIMATED")


def test_cost_components_sum_to_total():
    port = make_port("MEDIUM")
    vessel = make_vessel()
    risk = RiskAssessmentOut(overall="MEDIUM", factors=[], data_status="prototype")
    result = cost_service.estimate_cost(
        freight_rate_usd_per_tonne=15.0, quantity_tonnes=80000, vessel=vessel, port=port,
        risk=risk, distance_nm=8000,
    )
    total = (result.freight_cost_usd + result.expected_idle_cost_usd + result.expected_demurrage_usd
             + result.deadheading_cost_usd + result.risk_penalty_usd)
    assert abs(total - result.total_expected_cost_usd) < 0.01


def test_higher_congestion_increases_idle_and_demurrage_cost():
    vessel = make_vessel()
    risk = RiskAssessmentOut(overall="MEDIUM", factors=[], data_status="prototype")
    low = cost_service.estimate_cost(freight_rate_usd_per_tonne=15.0, quantity_tonnes=80000, vessel=vessel,
                                      port=make_port("LOW"), risk=risk, distance_nm=8000)
    high = cost_service.estimate_cost(freight_rate_usd_per_tonne=15.0, quantity_tonnes=80000, vessel=vessel,
                                       port=make_port("HIGH"), risk=risk, distance_nm=8000)
    assert high.expected_idle_cost_usd > low.expected_idle_cost_usd
    assert high.total_expected_cost_usd > low.total_expected_cost_usd


def test_higher_risk_increases_risk_penalty():
    vessel = make_vessel()
    port = make_port("LOW")
    low_risk = RiskAssessmentOut(overall="LOW", factors=[], data_status="prototype")
    high_risk = RiskAssessmentOut(overall="HIGH", factors=[], data_status="prototype")
    low = cost_service.estimate_cost(freight_rate_usd_per_tonne=15.0, quantity_tonnes=80000, vessel=vessel,
                                      port=port, risk=low_risk, distance_nm=8000)
    high = cost_service.estimate_cost(freight_rate_usd_per_tonne=15.0, quantity_tonnes=80000, vessel=vessel,
                                       port=port, risk=high_risk, distance_nm=8000)
    assert high.risk_penalty_usd > low.risk_penalty_usd


def test_deadheading_only_applies_when_baseline_distance_given():
    vessel = make_vessel()
    port = make_port("LOW")
    risk = RiskAssessmentOut(overall="LOW", factors=[], data_status="prototype")
    no_baseline = cost_service.estimate_cost(freight_rate_usd_per_tonne=15.0, quantity_tonnes=80000,
                                              vessel=vessel, port=port, risk=risk, distance_nm=9000)
    with_baseline = cost_service.estimate_cost(freight_rate_usd_per_tonne=15.0, quantity_tonnes=80000,
                                                vessel=vessel, port=port, risk=risk, distance_nm=9000,
                                                baseline_distance_nm=7000)
    assert no_baseline.deadheading_cost_usd == 0.0
    assert with_baseline.deadheading_cost_usd > 0.0


def test_cost_never_negative():
    vessel = make_vessel()
    port = make_port("LOW")
    risk = RiskAssessmentOut(overall="LOW", factors=[], data_status="prototype")
    result = cost_service.estimate_cost(freight_rate_usd_per_tonne=1.0, quantity_tonnes=1000, vessel=vessel,
                                         port=port, risk=risk, distance_nm=100)
    for value in (result.freight_cost_usd, result.expected_idle_cost_usd, result.expected_demurrage_usd,
                  result.deadheading_cost_usd, result.risk_penalty_usd, result.total_expected_cost_usd):
        assert value >= 0
