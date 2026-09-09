# Data Dictionary — SIH26006 Freight Intelligence Platform

All datasets used by this prototype are produced by
`data/synthetic/generate_data.py` (deterministic, seed=42). **No proprietary
SAIL data, no licensed freight index (Baltic Exchange / Clarksons), and no
live AIS feed is used anywhere in this codebase.** Every record carries a
`data_status` field so the API and UI can render provenance honestly. See
`README.md` → "Prototype Data Disclosure" for the top-level summary.

Two status values are used:

| Status | Meaning |
|---|---|
| `ESTIMATED` | Real-world entity (a real port, a real vessel class) whose descriptive attributes are indicative, general-knowledge figures, not sourced from an official port authority tariff book, NOAA chart, or class-society registry. Order-of-magnitude correct, **not** contract-grade. |
| `SYNTHETIC` | No real-world source at all. Statistically generated (trend + seasonality + AR(1) noise + sparse shocks) so the ML pipeline has a realistic, leakage-testable series to train on. |

---

## `ports.csv`

East Coast India ports relevant to overseas bulk cargo (7 rows).

| Field | Type | Description | Status |
|---|---|---|---|
| `code` | string | Internal UN/LOCODE-style identifier | — |
| `name`, `state` | string | Port name / Indian state | — |
| `lat`, `lon` | float | Approximate port coordinates (public knowledge) | ESTIMATED |
| `port_type` | string | Free-text classification | ESTIMATED |
| `draft_limit_m` | float | Maximum permissible vessel draft (metres) | ESTIMATED |
| `loa_limit_m` | float | Maximum permissible length-overall (metres) | ESTIMATED |
| `beam_limit_m` | float | Maximum permissible beam (metres) | ESTIMATED |
| `congestion` | enum LOW/MEDIUM/HIGH | Prototype congestion classification | ESTIMATED |
| `risk` | enum LOW/MEDIUM/HIGH | Prototype operational-risk classification | ESTIMATED |
| `compatible_classes` | JSON list | Vessel classes that pass this port's constraints (this is *derived*, not asserted — the backend re-checks it numerically at request time) | ESTIMATED |
| `notes` | string | Free text | — |

**Production replacement path:** Indian Ports Association / individual port
trust tariff notifications, IHO ENC charts for draft, VTMS feeds for live
congestion.

## `origins.csv`

Representative overseas load ports (5 rows: Australia, Indonesia,
Mozambique, Russia, United States). Coordinates are ESTIMATED (public
knowledge); `cargoes` lists the commodity lanes modelled for that origin.

## `vessel_classes.csv`

Four standard dry-bulk size classes (Handysize, Supramax, Panamax,
Capesize). `dwt_tonnes`, `draft_m`, `loa_m`, `beam_m`, `cargo_capacity_tonnes`
are **industry-typical envelope figures** (ESTIMATED) — well known generic
shipping-industry classes, not a specific real vessel's certified
particulars. `typical_daily_hire_usd` is an ESTIMATED illustrative charter
rate used only for idle/demurrage-cost prototyping.

**Production replacement path:** IHS Markit / Clarksons fleet register for
a specific nominated vessel's certified particulars.

## `routes.csv`

Cartesian product of origin-cargo lanes × destination ports (42 rows).

| Field | Description | Status |
|---|---|---|
| `distance_nm` | Great-circle distance, **actually computed** via haversine from real lat/lon pairs | Calculated (geometry is real; endpoints are ESTIMATED) |
| `reference_freight_usd_per_tonne` | Latest synthetic lane rate + port handling premium | SYNTHETIC |
| `trend`, `trend_pct_8wk` | 8-week rate-of-change classification from the synthetic history | SYNTHETIC |
| `congestion`, `risk` | Copied from the destination port record | ESTIMATED |
| `indicative_annual_volume_tonnes` | Lane's indicative annual trade volume (SYNTHETIC total per origin-cargo lane, loosely order-of-magnitude informed by these countries' well-known relative export scale) distributed across the 7 destination ports by a port-capacity x inverse-distance weight. Drives the Global Network map's route line-width so width always traces back to a disclosed number, never a decorative random value. | SYNTHETIC |

## `freight_rate_history.csv`

1,248 rows: 6 lanes × 208 weekly observations (4 years). **Fully SYNTHETIC**
— generated as trend + annual seasonality + mean-reverting AR(1) noise +
sparse shock events + a small pass-through from the synthetic bunker index.
This is the table the ML training pipeline (`ml/`) trains and
backtests against. Frequency: weekly. Units: USD / tonne.

**Why synthetic and not real:** commercial freight indices (Baltic Dry
Index sub-panels, specific coal/iron-ore COA rates) are licensed data
products; SAIL's actual contract history is proprietary and was not
supplied for this hackathon. Using a structured synthetic series lets the
forecasting pipeline demonstrate the *correct methodology* (chronological
split, leakage avoidance, baseline-vs-model comparison) on data whose
generating process is fully known, so the reported MAE/RMSE can be
sanity-checked against the true synthetic signal.

## `market_indicators.csv`

234 weekly rows of a synthetic VLSFO bunker-price proxy (`bunker_price_vlsfo_usd_per_tonne`),
used as one exogenous regressor in feature engineering. Fully SYNTHETIC.

---

## Downstream (generated by the backend at seed time, not shipped as CSV)

| Table | Source |
|---|---|
| `shipments`, `scenarios`, `forecasts`, `risk_assessments`, `recommendations` | Written by the running application as users interact with it (SQLAlchemy models in `backend/app/models/`). Never pre-seeded with fabricated outcomes. |

## Explicitly NOT included (future integration only)

- Live AIS vessel positions / ETAs
- Live port congestion telemetry (VTMS)
- Licensed freight-rate index (Baltic Exchange, Clarksons SIN)
- SAIL's actual historical charter/procurement data
- Weather/routing data

These are called out in `README.md` → "Production Roadmap" and in the UI's
**Data / Model Status** panel as `FUTURE INTEGRATION`, never simulated.
