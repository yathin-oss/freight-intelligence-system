from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import decision, feasibility, forecast, reference, search, status
from app.core.config import settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.reference import Port
from app.seed import seed_if_empty
from app.services.forecast_service import get_forecaster

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("freight-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up - creating tables if needed (DATABASE_URL=%s)", settings.DATABASE_URL.split("://")[0])
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Port).count() == 0:
            logger.info("Database empty - seeding prototype reference data from data/synthetic ...")
            seed_if_empty(db)
        else:
            logger.info("Database already seeded (%d ports found).", db.query(Port).count())
    finally:
        db.close()

    forecaster = get_forecaster()
    if forecaster.model_ready:
        logger.info("ML model loaded: %s (%s)", forecaster.artifact["model_type"], forecaster.artifact["model_version"])
    else:
        logger.warning("ML model NOT loaded (%s) - serving moving-average baseline fallback.", forecaster.load_error)

    yield
    logger.info("Shutting down.")


app = FastAPI(
    title=settings.APP_NAME,
    description="SIH26006 - Intelligent Freight Forecasting & Vessel Chartering Decision Platform (prototype API).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Graceful degradation: never leak a raw 500 traceback to the frontend; always
    # respond with a structured, explicit error the UI can render as "unavailable".
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal error - see server logs.", "data_status": "error", "path": str(request.url.path)},
    )


app.include_router(reference.router, prefix="/api", tags=["reference"])
app.include_router(forecast.router, prefix="/api", tags=["forecast"])
app.include_router(feasibility.router, prefix="/api", tags=["feasibility"])
app.include_router(decision.router, prefix="/api", tags=["decision"])
app.include_router(search.router, prefix="/api", tags=["search"])
app.include_router(status.router, prefix="/api", tags=["status"])


@app.get("/")
def root():
    return {
        "name": settings.APP_NAME,
        "status": "ok",
        "docs": "/docs",
        "problem_statement": "SIH26006",
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}
