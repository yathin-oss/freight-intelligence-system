"""
Feature engineering for the freight-rate forecasting model.

Single source of truth used by BOTH the offline training pipeline
(ml/training/train.py) and the online forecaster (ml/ml_core/forecaster.py,
imported by the FastAPI backend) so that features computed at training time
and at inference time can never silently drift apart.

All lag / rolling features are computed using only information available
strictly BEFORE the target timestamp (shift(1) applied before any rolling
window) to avoid look-ahead leakage.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

LAGS = (1, 2, 4, 8)
ROLL_WINDOWS = (4, 8)

BASE_FEATURE_COLUMNS = (
    [f"lag_{l}" for l in LAGS]
    + [f"roll_mean_{w}" for w in ROLL_WINDOWS]
    + [f"roll_std_{w}" for w in ROLL_WINDOWS]
    + ["month_sin", "month_cos", "weekofyear_sin", "weekofyear_cos", "bunker_lag_1"]
)


def _calendar_features(dates: pd.Series) -> pd.DataFrame:
    dt = pd.to_datetime(dates)
    month = dt.dt.month
    week = dt.dt.isocalendar().week.astype(int)
    return pd.DataFrame(
        {
            "month_sin": np.sin(2 * np.pi * month / 12.0),
            "month_cos": np.cos(2 * np.pi * month / 12.0),
            "weekofyear_sin": np.sin(2 * np.pi * week / 52.0),
            "weekofyear_cos": np.cos(2 * np.pi * week / 52.0),
        },
        index=dates.index,
    )


def build_lane_features(lane_df: pd.DataFrame, bunker_series: pd.Series) -> pd.DataFrame:
    """lane_df: rows for ONE (origin_code, cargo_type) lane, sorted by date ascending,
    columns [date, rate_usd_per_tonne]. bunker_series: Series indexed by date (weekly),
    values = bunker price, used to build a leak-free lag_1 bunker feature aligned by date.
    Returns a feature frame with target column `target` (== rate at t) and BASE_FEATURE_COLUMNS,
    rows without full lag history dropped.
    """
    df = lane_df.reset_index(drop=True).copy()
    df["date"] = pd.to_datetime(df["date"])
    rate = df["rate_usd_per_tonne"]

    for l in LAGS:
        df[f"lag_{l}"] = rate.shift(l)
    for w in ROLL_WINDOWS:
        shifted = rate.shift(1)
        df[f"roll_mean_{w}"] = shifted.rolling(w).mean()
        df[f"roll_std_{w}"] = shifted.rolling(w).std()

    cal = _calendar_features(df["date"])
    df = pd.concat([df, cal], axis=1)

    bunker_aligned = df["date"].map(lambda d: bunker_series.get(d - pd.Timedelta(weeks=1), np.nan))
    df["bunker_lag_1"] = bunker_aligned.values

    df["target"] = rate
    df = df.dropna(subset=list(BASE_FEATURE_COLUMNS) + ["target"]).reset_index(drop=True)
    return df


def build_training_frame(freight_df: pd.DataFrame, market_df: pd.DataFrame) -> pd.DataFrame:
    """freight_df: full freight_rate_history (all lanes). market_df: market_indicators
    (bunker index). Returns concatenated per-lane feature frame with origin_code/cargo_type
    retained as categorical columns (caller one-hot encodes at fit time)."""
    bunker = market_df[market_df["indicator"] == "bunker_price_vlsfo_usd_per_tonne"].copy()
    bunker["date"] = pd.to_datetime(bunker["date"])
    bunker_series = bunker.set_index("date")["value"]

    frames = []
    for (origin, cargo), lane_df in freight_df.groupby(["origin_code", "cargo_type"]):
        lane_df = lane_df.sort_values("date")
        feat = build_lane_features(lane_df[["date", "rate_usd_per_tonne"]], bunker_series)
        feat["origin_code"] = origin
        feat["cargo_type"] = cargo
        frames.append(feat)
    out = pd.concat(frames, ignore_index=True).sort_values("date").reset_index(drop=True)
    return out


def one_hot_lane(df: pd.DataFrame, known_origins: list[str], known_cargoes: list[str]) -> pd.DataFrame:
    """Deterministic one-hot encoding using a FIXED category list (known_origins/known_cargoes)
    so train-time and inference-time encodings always produce identical columns, even if a
    single inference row can't show every category."""
    out = df.copy()
    for o in known_origins:
        out[f"origin_{o}"] = (out["origin_code"] == o).astype(int)
    for c in known_cargoes:
        out[f"cargo_{c}"] = (out["cargo_type"] == c).astype(int)
    return out


def full_feature_columns(known_origins: list[str], known_cargoes: list[str]) -> list[str]:
    return list(BASE_FEATURE_COLUMNS) + [f"origin_{o}" for o in known_origins] + [f"cargo_{c}" for c in known_cargoes]


@dataclass
class VolatilityThresholds:
    low_max_cv: float = 0.045
    medium_max_cv: float = 0.09


def classify_volatility(coefficient_of_variation: float, t: VolatilityThresholds = VolatilityThresholds()) -> str:
    if coefficient_of_variation <= t.low_max_cv:
        return "low"
    if coefficient_of_variation <= t.medium_max_cv:
        return "medium"
    return "high"


def classify_trend(pct_change: float, flat_band: float = 0.015) -> str:
    if pct_change > flat_band:
        return "increasing"
    if pct_change < -flat_band:
        return "decreasing"
    return "stable"
