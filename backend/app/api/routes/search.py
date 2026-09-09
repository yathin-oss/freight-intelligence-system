from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.status import SearchResponse
from app.services import search_service

router = APIRouter()


@router.get("/search", response_model=SearchResponse)
def search(q: str, db: Session = Depends(get_db)):
    results = search_service.search(db, q)
    return SearchResponse(query=q, results=results)
