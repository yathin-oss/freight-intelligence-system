"""
Online (recursive multi-step) freight-rate forecaster.

Loaded once by the FastAPI backend at startup (see
backend/app/services/forecast_service.py) using two environment variables:

    ML_MODEL_PATH  - path to the joblib artifact produced by ml/training/train.py
    DATA_PATH      - path to the data/synthetic directory (history the
                      recursive forecast walks forward from)

Recursive multi-step method: to predict week t+1 the model uses lag/rolling
features built from real history; to predict t+2 it reuses its own t+1
prediction as if it were observed (standard recursive forecasting). This is
disclosed as a modelling choice, not hidden - uncertainty is widened with
each step (see `_confidence_for_step`) because recursive forecasts compound
error.

Failure handling (spec requirement - never fabricate silently):
  - If the model artifact cannot be loaded -> falls back automatically to a
    transparent moving-average baseline forecaster and stamps
    `data_status="prototype-fallback"`, `model_version="baseline-fallback"`.
  - If the requested (origin, cargo) lane has no history at all -> raises
    LaneNotFoundError; the API layer turns this into an explicit
    `data_status="unavailable"` response, never an invented number.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

from .features import classify_trend, classify_volatility


class LaneNotFoundError(Exception):
    pass


@dataclass
class ForecastPoint:
    week_offset: int
    date: str
    predicted_rate: float
    lower: float
    upper: float


@dataclass
class ForecastResult:
    origin_code: str
    cargo_type: str
    current_rate: float
    current_rate_date: str
    forecast: list
    trend: str
    trend_pct: float
    confidence: float
    volatility: str
    model_version: str
    data_status: str
    method_note: str


class FreightForecaster:
    def __init__(self, model_path: Optional[str], data_path: Optional[str]):
        self.model_path = Path(model_path) if model_path else None
        self.data_path = Path(data_path) if data_path else None
        self.artifact = None
        self.load_error: Optional[str] = None
        self._freight_df: Optional[pd.DataFrame] = None
        self._bunker_series: Optional[pd.Series] = None

        self._load_data()
        self._load_model()

    # -- loading -----------------------------------------------------
    def _load_data(self):
        if not self.data_path or not self.data_path.exists():
            self.load_error = f"DATA_PATH not found: {self.data_path}"
            return
        freight_csv = self.data_path / "freight_rate_history.csv"
        market_csv = self.data_path / "market_indicators.csv"
        if not freight_csv.exists():
            self.load_error = f"freight_rate_history.csv missing under {self.data_path}"
            return
        self._freight_df = pd.read_csv(freight_csv, parse_dates=["date"])
        if market_csv.exists():
            market_df = pd.read_csv(market_csv, parse_dates=["date"])
            bunker = market_df[market_df["indicator"] == "bunker_price_vlsfo_usd_per_tonne"]
            self._bunker_series = bunker.set_index("date")["value"]
        else:
            self._bunker_series = pd.Series(dtype=float)

    def _load_model(self):
        if not self.model_path or not self.model_path.exists():
            self.load_error = (self.load_error or "") + f" | ML_MODEL_PATH not found: {self.model_path}"
            self.artifact = None
            return
        try:
            self.artifact = joblib.load(self.model_path)
        except Exception as exc:  # noqa: BLE001
            self.load_error = (self.load_error or "") + f" | failed to load model: {exc}"
            self.artifact = None

    @property
    def model_ready(self) -> bool:
        return self.artifact is not None and self._freight_df is not None

    @property
    def data_ready(self) -> bool:
        return self._freight_df is not None

    def known_lanes(self) -> list[tuple[str, str]]:
        if self._freight_df is None:
            return []
        return sorted(set(zip(self._freight_df["origin_code"], self._freight_df["cargo_type"])))

    # -- lane history --------------------------------------------------
    def _lane_history(self, origin_code: str, cargo_type: str) -> pd.DataFrame:
        if self._freight_df is None:
            raise LaneNotFoundError("No freight history loaded.")
        lane = self._freight_df[
            (self._freight_df["origin_code"] == origin_code) & (self._freight_df["cargo_type"] == cargo_type)
        ].sort_values("date")
        if lane.empty:
            raise LaneNotFoundError(f"No freight history for {origin_code}/{cargo_type}")
        return lane.reset_index(drop=True)

    # -- public API ------------------------------------------------------
    def forecast(self, origin_code: str, cargo_type: str, horizon_weeks: int = 8) -> ForecastResult:
        lane = self._lane_history(origin_code, cargo_type)
        current_rate = float(lane["rate_usd_per_tonne"].iloc[-1])
        current_date = pd.to_datetime(lane["date"].iloc[-1])

        recent = lane["rate_usd_per_tonne"].tail(12)
        cv = float(recent.std() / recent.mean()) if recent.mean() else 0.0
        volatility = classify_volatility(cv)

        if self.model_ready:
            points, method_note = self._recursive_ml_forecast(lane, horizon_weeks)
            model_version = self.artifact["model_version"]
            data_status = "prototype"
        else:
            points, method_note = self._moving_average_forecast(lane, horizon_weeks)
            model_version = "baseline-fallback"
            data_status = "prototype-fallback"

        final_rate = points[-1].predicted_rate
        trend_pct = (final_rate - current_rate) / current_rate if current_rate else 0.0
        trend = classify_trend(trend_pct)

        residual_std = self.artifact["residual_std"] if self.model_ready else float(recent.std() or 0.0)
        base_confidence = 1.0 - min(0.45, (residual_std / current_rate if current_rate else 0.3))
        base_confidence = max(0.5, min(0.95, base_confidence))
        horizon_decay = 0.985 ** horizon_weeks
        confidence = round(max(0.45, base_confidence * horizon_decay), 3)

        return ForecastResult(
            origin_code=origin_code,
            cargo_type=cargo_type,
            current_rate=round(current_rate, 3),
            current_rate_date=current_date.date().isoformat(),
            forecast=[p.__dict__ for p in points],
            trend=trend,
            trend_pct=round(trend_pct * 100, 2),
            confidence=confidence,
            volatility=volatility,
            model_version=model_version,
            data_status=data_status,
            method_note=method_note,
        )

    # -- forecasting strategies ------------------------------------------
    def _recursive_ml_forecast(self, lane: pd.DataFrame, horizon_weeks: int):
        art = self.artifact
        model = art["model"]
        feature_cols = art["feature_columns"]
        known_origins = art["known_origins"]
        known_cargoes = art["known_cargoes"]
        origin_code = lane["origin_code"].iloc[0] if "origin_code" in lane.columns else None
        cargo_type = lane["cargo_type"].iloc[0] if "cargo_type" in lane.columns else None

        history = lane[["date", "rate_usd_per_tonne"]].copy()
        residual_std = art["residual_std"]

        points = []
        last_date = pd.to_datetime(history["date"].iloc[-1])
        for step in range(1, horizon_weeks + 1):
            future_date = last_date + pd.Timedelta(weeks=step)
            row = self._build_inference_row(history, future_date, origin_code, cargo_type,
                                             known_origins, known_cargoes)
            X = pd.DataFrame([row[feature_cols].to_dict()])
            pred = float(model.predict(X)[0])
            pred = max(1.0, pred)
            widen = residual_std * math.sqrt(step)
            points.append(ForecastPoint(
                week_offset=step,
                date=future_date.date().isoformat(),
                predicted_rate=round(pred, 3),
                lower=round(max(0.5, pred - 1.28 * widen), 3),
                upper=round(pred + 1.28 * widen, 3),
            ))
            history = pd.concat(
                [history, pd.DataFrame([{"date": future_date, "rate_usd_per_tonne": pred}])],
                ignore_index=True,
            )
        note = (
            f"Recursive {art['model_type']} forecast (model_version={art['model_version']}); "
            "each step reuses the prior step's prediction as input, so the confidence band "
            "widens with sqrt(horizon)."
        )
        return points, note

    def _build_inference_row(self, history, future_date, origin_code, cargo_type, known_origins, known_cargoes):
        from .features import LAGS, ROLL_WINDOWS  # local import to avoid cycle at module import time

        rate = history["rate_usd_per_tonne"]
        row = {}
        for l in LAGS:
            row[f"lag_{l}"] = float(rate.iloc[-l]) if len(rate) >= l else float(rate.iloc[0])
        for w in ROLL_WINDOWS:
            window = rate.tail(w)
            row[f"roll_mean_{w}"] = float(window.mean())
            row[f"roll_std_{w}"] = float(window.std()) if len(window) > 1 else 0.0
        month = future_date.month
        week = future_date.isocalendar()[1]
        row["month_sin"] = math.sin(2 * math.pi * month / 12.0)
        row["month_cos"] = math.cos(2 * math.pi * month / 12.0)
        row["weekofyear_sin"] = math.sin(2 * math.pi * week / 52.0)
        row["weekofyear_cos"] = math.cos(2 * math.pi * week / 52.0)
        bunker_val = np.nan
        if self._bunker_series is not None and len(self._bunker_series) > 0:
            bunker_val = self._bunker_series.iloc[-1]  # future bunker held at last observed level (disclosed)
        row["bunker_lag_1"] = float(bunker_val) if not pd.isna(bunker_val) else float(rate.mean())
        for o in known_origins:
            row[f"origin_{o}"] = 1 if o == origin_code else 0
        for c in known_cargoes:
            row[f"cargo_{c}"] = 1 if c == cargo_type else 0
        return pd.Series(row)

    def _moving_average_forecast(self, lane: pd.DataFrame, horizon_weeks: int):
        rate = lane["rate_usd_per_tonne"]
        ma4 = float(rate.tail(4).mean())
        std = float(rate.tail(8).std() or 0.0)
        last_date = pd.to_datetime(lane["date"].iloc[-1])
        points = []
        for step in range(1, horizon_weeks + 1):
            widen = std * math.sqrt(step)
            points.append(ForecastPoint(
                week_offset=step,
                date=(last_date + pd.Timedelta(weeks=step)).date().isoformat(),
                predicted_rate=round(ma4, 3),
                lower=round(max(0.5, ma4 - 1.28 * widen), 3),
                upper=round(ma4 + 1.28 * widen, 3),
            ))
        note = (
            "ML model artifact unavailable at startup - served by the transparent "
            "moving-average(4wk) BASELINE fallback, not the trained model. "
            f"(reason: {self.load_error})"
        )
        return points, note
