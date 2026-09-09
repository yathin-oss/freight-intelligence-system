from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.reference import FreightRateHistory, Origin, Port, Route, VesselClass
from app.schemas.reference import FreightRatePoint, OriginOut, PortOut, RouteOut, VesselClassOut

router = APIRouter()


@router.get("/ports", response_model=list[PortOut])
def list_ports(db: Session = Depends(get_db)):
    return db.query(Port).order_by(Port.name).all()


@router.get("/ports/{code}", response_model=PortOut)
def get_port(code: str, db: Session = Depends(get_db)):
    port = db.query(Port).filter(Port.code == code.upper()).first()
    if not port:
        raise HTTPException(404, f"Port '{code}' not found")
    return port


@router.get("/origins", response_model=list[OriginOut])
def list_origins(db: Session = Depends(get_db)):
    return db.query(Origin).order_by(Origin.country).all()


@router.get("/vessel-classes", response_model=list[VesselClassOut])
def list_vessel_classes(db: Session = Depends(get_db)):
    return db.query(VesselClass).order_by(VesselClass.cargo_capacity_tonnes).all()


@router.get("/routes", response_model=list[RouteOut])
def list_routes(
    db: Session = Depends(get_db),
    origin_code: str | None = None,
    destination_code: str | None = None,
    cargo_type: str | None = None,
    risk: str | None = None,
    trend: str | None = None,
):
    q = db.query(Route)
    if origin_code:
        q = q.filter(Route.origin_code == origin_code.upper())
    if destination_code:
        q = q.filter(Route.destination_code == destination_code.upper())
    if cargo_type:
        q = q.filter(Route.cargo_type == cargo_type)
    if risk:
        q = q.filter(Route.risk == risk.upper())
    if trend:
        q = q.filter(Route.trend == trend.lower())
    return q.order_by(Route.origin_code, Route.destination_code).all()


@router.get("/freight-rate-history", response_model=list[FreightRatePoint])
def freight_rate_history(
    origin_code: str, cargo_type: str, weeks: int = Query(default=52, le=208), db: Session = Depends(get_db)
):
    rows = (
        db.query(FreightRateHistory)
        .filter(FreightRateHistory.origin_code == origin_code.upper(), FreightRateHistory.cargo_type == cargo_type)
        .order_by(FreightRateHistory.date.desc())
        .limit(weeks)
        .all()
    )
    rows.reverse()
    if not rows:
        raise HTTPException(404, f"No freight rate history for {origin_code}/{cargo_type}")
    return [FreightRatePoint(date=str(r.date), rate_usd_per_tonne=r.rate_usd_per_tonne) for r in rows]
