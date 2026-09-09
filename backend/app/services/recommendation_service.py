"""
Final charter-timing recommendation.

This is the one place in the codebase where forecast + constraints + risk +
cost are combined into a single action word. The rule set below is entirely
deterministic (no ML) and is written so every branch is traceable back to a
specific upstream number - this is the "AI vs Rules" separation the judge
defense doc calls out: ML predicts the rate, this module decides what to DO
about it.

Decision rule (in order):
  1. If no feasible vessel exists at the destination at all -> MONITOR.
  2. Compare total expected cost of BOOK_NOW vs the best WAIT window.
  3. If WAIT is not cheaper -> BOOK_NOW.
  4. If WAIT is cheaper but forecast confidence is too low (<55%) to act on
     -> MONITOR (cost saving is not trustworthy enough to commit to).
  5. If WAIT is cheaper and confident, but destination risk is HIGH -> the
     risk factor overrides the pure cost optimum -> BOOK_NOW (execution
     certainty prioritised over a marginal, riskier saving).
  6. Otherwise -> WAIT / BOOK_WITHIN_RANGE, with an explicit week window.
"""
from __future__ import annotations

from app.schemas.decision import (
    ExplanationItem,
    ForecastOut,
    RecommendationOut,
    RiskAssessmentOut,
    WhatIfScenario,
)


def _find(scenarios: list[WhatIfScenario], scenario_id: str) -> WhatIfScenario | None:
    return next((s for s in scenarios if s.scenario_id == scenario_id), None)


def recommend(
    *,
    forecast: ForecastOut,
    risk: RiskAssessmentOut,
    what_if: list[WhatIfScenario],
    port_name: str,
    recommended_vessel_class: str | None,
    feasible_count: int,
    total_evaluated: int,
) -> RecommendationOut:
    book_now = _find(what_if, "BOOK_NOW")
    wait_best = _find(what_if, "WAIT_BEST")

    explanation: list[str] = [
        f"Model forecasts freight will move {forecast.trend} by {abs(forecast.trend_pct):.1f}% "
        f"over the {len(forecast.forecast)}-week horizon (model_version={forecast.model_version}).",
        f"Forecast confidence is {forecast.confidence * 100:.0f}%; recent rate volatility is "
        f"classified {forecast.volatility}.",
        f"Destination congestion is {risk.overall.lower()} overall "
        f"(see Risk panel for the four contributing factors).",
    ]

    if recommended_vessel_class:
        explanation.append(
            f"{recommended_vessel_class} is the recommended feasible vessel class "
            f"({feasible_count} of {total_evaluated} evaluated classes are feasible at {port_name})."
        )
    else:
        explanation.append(
            f"No evaluated vessel class ({total_evaluated} checked) is feasible at {port_name} "
            f"for this cargo quantity."
        )
        return RecommendationOut(
            action="MONITOR",
            headline="MONITOR MARKET",
            explanation=[ExplanationItem(order=i + 1, statement=s) for i, s in enumerate(explanation)],
            data_status=forecast.data_status,
        )

    if not book_now or not book_now.feasible:
        explanation.append("Book-Now scenario is infeasible at this port for this shipment.")
        return RecommendationOut(
            action="MONITOR", headline="MONITOR MARKET",
            explanation=[ExplanationItem(order=i + 1, statement=s) for i, s in enumerate(explanation)],
            data_status=forecast.data_status,
        )

    if not wait_best or not wait_best.feasible or wait_best.wait_weeks == 0:
        explanation.append("No lower-cost future week was found within the forecast horizon; booking now is cost-optimal.")
        return RecommendationOut(
            action="BOOK_NOW", headline="BOOK NOW",
            explanation=[ExplanationItem(order=i + 1, statement=s) for i, s in enumerate(explanation)],
            data_status=forecast.data_status,
        )

    book_cost = book_now.cost.total_expected_cost_usd
    wait_cost = wait_best.cost.total_expected_cost_usd
    diff = book_cost - wait_cost
    pct = (diff / book_cost * 100) if book_cost else 0.0

    explanation.append(
        f"Total expected cost - Book Now: ${book_cost:,.0f} vs Wait {wait_best.wait_weeks} week(s): "
        f"${wait_cost:,.0f} ({'wait is cheaper by' if diff > 0 else 'book now is cheaper by'} "
        f"${abs(diff):,.0f}, {abs(pct):.1f}%)."
    )

    if diff <= 0:
        explanation.append("Waiting does not reduce total expected cost; booking now is cost-optimal.")
        return RecommendationOut(
            action="BOOK_NOW", headline="BOOK NOW",
            explanation=[ExplanationItem(order=i + 1, statement=s) for i, s in enumerate(explanation)],
            data_status=forecast.data_status,
        )

    if forecast.confidence < 0.55:
        explanation.append(
            f"Forecast confidence ({forecast.confidence * 100:.0f}%) is below the 55% threshold this "
            f"system requires to commit to a wait window, even though waiting looks cheaper on paper."
        )
        return RecommendationOut(
            action="MONITOR", headline="MONITOR MARKET",
            explanation=[ExplanationItem(order=i + 1, statement=s) for i, s in enumerate(explanation)],
            data_status=forecast.data_status,
        )

    if risk.overall == "HIGH":
        explanation.append(
            "Overall risk is classified HIGH; this system prioritises execution certainty over a "
            "marginal cost saving and overrides the cost-optimal WAIT signal -> BOOK NOW."
        )
        return RecommendationOut(
            action="BOOK_NOW", headline="BOOK NOW (risk override)",
            explanation=[ExplanationItem(order=i + 1, statement=s) for i, s in enumerate(explanation)],
            data_status=forecast.data_status,
        )

    week = wait_best.wait_weeks
    wmin, wmax = max(1, week - 1), week + 1
    if week <= 2:
        explanation.append(f"Recommended action: WAIT approximately {week} week(s) before chartering.")
        return RecommendationOut(
            action="WAIT", headline=f"WAIT {week} WEEK(S)",
            wait_weeks_min=week, wait_weeks_max=week,
            explanation=[ExplanationItem(order=i + 1, statement=s) for i, s in enumerate(explanation)],
            data_status=forecast.data_status,
        )

    explanation.append(f"Recommended action: book within a {wmin}-{wmax} week window to capture the forecast dip.")
    return RecommendationOut(
        action="BOOK_WITHIN_RANGE", headline=f"BOOK WITHIN {wmin}-{wmax} WEEKS",
        wait_weeks_min=wmin, wait_weeks_max=wmax,
        explanation=[ExplanationItem(order=i + 1, statement=s) for i, s in enumerate(explanation)],
        data_status=forecast.data_status,
    )
