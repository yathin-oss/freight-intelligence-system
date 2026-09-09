from __future__ import annotations

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.reference import Origin, Port, Route, VesselClass
from app.schemas.status import SearchResultItem


def search(db: Session, query: str, limit: int = 20) -> list[SearchResultItem]:
    q = f"%{query.strip()}%"
    results: list[SearchResultItem] = []
    if not query.strip():
        return results

    ports = db.query(Port).filter(or_(Port.name.ilike(q), Port.code.ilike(q), Port.state.ilike(q))).limit(limit).all()
    for p in ports:
        results.append(SearchResultItem(
            type="port", code=p.code, label=f"{p.name} Port", subtitle=f"{p.state}, India",
            action="VIEW_PORT_INTELLIGENCE",
        ))

    origins = db.query(Origin).filter(or_(Origin.name.ilike(q), Origin.country.ilike(q))).limit(limit).all()
    for o in origins:
        results.append(SearchResultItem(
            type="origin", code=o.code, label=o.name, subtitle=o.country, action="FOCUS_MAP_ORIGIN",
        ))

    vessels = db.query(VesselClass).filter(VesselClass.name.ilike(q)).limit(limit).all()
    for v in vessels:
        results.append(SearchResultItem(
            type="vessel_class", code=v.code, label=v.name,
            subtitle=f"{v.dwt_tonnes:,.0f} DWT / {v.cargo_capacity_tonnes:,.0f} t capacity",
            action="VIEW_VESSEL_CLASS",
        ))

    routes = (
        db.query(Route)
        .filter(or_(Route.origin_name.ilike(q), Route.destination_name.ilike(q), Route.cargo_type.ilike(q)))
        .limit(limit)
        .all()
    )
    for r in routes:
        results.append(SearchResultItem(
            type="route", code=r.route_id, label=f"{r.origin_name} -> {r.destination_name}",
            subtitle=f"{r.cargo_type} - {r.trend}", action="OPEN_DECISION_WORKSPACE",
        ))

    return results[:limit]
