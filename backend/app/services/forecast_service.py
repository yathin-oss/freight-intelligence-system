"""
Thin service wrapper around ml.ml_core.forecaster.FreightForecaster.

The frontend NEVER computes or hardcodes forecast numbers - it only ever
renders whatever this service (backed by the trained model artifact at
ML_MODEL_PATH) returns via POST /api/forecast. Swapping ML_MODEL_PATH /
DATA_PATH to a newly trained model requires zero frontend changes.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.ml_core.forecaster import FreightForecaster, LaneNotFoundError  # noqa: E402

from app.core.config import settings
from app.schemas.decision import ForecastOut, ForecastPointOut

_forecaster: FreightForecaster | None = None


def get_forecaster() -> FreightForecaster:
    global _forecaster
    if _forecaster is None:
        _forecaster = FreightForecaster(settings.ML_MODEL_PATH, settings.DATA_PATH)
    return _forecaster


class ForecastUnavailableError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def get_forecast(origin_code: str, cargo_type: str, horizon_weeks: int) -> ForecastOut:
    forecaster = get_forecaster()
    try:
        result = forecaster.forecast(origin_code, cargo_type, horizon_weeks)
    except LaneNotFoundError as exc:
        raise ForecastUnavailableError(str(exc)) from exc

    return ForecastOut(
        origin_code=result.origin_code,
        cargo_type=result.cargo_type,
        current_rate=result.current_rate,
        current_rate_date=result.current_rate_date,
        forecast=[ForecastPointOut(**p) for p in result.forecast],
        trend=result.trend,
        trend_pct=result.trend_pct,
        confidence=result.confidence,
        volatility=result.volatility,
        model_version=result.model_version,
        data_status=result.data_status,
        method_note=result.method_note,
    )
