from __future__ import annotations

from pydantic import BaseModel


class StatusItem(BaseModel):
    name: str
    state: str  # available | prototype | not_connected | error
    detail: str


class SystemStatus(BaseModel):
    items: list[StatusItem]
    ml_model_version: str
    ml_model_ready: bool
    database_url_kind: str
    generated_at: str


class SearchResultItem(BaseModel):
    type: str  # port | origin | route | vessel_class
    code: str
    label: str
    subtitle: str
    action: str


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]
