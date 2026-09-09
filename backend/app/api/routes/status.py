"""
Data / Model status panel backing endpoint. Judges (and the UI) should
always be able to see, at a glance, which figures are real/available,
which are prototype, and which integrations don't exist yet - never
silently degrade without saying so.
"""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.reference import FreightRateHistory, Port, Route, VesselClass
from app.schemas.status import StatusItem, SystemStatus
from app.services.forecast_service import get_forecaster

router = APIRouter()


@router.get("/status", response_model=SystemStatus)
def system_status(db: Session = Depends(get_db)):
    items: list[StatusItem] = []

    try:
        db.execute(text("SELECT 1"))
        port_count = db.query(Port).count()
        route_count = db.query(Route).count()
        vessel_count = db.query(VesselClass).count()
        history_count = db.query(FreightRateHistory).count()
        items.append(StatusItem(name="Database", state="available",
                                 detail=f"Connected ({settings.DATABASE_URL.split('://')[0]})."))
        items.append(StatusItem(name="Port Data", state="available" if port_count else "error",
                                 detail=f"{port_count} East Coast India ports seeded (ESTIMATED constraints)."))
        items.append(StatusItem(name="Route / Map Data", state="available" if route_count else "error",
                                 detail=f"{route_count} origin-destination lanes seeded (SYNTHETIC freight refs)."))
        items.append(StatusItem(name="Vessel Class Data", state="available" if vessel_count else "error",
                                 detail=f"{vessel_count} vessel classes seeded (ESTIMATED industry-typical)."))
        items.append(StatusItem(name="Freight Rate History", state="prototype" if history_count else "error",
                                 detail=f"{history_count} weekly rate observations (SYNTHETIC)."))
    except Exception as exc:  # noqa: BLE001
        items.append(StatusItem(name="Database", state="error", detail=f"Database unavailable: {exc}"))

    forecaster = get_forecaster()
    if forecaster.model_ready:
        items.append(StatusItem(name="ML Model", state="available",
                                 detail=f"{forecaster.artifact['model_type']} loaded "
                                        f"(version {forecaster.artifact['model_version']})."))
    else:
        items.append(StatusItem(name="ML Model", state="prototype",
                                 detail=f"Trained model not loaded - serving moving-average baseline fallback. "
                                        f"({forecaster.load_error})"))

    items.append(StatusItem(name="Congestion Data", state="prototype",
                             detail="Prototype classification (LOW/MEDIUM/HIGH), not live VTMS telemetry."))
    items.append(StatusItem(name="AIS Vessel Tracking", state="not_connected",
                             detail="FUTURE INTEGRATION - no live AIS feed in this prototype."))
    items.append(StatusItem(name="Licensed Freight Index", state="not_connected",
                             detail="FUTURE INTEGRATION - Baltic Exchange / Clarksons not licensed for this prototype."))
    items.append(StatusItem(name="Map Data", state="available",
                             detail="Port/route GeoJSON derived from seeded reference data."))

    return SystemStatus(
        items=items,
        ml_model_version=forecaster.artifact["model_version"] if forecaster.model_ready else "baseline-fallback",
        ml_model_ready=forecaster.model_ready,
        database_url_kind=settings.DATABASE_URL.split("://")[0],
        generated_at=dt.datetime.utcnow().isoformat(),
    )
