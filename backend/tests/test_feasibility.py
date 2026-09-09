"""Unit tests for the deterministic vessel <-> port feasibility engine."""
from app.models.reference import Port, VesselClass
from app.services import feasibility_service


def make_port(**overrides):
    defaults = dict(
        code="TEST", name="Test Port", state="Odisha", lat=0, lon=0, port_type="Bulk",
        draft_limit_m=18.0, loa_limit_m=300.0, beam_limit_m=50.0, congestion="LOW", risk="LOW",
        compatible_classes=["Handysize", "Supramax", "Panamax", "Capesize"], notes="", data_status="ESTIMATED",
    )
    defaults.update(overrides)
    return Port(**defaults)


def make_vessel(**overrides):
    defaults = dict(
        code="CAPE", name="Capesize", dwt_tonnes=180000, draft_m=18.0, loa_m=300.0, beam_m=45.0,
        cargo_capacity_tonnes=175000, typical_daily_hire_usd=22500, data_status="ESTIMATED",
    )
    defaults.update(overrides)
    return VesselClass(**defaults)


def test_feasible_when_all_constraints_satisfied():
    port = make_port()
    vessel = make_vessel()
    result = feasibility_service.evaluate_vessel(vessel, port, quantity_tonnes=80000)
    assert result.feasible is True
    assert result.rejection_reasons == []
    assert all(c.passed for c in result.checks)


def test_infeasible_on_excessive_draft():
    port = make_port(draft_limit_m=14.5, compatible_classes=["Handysize", "Supramax"])
    vessel = make_vessel()  # Capesize draft 18.0m > 14.5m limit
    result = feasibility_service.evaluate_vessel(vessel, port, quantity_tonnes=50000)
    assert result.feasible is False
    assert any("Draft" in r for r in result.rejection_reasons)


def test_infeasible_on_excessive_loa():
    port = make_port(loa_limit_m=230.0, compatible_classes=["Handysize", "Supramax"])
    vessel = make_vessel(draft_m=10.0)  # draft ok, but LOA 300 > 230
    result = feasibility_service.evaluate_vessel(vessel, port, quantity_tonnes=50000)
    assert result.feasible is False
    assert any("LOA" in r for r in result.rejection_reasons)


def test_infeasible_on_excessive_beam():
    port = make_port(beam_limit_m=32.0, compatible_classes=["Handysize", "Supramax"])
    vessel = make_vessel(draft_m=10.0, loa_m=190.0)  # only beam fails
    result = feasibility_service.evaluate_vessel(vessel, port, quantity_tonnes=50000)
    assert result.feasible is False
    assert any("Beam" in r for r in result.rejection_reasons)


def test_infeasible_on_insufficient_cargo_capacity():
    port = make_port()
    vessel = make_vessel(cargo_capacity_tonnes=34000, code="HANDY", name="Handysize",
                          draft_m=10.5, loa_m=190.0, beam_m=32.0)
    result = feasibility_service.evaluate_vessel(vessel, port, quantity_tonnes=80000)
    assert result.feasible is False
    assert any("Cargo capacity" in r for r in result.rejection_reasons)


def test_infeasible_when_not_on_port_class_list():
    port = make_port(compatible_classes=["Handysize", "Supramax"])  # Capesize not listed
    vessel = make_vessel()
    result = feasibility_service.evaluate_vessel(vessel, port, quantity_tonnes=50000)
    assert result.feasible is False
    assert any("compatible class" in r for r in result.rejection_reasons)


def test_evaluate_all_never_silently_drops_candidates():
    port = make_port(draft_limit_m=9.0, loa_limit_m=186.0, beam_limit_m=28.0,
                      compatible_classes=["Handysize"])
    vessels = [
        make_vessel(code="HANDY", name="Handysize", draft_m=10.5, loa_m=190, beam_m=32,
                    cargo_capacity_tonnes=34000, typical_daily_hire_usd=9500),
        make_vessel(),  # Capesize
    ]
    results = feasibility_service.evaluate_all(vessels, port, quantity_tonnes=20000)
    assert len(results) == len(vessels)  # every candidate returned, none dropped
    assert {r.vessel_code for r in results} == {"HANDY", "CAPE"}


def test_recommended_vessel_is_cheapest_feasible():
    port = make_port()
    vessels = [
        make_vessel(code="PANMX", name="Panamax", draft_m=14.5, loa_m=225, beam_m=32.2,
                    cargo_capacity_tonnes=79000, typical_daily_hire_usd=15600),
        make_vessel(),  # Capesize, more expensive
    ]
    results = feasibility_service.evaluate_all(vessels, port, quantity_tonnes=50000)
    recommended = feasibility_service.recommended_vessel_code(results)
    assert recommended == "PANMX"


def test_recommended_vessel_none_when_nothing_feasible():
    port = make_port(draft_limit_m=5.0, loa_limit_m=100.0, beam_limit_m=15.0, compatible_classes=[])
    vessels = [make_vessel()]
    results = feasibility_service.evaluate_all(vessels, port, quantity_tonnes=200000)
    assert feasibility_service.recommended_vessel_code(results) is None
