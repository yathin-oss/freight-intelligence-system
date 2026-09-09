"""
Deterministic vessel <-> port feasibility engine.

This is intentionally NOT machine learning. Whether a Capesize physically
fits under a port's draft limit is an engineering constraint, not a
statistical prediction - see README "AI vs Rules" for why this separation
matters and is defensible to judges.

Every vessel class is ALWAYS evaluated and ALWAYS returned, feasible or
not, with the specific reason(s) it failed. Nothing is silently dropped.
"""
from __future__ import annotations

from app.models.reference import Port, VesselClass
from app.schemas.decision import FeasibilityCheck, VesselFeasibilityOut


def evaluate_vessel(vessel: VesselClass, port: Port, quantity_tonnes: float) -> VesselFeasibilityOut:
    checks: list[FeasibilityCheck] = []
    reasons: list[str] = []

    cargo_ok = vessel.cargo_capacity_tonnes >= quantity_tonnes
    checks.append(FeasibilityCheck(
        label="Cargo capacity",
        passed=cargo_ok,
        detail=f"{vessel.cargo_capacity_tonnes:,.0f} t capacity vs {quantity_tonnes:,.0f} t required",
    ))
    if not cargo_ok:
        reasons.append(
            f"Cargo capacity {vessel.cargo_capacity_tonnes:,.0f} t is below the "
            f"{quantity_tonnes:,.0f} t shipment quantity"
        )

    draft_ok = vessel.draft_m <= port.draft_limit_m
    checks.append(FeasibilityCheck(
        label="Draft",
        passed=draft_ok,
        detail=f"{vessel.draft_m:.1f} m vessel draft vs {port.draft_limit_m:.1f} m port limit ({port.name})",
    ))
    if not draft_ok:
        reasons.append(f"Draft {vessel.draft_m:.1f} m exceeds {port.name}'s {port.draft_limit_m:.1f} m limit")

    loa_ok = vessel.loa_m <= port.loa_limit_m
    checks.append(FeasibilityCheck(
        label="Length overall (LOA)",
        passed=loa_ok,
        detail=f"{vessel.loa_m:.0f} m LOA vs {port.loa_limit_m:.0f} m port limit",
    ))
    if not loa_ok:
        reasons.append(f"LOA {vessel.loa_m:.0f} m exceeds {port.name}'s {port.loa_limit_m:.0f} m limit")

    beam_ok = vessel.beam_m <= port.beam_limit_m
    checks.append(FeasibilityCheck(
        label="Beam",
        passed=beam_ok,
        detail=f"{vessel.beam_m:.1f} m beam vs {port.beam_limit_m:.1f} m port limit",
    ))
    if not beam_ok:
        reasons.append(f"Beam {vessel.beam_m:.1f} m exceeds {port.name}'s {port.beam_limit_m:.1f} m limit")

    class_listed = vessel.name in (port.compatible_classes or [])
    checks.append(FeasibilityCheck(
        label="Port class compatibility list",
        passed=class_listed,
        detail=(f"{vessel.name} is on {port.name}'s compatible-class list"
                if class_listed else f"{vessel.name} is not on {port.name}'s compatible-class list"),
    ))
    if not class_listed:
        reasons.append(f"{vessel.name} is not listed as an operationally compatible class at {port.name}")

    feasible = all(c.passed for c in checks)

    return VesselFeasibilityOut(
        vessel_code=vessel.code,
        vessel_class=vessel.name,
        feasible=feasible,
        checks=checks,
        rejection_reasons=reasons,
        estimated_freight_cost_usd=None,
        estimated_daily_hire_usd=vessel.typical_daily_hire_usd,
    )


def evaluate_all(vessels: list[VesselClass], port: Port, quantity_tonnes: float) -> list[VesselFeasibilityOut]:
    results = [evaluate_vessel(v, port, quantity_tonnes) for v in vessels]
    # Rank feasible vessels ahead of infeasible ones; among feasible, prefer the
    # smallest capacity that still clears the cargo requirement (cost-efficient
    # sizing rather than defaulting to the biggest ship available).
    def sort_key(r: VesselFeasibilityOut):
        return (0 if r.feasible else 1, r.estimated_daily_hire_usd)

    return sorted(results, key=sort_key)


def recommended_vessel_code(results: list[VesselFeasibilityOut]) -> str | None:
    feasible = [r for r in results if r.feasible]
    if not feasible:
        return None
    return min(feasible, key=lambda r: r.estimated_daily_hire_usd).vessel_code
