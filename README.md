# Freight Intelligence Platform — SIH26006

**Intelligent Freight Forecasting Model for Optimized Vessel Chartering and Bulk Cargo Procurement from Overseas to the East Coast of India.**

Smart India Hackathon 2026 · Problem Statement **SIH26006** · Internal hackathon **September 10, 2026**

A working, end-to-end maritime freight **decision-intelligence** platform — not a dashboard, not a map with lines on it. It combines global freight visualization, ML-based freight forecasting, deterministic vessel↔port feasibility checking, explainable risk assessment, a what-if scenario simulator, total-expected-cost modelling, and a traceable BOOK NOW / WAIT / MONITOR recommendation, wired into one product from the map click to the final answer.

---

## START HERE (shortest possible setup)

You need **either** Docker, **or** Python 3.11+ and Node 20+. Pick one.

### Option A — Docker (recommended, one command)

```bash
docker compose up --build
```

Then open:
- Frontend: <http://localhost:3000>
- Backend API docs: <http://localhost:8000/docs>

The backend seeds its own database and loads the pre-trained model automatically on first boot — nothing else to configure. (First build pulls `python:3.11-slim`, `node:20-slim`, and `postgres:16-alpine` from Docker Hub, so it needs normal outbound internet access to a container registry.)

### Option B — no Docker, one script

```bash
./scripts/dev.sh
```

This creates a Python virtualenv, installs backend deps, seeds SQLite, trains the ML model if no artifact exists yet, and starts both the backend (`:8000`) and frontend (`:3000`) together. `Ctrl+C` stops both.

### Option C — manual, step by step

```bash
# 1. Generate the prototype dataset (already checked into the repo, but you can regenerate it)
python3 data/synthetic/generate_data.py

# 2. Train the forecasting model (already checked into ml/models/, but you can retrain it)
pip install -r backend/requirements.txt      # from repo root
python3 ml/training/train.py

# 3. Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed              # creates + seeds backend/freight.db (SQLite)
uvicorn app.main:app --reload   # http://localhost:8000

# 4. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local
npm run dev                     # http://localhost:3000
```

Then open <http://localhost:3000>, it lands on **Global Network**, and click **Run Demo Scenario: Australia → Paradip**.

---

## 1. Project Overview

SAIL (and similar bulk-cargo importers) charter vessels to bring coal and iron ore from overseas origins to India's East Coast ports. That decision — *which vessel, to which port, chartered now or in three weeks* — depends on freight-rate direction, vessel/port physical compatibility, port congestion, and total landed cost, usually reasoned about separately by different desks. This platform puts all of it into one pipeline and one screen.

## 2. The SIH26006 Problem

> "Development of an Intelligent Freight Forecasting Model for Optimized Vessel Chartering and Bulk Cargo Procurement from overseas to East Coast of India."

The problem statement asks for more than a forecast: it asks for a model whose output is *usable* for a chartering decision — timing, vessel selection, and cost.

## 3. The Solution

A decision pipeline, always run in this order and always shown in this order in the UI:

```
PREDICT → CHECK FEASIBILITY → ASSESS RISK → COMPARE OPTIONS → OPTIMIZE → EXPLAIN → RECOMMEND
```

Concretely: a trained regression model forecasts the freight rate for the selected origin/cargo lane over a configurable horizon → every vessel class is checked against the destination port's actual draft/LOA/beam/capacity constraints (never silently dropped) → a four-factor risk score is computed from the forecast confidence, volatility, port congestion, and vessel availability → four concrete scenarios (Book Now / Wait / Alternative Vessel / Alternative Port) are priced on total expected cost → the cheapest *feasible* scenario, filtered through a risk override rule, becomes a single recommendation with a numbered, traceable explanation.

## 4. Novelty — what is and isn't being claimed

**Not claimed:** that freight forecasting is novel, that AI is novel, that GIS is novel, or that this is globally unprecedented.

**Claimed, and defensible:** the *integration* of forecasting + charter-entry timing + vessel-port feasibility + operational risk + idle/deadheading cost + scenario comparison + total expected cost + an explainable recommendation, in one traceable pipeline, is what most "maritime dashboards" don't do. A forecasting tool says *"freight is likely to decrease."* This system says *"freight is likely to decrease by X%, confidence Y%, this vessel is feasible at this port, congestion risk is Z, waiting two weeks produces a lower expected total cost, therefore: WAIT."* See `docs/JUDGE_QA.md` for the full novelty defense and competitive positioning.

## 5. Architecture

High-level system diagram, data flow, ML pipeline, decision-engine internals, database ER diagram, user journey, and the map→decision handoff are all in **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** (Mermaid diagrams, render on GitHub/most Markdown viewers).

```
frontend (Next.js)  ──HTTP/JSON──▶  backend (FastAPI)  ──▶  SQLAlchemy ──▶  SQLite / PostgreSQL
        │                                  │
        │                                  ├─▶ ml/ml_core (shared feature engineering + forecaster)
        │                                  │        └─▶ ml/models/freight_model.joblib
        │                                  ├─▶ services/feasibility_service (deterministic constraints)
        │                                  ├─▶ services/risk_service (explainable 4-factor risk)
        │                                  ├─▶ services/cost_service (total expected cost)
        │                                  ├─▶ services/optimization_service (what-if scenarios)
        │                                  └─▶ services/recommendation_service (final decision + explanation)
        └─▶ MapLibre GL (bundled offline basemap, no API key)
```

## 6. Technology Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Zustand · Recharts |
| Map / GIS | MapLibre GL JS, no Google Maps, no required API key (see §Map below) |
| Backend | Python · FastAPI · Pydantic v2 · SQLAlchemy 2.0 |
| Database | PostgreSQL (docker compose) / SQLite (local dev) — switched by one `DATABASE_URL` |
| ML | pandas, NumPy, scikit-learn (Linear Regression + Random Forest candidates), joblib |
| Testing | pytest (backend, 45 tests) |
| DevOps | Docker, Docker Compose, `.env` / `.env.example` |

**Why not XGBoost/LSTM/Transformer:** the training pipeline (`ml/training/train.py`) evaluates Naive Persistence, Moving Average, Linear Regression and Random Forest, selects on **validation directional accuracy + MAPE** (not MAPE alone — see §11), and Linear Regression won. A more complex model was not forced in just to look impressive; see the actual comparison table in `ml/evaluation/results.json`.

**Map provider:** the map ships with a **bundled, offline, no-API-key** basemap (`frontend/public/data/world-countries.geojson`, rendered as a MapLibre GeoJSON style) so a judge demo never depends on a live tile server. `NEXT_PUBLIC_MAP_STYLE_URL` can point at a real vector-tile provider (MapTiler, OpenFreeMap, etc.) for a richer look; if that URL is unset or fails to load at runtime, the app **automatically falls back** to the bundled basemap — this fallback was tested by leaving the variable blank, which is the default.

## 7. Folder Structure

```
sih26006-freight-intelligence/
├── frontend/                  Next.js app
│   ├── src/app/                route pages (network, decision, ports, status)
│   ├── src/components/         map/, decision/, ui/
│   ├── src/lib/                api client, zustand store, geo/format helpers
│   └── public/data/            bundled offline basemap GeoJSON
├── backend/                   FastAPI app
│   ├── app/api/routes/         REST endpoints
│   ├── app/services/           feasibility / risk / cost / optimization / recommendation (deterministic)
│   ├── app/models/, schemas/   SQLAlchemy models, Pydantic schemas
│   ├── app/seed.py             loads data/synthetic/*.csv into the DB
│   └── tests/                  45 pytest tests
├── ml/
│   ├── ml_core/                 shared feature engineering + online forecaster (used by train.py AND the API)
│   ├── training/train.py        chronological train/val/test split, candidate comparison, model selection
│   ├── evaluation/evaluate.py   independent re-verification of reported metrics
│   ├── evaluation/results.json  the actual metrics (not hand-picked prose)
│   └── models/freight_model.joblib  the trained artifact
├── data/
│   ├── synthetic/generate_data.py   deterministic (seed=42) prototype data generator
│   └── DATA_DICTIONARY.md           field-by-field provenance for every dataset
├── docs/
│   ├── ARCHITECTURE.md          Mermaid diagrams
│   └── JUDGE_QA.md              novelty, validation, production roadmap, Q&A
├── docker-compose.yml
└── scripts/dev.sh               one-command non-Docker startup
```

## 8. Installation

See **START HERE** above. Dependencies: `backend/requirements.txt`, `frontend/package.json`.

## 9. Environment Variables

See `.env.example` (root, documents everything), `backend/.env.example`, `frontend/.env.example`.

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | `sqlite:///./freight.db` (default) or `postgresql+psycopg2://...` |
| `ML_MODEL_PATH` | backend | path to the trained `.joblib` artifact — swap this to deploy a new model |
| `DATA_PATH` | backend | path to the freight-rate history the online forecaster walks forward from |
| `CORS_ORIGINS` | backend | comma-separated allowed frontend origins |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | backend base URL, e.g. `http://localhost:8000/api` |
| `NEXT_PUBLIC_MAP_STYLE_URL` | frontend | optional external MapLibre style; blank = bundled offline basemap |

No paid API key is required anywhere in this stack.

## 10. Database Setup

Entities: `ports`, `origins`, `vessel_classes`, `routes`, `freight_rate_history` (reference data, seeded from `data/synthetic/*.csv`) and `decision_runs` (every shipment scenario a user actually runs, persisted as an audit trail — this is what backs "Recent Scenario Runs" and proves the app is stateful, not a static calculator).

```bash
cd backend
python -m app.seed        # SQLite: creates + seeds backend/freight.db
```

Switch to PostgreSQL just by setting `DATABASE_URL` (docker compose does this automatically); the same `app.seed` module and SQLAlchemy models work against either backend unchanged.

## 11. ML Setup & Methodology

```bash
python3 ml/training/train.py      # trains, evaluates, saves ml/models/freight_model.joblib
python3 ml/evaluation/evaluate.py  # independently reloads the artifact and re-verifies the metrics
```

**Chronological split (no shuffling):** 208 weekly observations × 6 lanes → 70% train / 15% validation / 15% test, split by calendar date so no lane's future ever leaks into training rows. Lag features (1/2/4/8-week) and rolling stats are computed with `shift(1)` **before** any rolling window, so no row's features can see its own target.

**Candidates evaluated:** Naive Persistence, Moving Average (4wk), Linear Regression, Random Forest.

**Why selection isn't "just pick lowest MAPE":** on this data, Naive Persistence wins on MAPE (freight rates behave close to a random walk week-to-week) but has **~0% directional accuracy** — it always predicts "no change," so it can never signal direction, and the entire product depends on direction (BOOK NOW vs WAIT). The training script explicitly eliminates any candidate at/below a 50% directional-accuracy coin-flip, then picks lowest MAPE among the rest. **Linear Regression** won under this rule.

**Actual reported metrics** (test set, 180 rows, `2026-02-10` → `2026-09-01`, from `ml/evaluation/results.json` — reproducible by re-running `evaluate.py`):

| Model | MAE | RMSE | MAPE | Directional Accuracy |
|---|---|---|---|---|
| Naive Persistence | 0.693 | 1.017 | 3.66% | **0.0%** |
| Moving Average (4wk) | 0.890 | 1.226 | 4.63% | 53.3% |
| **Linear Regression (deployed)** | 0.697 | 1.015 | 3.76% | **61.7%** |
| Random Forest | 0.732 | 1.091 | 3.87% | 61.1% |

**Serving:** `ml/ml_core/forecaster.py` loads the artifact once at API startup and produces a **recursive multi-step forecast** — each future week's prediction feeds back in as if observed, so the confidence band widens with `sqrt(horizon)`, disclosed in the API's `method_note` field. If the model artifact fails to load, the forecaster **automatically falls back** to a transparent moving-average baseline and stamps `data_status="prototype-fallback"` — it never silently serves nothing, and never fabricates a number pretending to be model output.

**Model replacement:** point `ML_MODEL_PATH` / `DATA_PATH` at a new artifact/dataset trained the same way (or a completely different model, as long as it's saved via the same `joblib.dump({...})` artifact shape) — **zero frontend changes required**, since the frontend only ever renders whatever `/api/forecast` returns.

## 12. Data Sources & 13. Prototype-Data Disclosure

**Nothing in this repository is real commercial, SAIL-proprietary, or live-feed data.** Every figure is either:
- `ESTIMATED` — a real entity (a real port, a real vessel-size class) with general-knowledge, non-official-source dimensions, or
- `SYNTHETIC` — no real-world source at all, statistically generated for the ML pipeline to have something realistic to learn from.

Full field-by-field breakdown, including exactly *why* each dataset is synthetic and what the production replacement path looks like: **[`data/DATA_DICTIONARY.md`](data/DATA_DICTIONARY.md)**. The running app also exposes this live at **Data / Model** (`/status`), and every numeric panel in the UI carries a provenance badge (`ESTIMATED` / `SYNTHETIC` / `PROTOTYPE` / `DATA UNAVAILABLE`).

## 14. Running the Application

See **START HERE**. Default landing page is **Global Network** (`/network`). Primary navigation: Global Network → Decision Workspace → Port Intelligence → Data/Model. (The Decision Workspace itself contains the Freight Forecast / Charter Timing / Vessel Optimizer / Risk Center / Scenario Simulator sections as one coherent, section-navigable dashboard — see `docs/ARCHITECTURE.md` for why this is a deliberate simplification of the originally-listed 7-item nav, and why it makes the demo feel like *one product* instead of seven disconnected pages re-fetching the same state.)

## 15. Running Tests

```bash
cd backend
source .venv/bin/activate   # or: pip install -r requirements.txt
pytest                      # 45 tests: feasibility, risk, cost, recommendation, forecast, full API E2E
```

All 45 tests pass as of this handover. Coverage includes: every feasibility edge case (excessive draft/LOA/beam/insufficient capacity/not-on-class-list), risk-factor derivation, cost-component math, the recommendation decision tree (including the risk-override branch), forecast API contract + confidence-band widening + unknown-lane handling, and a full HTTP-level end-to-end test of the mandatory demo path (`tests/test_api_decision.py::test_primary_demo_scenario_end_to_end`).

## 16. API Documentation

Interactive Swagger UI at **`/docs`** once the backend is running (auto-generated from the Pydantic schemas — always in sync with the code, never hand-written and stale). Key endpoints:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/ports`, `/api/ports/{code}` | port reference data |
| GET | `/api/origins`, `/api/vessel-classes`, `/api/routes` | reference data for the map & forms |
| GET | `/api/freight-rate-history` | historical series for the forecast chart |
| POST | `/api/forecast` | ML forecast for one origin/cargo lane |
| POST | `/api/feasibility` | vessel↔port constraint check |
| POST | `/api/decision/run` | **the full pipeline** — forecast → feasibility → risk → cost → what-if → recommendation, persisted |
| GET | `/api/decision/runs`, `/api/decision/runs/{id}` | scenario history |
| GET | `/api/search?q=` | global search (ports/origins/vessel classes/routes) |
| GET | `/api/status` | data/model provenance status (backs the Data/Model page) |

## 17. Limitations

- All port/vessel/route/freight data is prototype (`ESTIMATED`/`SYNTHETIC`) — see §12/13. Nothing here should be used for a real chartering decision.
- No live AIS, no live port congestion telemetry, no licensed freight index — all explicitly flagged `not_connected` on the Data/Model page, never simulated as if live.
- The optimizer is an explicit enumerate-and-compare over 4 meaningful scenarios (Book Now / Wait / Alt Vessel / Alt Port), not a general MILP solver — a deliberate choice for a discrete, small, and explainable decision space (see `docs/JUDGE_QA.md`).
- Docker image builds require normal outbound registry access (`docker.io`) which the authoring sandbox for this handover did not have; the Dockerfiles follow standard, verified patterns and the application logic they package was fully verified via the non-Docker path (`scripts/dev.sh`), but **please run `docker compose up --build` once yourself and report back if anything doesn't come up clean.**
- Frontend is pinned to Next.js 14.2.35 (latest patched 14.x). A handful of `npm audit` advisories remain that require a Next.js 15/16 major upgrade to fully clear (SSRF/cache-poisoning classes relevant to a publicly hosted deployment with untrusted traffic) — not attempted here to avoid destabilizing a working demo two days before judging; tracked in Production Roadmap below.

## 18. Production Roadmap

Explicitly **not implemented**, and not pretended to be:
- Live AIS vessel tracking & ETA prediction
- Live port congestion telemetry (VTMS)
- A licensed freight-rate index (Baltic Exchange / Clarksons) in place of the synthetic series
- SAIL's actual historical charter/procurement data
- ERP/SAP and procurement-system integration
- Automated model retraining and alerting
- OR-Tools/scipy-based continuous optimization (useful once the action space grows past 4 discrete scenarios — e.g. continuous timing, multi-leg routing, multi-vessel portfolios)
- Next.js major-version upgrade to clear all `npm audit` advisories for public deployment

## 19. Demo Instructions

See **[`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)** for the full ~2–3 minute judge walkthrough (Global Network → India focus → Paradip hover → Australia→Paradip route click → forecast → vessel rejection → risk → what-if → recommendation → explanation). **Demo Mode** button (top-right nav, and on the Global Network page) preloads the primary scenario — Australia → Paradip, Coal, 80,000 t — so the demo works reliably even if you want to skip manual map interaction.

## 20. Judge Q&A

See **[`docs/JUDGE_QA.md`](docs/JUDGE_QA.md)** — data provenance, what the ML model actually does, why this isn't "just a dashboard," validation methodology, why a given vessel/port combination is accepted or rejected, what happens when the forecast is wrong, failure handling, production scaling, real-data integration path, target users, and how impact would be measured post-deployment.

---

## AI vs Rules — code-level separation

This separation is structural, not just documentation:

- **ML prediction** — `ml/ml_core/forecaster.py`, served via `backend/app/services/forecast_service.py`. The *only* place a trained model's `.predict()` is called.
- **Business constraints** — `backend/app/services/feasibility_service.py`. Pure arithmetic comparisons (draft/LOA/beam/capacity), zero ML.
- **Risk** — `backend/app/services/risk_service.py`. Deterministic mapping from real inputs (forecast confidence/volatility, port congestion, feasible-vessel count) to LOW/MEDIUM/HIGH, every factor individually explained.
- **Optimization** — `backend/app/services/optimization_service.py`. Explicit scenario enumeration + cost comparison.
- **Final recommendation** — `backend/app/services/recommendation_service.py`. A deterministic decision tree over the outputs of the four modules above, with a numbered, traceable explanation attached to every response.

No UI component computes a forecast, risk score, or recommendation client-side — every number the frontend renders came from one of the five backend modules above, over HTTP, every time.
