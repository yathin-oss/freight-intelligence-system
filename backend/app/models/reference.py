"""Reference / lookup entities: ports, overseas origins, vessel classes,
routes, and freight-rate history. Seeded from data/synthetic CSVs by
app/seed.py. These are read-mostly tables the map and decision workspace
query directly."""
from __future__ import annotations

from sqlalchemy import Float, Integer, String, JSON, Date, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Port(Base):
    __tablename__ = "ports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    state: Mapped[str] = mapped_column(String(64))
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    port_type: Mapped[str] = mapped_column(String(64))
    draft_limit_m: Mapped[float] = mapped_column(Float)
    loa_limit_m: Mapped[float] = mapped_column(Float)
    beam_limit_m: Mapped[float] = mapped_column(Float)
    congestion: Mapped[str] = mapped_column(String(16))
    risk: Mapped[str] = mapped_column(String(16))
    compatible_classes: Mapped[list] = mapped_column(JSON)
    notes: Mapped[str] = mapped_column(String(512), default="")
    data_status: Mapped[str] = mapped_column(String(24), default="ESTIMATED")


class Origin(Base):
    __tablename__ = "origins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    country: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(128))
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    cargoes: Mapped[list] = mapped_column(JSON)
    data_status: Mapped[str] = mapped_column(String(24), default="ESTIMATED")


class VesselClass(Base):
    __tablename__ = "vessel_classes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(64))
    dwt_tonnes: Mapped[float] = mapped_column(Float)
    draft_m: Mapped[float] = mapped_column(Float)
    loa_m: Mapped[float] = mapped_column(Float)
    beam_m: Mapped[float] = mapped_column(Float)
    cargo_capacity_tonnes: Mapped[float] = mapped_column(Float)
    typical_daily_hire_usd: Mapped[float] = mapped_column(Float)
    data_status: Mapped[str] = mapped_column(String(24), default="ESTIMATED")


class Route(Base):
    __tablename__ = "routes"
    __table_args__ = (UniqueConstraint("origin_code", "destination_code", "cargo_type", name="uq_route_lane"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    route_id: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    origin_code: Mapped[str] = mapped_column(String(16), index=True)
    origin_country: Mapped[str] = mapped_column(String(64))
    origin_name: Mapped[str] = mapped_column(String(128))
    destination_code: Mapped[str] = mapped_column(String(16), index=True)
    destination_name: Mapped[str] = mapped_column(String(128))
    cargo_type: Mapped[str] = mapped_column(String(32), index=True)
    distance_nm: Mapped[float] = mapped_column(Float)
    reference_freight_usd_per_tonne: Mapped[float] = mapped_column(Float)
    indicative_annual_volume_tonnes: Mapped[float] = mapped_column(Float, default=0)
    trend: Mapped[str] = mapped_column(String(16))
    trend_pct_8wk: Mapped[float] = mapped_column(Float)
    congestion: Mapped[str] = mapped_column(String(16))
    risk: Mapped[str] = mapped_column(String(16))
    route_status: Mapped[str] = mapped_column(String(16), default="active")
    data_status: Mapped[str] = mapped_column(String(24), default="SYNTHETIC")


class FreightRateHistory(Base):
    __tablename__ = "freight_rate_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[str] = mapped_column(Date, index=True)
    origin_code: Mapped[str] = mapped_column(String(16), index=True)
    cargo_type: Mapped[str] = mapped_column(String(32), index=True)
    rate_usd_per_tonne: Mapped[float] = mapped_column(Float)
    data_status: Mapped[str] = mapped_column(String(24), default="SYNTHETIC")
