"""
Seeds the database from data/synthetic/*.csv (produced by
data/synthetic/generate_data.py). Idempotent-ish: main.py only calls this
when the `ports` table is empty, and `python -m app.seed` can be run
directly for a manual reseed (drops+recreates all tables first).
"""
from __future__ import annotations

import ast
import json
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.core.config import settings  # noqa: E402
from app.models.reference import FreightRateHistory, Origin, Port, Route, VesselClass  # noqa: E402


def _parse_list(value) -> list:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return ast.literal_eval(value)
    return []


def seed_if_empty(db: Session):
    data_dir = Path(settings.DATA_PATH)

    ports_df = pd.read_csv(data_dir / "ports.csv")
    for _, row in ports_df.iterrows():
        db.add(Port(
            code=row["code"], name=row["name"], state=row["state"], lat=row["lat"], lon=row["lon"],
            port_type=row["port_type"], draft_limit_m=row["draft_limit_m"], loa_limit_m=row["loa_limit_m"],
            beam_limit_m=row["beam_limit_m"], congestion=row["congestion"], risk=row["risk"],
            compatible_classes=_parse_list(row["compatible_classes"]), notes=row.get("notes", ""),
            data_status="ESTIMATED",
        ))

    origins_df = pd.read_csv(data_dir / "origins.csv")
    for _, row in origins_df.iterrows():
        db.add(Origin(
            code=row["code"], country=row["country"], name=row["name"], lat=row["lat"], lon=row["lon"],
            cargoes=_parse_list(row["cargoes"]), data_status="ESTIMATED",
        ))

    vessels_df = pd.read_csv(data_dir / "vessel_classes.csv")
    for _, row in vessels_df.iterrows():
        db.add(VesselClass(
            code=row["code"], name=row["name"], dwt_tonnes=row["dwt_tonnes"], draft_m=row["draft_m"],
            loa_m=row["loa_m"], beam_m=row["beam_m"], cargo_capacity_tonnes=row["cargo_capacity_tonnes"],
            typical_daily_hire_usd=row["typical_daily_hire_usd"], data_status="ESTIMATED",
        ))

    routes_df = pd.read_csv(data_dir / "routes.csv")
    for _, row in routes_df.iterrows():
        db.add(Route(
            route_id=row["route_id"], origin_code=row["origin_code"], origin_country=row["origin_country"],
            origin_name=row["origin_name"], destination_code=row["destination_code"],
            destination_name=row["destination_name"], cargo_type=row["cargo_type"],
            distance_nm=row["distance_nm"], reference_freight_usd_per_tonne=row["reference_freight_usd_per_tonne"],
            indicative_annual_volume_tonnes=row["indicative_annual_volume_tonnes"],
            trend=row["trend"], trend_pct_8wk=row["trend_pct_8wk"], congestion=row["congestion"],
            risk=row["risk"], route_status=row["route_status"], data_status="SYNTHETIC",
        ))

    freight_df = pd.read_csv(data_dir / "freight_rate_history.csv", parse_dates=["date"])
    for _, row in freight_df.iterrows():
        db.add(FreightRateHistory(
            date=row["date"].date(), origin_code=row["origin_code"], cargo_type=row["cargo_type"],
            rate_usd_per_tonne=row["rate_usd_per_tonne"], data_status="SYNTHETIC",
        ))

    db.commit()
    print(
        f"Seeded: {len(ports_df)} ports, {len(origins_df)} origins, {len(vessels_df)} vessel classes, "
        f"{len(routes_df)} routes, {len(freight_df)} freight-rate history rows."
    )


if __name__ == "__main__":
    from app.db.base import Base
    from app.db.session import SessionLocal, engine

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        seed_if_empty(session)
    finally:
        session.close()
