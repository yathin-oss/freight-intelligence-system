from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class PortOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    code: str
    name: str
    state: str
    lat: float
    lon: float
    port_type: str
    draft_limit_m: float | None
    loa_limit_m: float | None
    beam_limit_m: float | None
    congestion: str
    risk: str
    compatible_classes: list[str]
    notes: str
    data_status: str


class OriginOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    code: str
    country: str
    name: str
    lat: float
    lon: float
    cargoes: list[str]
    data_status: str


class VesselClassOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    code: str
    name: str
    dwt_tonnes: float
    draft_m: float
    loa_m: float
    beam_m: float
    cargo_capacity_tonnes: float
    typical_daily_hire_usd: float
    data_status: str


class RouteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    route_id: str
    origin_code: str
    origin_country: str
    origin_name: str
    destination_code: str
    destination_name: str
    cargo_type: str
    distance_nm: float
    reference_freight_usd_per_tonne: float
    indicative_annual_volume_tonnes: float
    trend: str
    trend_pct_8wk: float
    congestion: str
    risk: str
    route_status: str
    data_status: str


class FreightRatePoint(BaseModel):
    date: str
    rate_usd_per_tonne: float
