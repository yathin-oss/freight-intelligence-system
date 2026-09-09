from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.decision import ForecastOut, ForecastRequest
from app.services import forecast_service

router = APIRouter()


@router.post("/forecast", response_model=ForecastOut)
def post_forecast(payload: ForecastRequest):
    try:
        return forecast_service.get_forecast(payload.origin_code.upper(), payload.cargo_type, payload.horizon_weeks)
    except forecast_service.ForecastUnavailableError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "message": f"No freight data available for {payload.origin_code}/{payload.cargo_type}.",
                "data_status": "unavailable",
                "reason": exc.message,
            },
        ) from exc
