"""Write-path entities: every shipment scenario a user actually runs through
the decision pipeline is persisted here, audit-style. This is what backs the
Scenario Simulator's history and proves the app is a real, stateful decision
support system rather than a static calculator."""
from __future__ import annotations

import datetime as dt

from sqlalchemy import Float, Integer, String, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DecisionRun(Base):
    """One full pass through PREDICT -> FEASIBILITY -> RISK -> OPTIMIZE -> EXPLAIN -> RECOMMEND
    for a single shipment scenario. `result_json` holds the complete structured pipeline
    output (forecast, feasibility table, risk breakdown, scenario comparison, recommendation
    + explanation) exactly as returned by the API, so re-opening a past run reproduces it
    without recomputation drift."""

    __tablename__ = "decision_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow, index=True)

    origin_code: Mapped[str] = mapped_column(String(16))
    destination_code: Mapped[str] = mapped_column(String(16))
    cargo_type: Mapped[str] = mapped_column(String(32))
    quantity_tonnes: Mapped[float] = mapped_column(Float)
    shipment_date: Mapped[str] = mapped_column(String(32))
    contract_duration_months: Mapped[int] = mapped_column(Integer)
    forecast_horizon_weeks: Mapped[int] = mapped_column(Integer)

    recommended_action: Mapped[str] = mapped_column(String(32))
    overall_risk: Mapped[str] = mapped_column(String(16))
    total_expected_cost_usd: Mapped[float] = mapped_column(Float)
    model_version: Mapped[str] = mapped_column(String(32))
    data_status: Mapped[str] = mapped_column(String(24), default="prototype")

    result_json: Mapped[dict] = mapped_column(JSON)
