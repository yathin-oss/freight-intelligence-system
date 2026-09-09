"""
Central configuration, entirely driven by environment variables so the
same codebase runs against SQLite (student laptop, zero setup) or
PostgreSQL (docker compose / production-like) without code changes.

Never hardcode secrets here - everything comes from .env / the process
environment, with safe local-dev defaults only.
"""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py -> repo root is 3 parents up
REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "SIH26006 Freight Intelligence API"
    APP_ENV: str = "development"

    # DATABASE_URL controls SQLite vs PostgreSQL. Example values:
    #   sqlite:///./freight.db
    #   postgresql+psycopg2://freight:freight@localhost:5432/freight
    DATABASE_URL: str = f"sqlite:///{REPO_ROOT / 'backend' / 'freight.db'}"

    # Model / data replacement points - swap these two paths to point at a
    # newly trained model / a new dataset and NOTHING else in the codebase
    # needs to change (frontend included).
    ML_MODEL_PATH: str = str(REPO_ROOT / "ml" / "models" / "freight_model.joblib")
    DATA_PATH: str = str(REPO_ROOT / "data" / "synthetic")

    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    DEFAULT_FORECAST_HORIZON_WEEKS: int = 12
    LAYTIME_DAYS: int = 3  # prototype constant: allowed free laytime before demurrage accrues

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
