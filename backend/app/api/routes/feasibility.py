from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.reference import Port, VesselClass
from app.schemas.decision import FeasibilityRequest, FeasibilityResponse
from app.services import feasibility_service

router = APIRouter()


@router.post("/feasibility", response_model=FeasibilityResponse)
def post_feasibility(payload: FeasibilityRequest, db: Session = Depends(get_db)):
    port = db.query(Port).filter(Port.code == payload.destination_code.upper()).first()
    if not port:
        raise HTTPException(404, f"Port '{payload.destination_code}' not found")
    vessels = db.query(VesselClass).order_by(VesselClass.cargo_capacity_tonnes).all()
    results = feasibility_service.evaluate_all(vessels, port, payload.quantity_tonnes)
    recommended = feasibility_service.recommended_vessel_code(results)
    return FeasibilityResponse(
        destination_code=port.code, quantity_tonnes=payload.quantity_tonnes,
        results=results, recommended_vessel_code=recommended, data_status=port.data_status,
    )
