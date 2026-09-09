# Frontend Regeneration Prompt Pack — Lovable & Google Stitch

**Purpose:** regenerate a more visually polished frontend for the SIH26006 platform in Lovable and/or Google Stitch, without breaking its connection to the real, working, already-tested FastAPI backend, and without drifting into the generic "AI dashboard" look judges have seen a hundred times this year.

This is not a from-scratch idea — it is a tightened, bug-fixed, competitor-informed version of the frontend spec you already built and tested. Everything the current app already does correctly is preserved. What changes: six specific weaknesses found by (a) re-auditing the shipped code and (b) studying how real commercial products in this exact space (Veson IMOS, Signal Ocean, Kpler, Vortexa, Windward) solve the same problem.

---

## 0. How to use this document

- Section 1 is the "why" — read it once so you can defend every change to a judge.
- Sections 2–4 are shared ground truth (API contract, geography, design rules) that **both** prompts below are built from. You don't need to paste these separately — they're already folded into Sections 5 and 6.
- Section 5 is a single paste-ready prompt for **Lovable**.
- Section 6 is a **sequence** of paste-ready prompts for **Google Stitch** — Stitch degrades badly if you ask for the whole app in one shot, so it's broken into the order you should run them in.
- Section 7 is the checklist to run against whatever comes out, before it goes anywhere near a judge.

---

## 1. Six specific things we're fixing (know these cold for Q&A)

**1. The shipping lanes on the map currently cross land.** The existing `buildArc()` function draws a straight line in longitude/latitude space with a cosmetic sine bulge — it is not a real geodesic and was never routed around actual coastlines. Plotted against real coordinates: the Australia→India lane cuts directly across inland New South Wales before it reaches open water; the Indonesia→India lane cuts across the Thai/Malay peninsula; the Russia→India lane cuts across southern China; and the USA→India lane draws a straight line across the Atlantic, Iberian Peninsula, and the Middle East. Nobody who has looked at a shipping map would find that credible, and it's the kind of thing that's instantly, visibly wrong the moment someone zooms in. Fix: route each lane through real deep-water waypoints (Torres Strait, Sunda Strait, the Malacca/Singapore Strait, the Suez Canal) — see Section 3 for exact coordinates. This single fix does more for "looks expert-made, not AI-generated" than any color or font choice will.

**2. No Time Charter Equivalent (TCE).** Every real chartering desk tool (Veson IMOS Chartering, Signal Ocean's TCE Calculator) leads with TCE — it's the standard unit charterers actually think in, not raw freight rate or raw cost. We compute enough already (freight rate, distance, voyage days, hire cost) to add it as a genuine derived figure, not a fabricated one: `TCE ($/day) = (freight_revenue − voyage_costs) / voyage_duration_days`. Add it next to the existing cost breakdown.

**3. What-if scenarios are four disconnected cards.** Veson's actual product differentiator is a **side-by-side comparison table** showing the cascading financial effect of each choice in one glance — cards make you scroll and hold four numbers in your head. Keep the cards (they're fine for a quick scan) but add a compact comparison table view as a toggle.

**4. The decision-run audit trail is invisible.** We already persist every run to a real `decision_runs` table with real computed numbers — and the current UI barely surfaces it (one small table at the bottom of the workspace). Every competitor product (Signal Ocean's Fixtures Database, Veson's Contract Management) treats "recent activity" as a first-class panel, not an afterthought. Promote it: a proper "Recent Chartering Activity" panel, styled like a real fixtures feed. This is 100% backed by real data already in our own database — nothing fabricated.

**5. No emissions/carbon cost line.** EU ETS and FuelEU Maritime charges are now a routine line item on real 2026 chartering decisions, and Veson already integrates exactly this. We can add a defensible **ESTIMATED** emissions cost using a real, named methodology: `estimated_fuel_tonnes = (distance_nm / vessel_service_speed_knots / 24) × vessel_class_daily_fuel_burn_tonnes`, then `estimated_co2_tonnes = estimated_fuel_tonnes × 3.114` (the IMO's standard HFO carbon-conversion factor), tagged `ESTIMATED` like everything else. This is a genuine, judge-defensible differentiator almost no other student team will have thought of — but it's optional (see Section 5's priority tiers) if time runs short.

**6. No rate-watch affordance.** Real trading tools (Kpler's price alerts) let a user say "notify me if this lane's rate drops below $X" — it signals the product is meant to be used repeatedly, not just once for a demo. We're not wiring real notifications before Sept 10, but a UI affordance on the forecast chart ("Set a rate alert" → draws a threshold line on the existing chart) costs almost nothing and reads as real product thinking. Must be clearly a client-side visual, not implied to send real alerts, unless you also wire it.

None of the above required inventing new data sources. All six are either (a) a smarter arrangement of data the backend already returns, or (b) a new deterministic formula computed from fields the backend already returns, tagged with the same `ESTIMATED`/`prototype` honesty labels as everything else in the app. That distinction is the whole reason this plan is safe to hand to a code-generation tool: nothing here can drift into fabricating market data.

---

## 2. Non-negotiable rules for both tools

Paste these as-is into whichever tool you use — they are what stops the generated app from becoming a disconnected, better-looking toy that doesn't actually talk to your tested backend.

1. **Do not create a backend, database, or mock API.** A real FastAPI backend already exists and is already tested (45/45 tests passing). The frontend must call it at `NEXT_PUBLIC_API_BASE_URL` (or an equivalent configurable base URL), using the exact endpoint paths, request bodies, and response field names given in Section 3 below — not invented ones.
2. **Never fabricate a number that isn't in an API response.** If a field would be "nice to show" but isn't returned by an endpoint in Section 3, either compute it client-side from fields that ARE returned (and say so, e.g. "TCE, computed client-side from cost + forecast") or omit it. Never hardcode a plausible-looking placeholder value into a component — that's exactly the failure mode this whole project is built to avoid.
3. **Every data value on screen carries a provenance signal.** The backend already returns a `data_status` field (`ESTIMATED`, `SYNTHETIC`, `prototype`, `prototype-fallback`, `unavailable`, `available`, `error`) on nearly every response object. Render it — a small badge, not a wall of text — wherever a panel's data has one. This is a core, load-bearing feature of the product's pitch ("nothing here is silently invented"), not decoration.
4. **Missing data renders as "DATA UNAVAILABLE" or an explicit empty state — never as 0, a blank, or a skipped field.**
5. **The five pages/screens below are the actual information architecture.** Don't invent extra top-level pages (a generic "Settings," a fake "Team," a marketing landing page with pricing tiers, etc.) — this is a working operational tool for one hackathon demo persona (a chartering/procurement desk), not a SaaS product with onboarding funnels.

---

## 3. The real API contract

Base URL: `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:8000` in dev). All endpoints below are prefixed with `/api` except health.

| Method | Path | Request body / query | Response shape |
|---|---|---|---|
| GET | `/api/health` | — | `{status, ...}` — liveness check |
| GET | `/api/ports` | — | `Port[]` |
| GET | `/api/ports/{code}` | — | `Port` |
| GET | `/api/origins` | — | `Origin[]` |
| GET | `/api/vessel-classes` | — | `VesselClass[]` |
| GET | `/api/routes` | query: `origin_code?, destination_code?, cargo_type?, risk?, trend?` | `Route[]` |
| GET | `/api/freight-rate-history` | query: `origin_code, cargo_type, weeks?=52 (max 208)` | `FreightRatePoint[]` |
| POST | `/api/forecast` | `{origin_code, cargo_type, horizon_weeks?=12 (1-26)}` | `ForecastOut` |
| POST | `/api/feasibility` | `{destination_code, cargo_type, quantity_tonnes}` | `FeasibilityResponse` |
| POST | `/api/decision/run` | `ShipmentScenarioRequest` (see below) | `DecisionPipelineResponse` |
| GET | `/api/decision/runs` | query: `limit?=25` | `DecisionRunSummary[]` |
| GET | `/api/decision/runs/{run_id}` | — | `DecisionPipelineResponse` |
| GET | `/api/search` | query: `q` | `SearchResponse` |
| GET | `/api/status` | — | `SystemStatus` |

### Exact TypeScript shapes (mirror these field-for-field — do not rename, do not invent extras)

```ts
type DataStatus = "ESTIMATED" | "SYNTHETIC" | "prototype" | "prototype-fallback" | "unavailable" | "available" | "error";

interface Port {
  code: string; name: string; state: string; lat: number; lon: number;
  port_type: string; draft_limit_m: number | null; loa_limit_m: number | null;
  beam_limit_m: number | null; congestion: "LOW"|"MEDIUM"|"HIGH"; risk: "LOW"|"MEDIUM"|"HIGH";
  compatible_classes: string[]; notes: string; data_status: string;
}

interface Origin {
  code: string; country: string; name: string; lat: number; lon: number;
  cargoes: string[]; data_status: string;
}

interface VesselClass {
  code: string; name: string; dwt_tonnes: number; draft_m: number; loa_m: number;
  beam_m: number; cargo_capacity_tonnes: number; typical_daily_hire_usd: number; data_status: string;
}

interface Route {
  route_id: string; origin_code: string; origin_country: string; origin_name: string;
  destination_code: string; destination_name: string; cargo_type: string; distance_nm: number;
  reference_freight_usd_per_tonne: number; indicative_annual_volume_tonnes: number;
  trend: "increasing"|"decreasing"|"stable"; trend_pct_8wk: number;
  congestion: "LOW"|"MEDIUM"|"HIGH"; risk: "LOW"|"MEDIUM"|"HIGH"; route_status: string; data_status: string;
}

interface ForecastOut {
  origin_code: string; cargo_type: string; current_rate: number; current_rate_date: string;
  forecast: { week_offset: number; date: string; predicted_rate: number; lower: number; upper: number }[];
  trend: "increasing"|"decreasing"|"stable"; trend_pct: number; confidence: number;
  volatility: "low"|"medium"|"high"; model_version: string; data_status: string; method_note: string;
}

interface FeasibilityResponse {
  destination_code: string; quantity_tonnes: number;
  results: {
    vessel_code: string; vessel_class: string; feasible: boolean;
    checks: { label: string; passed: boolean; detail: string }[];
    rejection_reasons: string[]; estimated_freight_cost_usd: number | null; estimated_daily_hire_usd: number;
  }[];
  recommended_vessel_code: string | null; data_status: string;
}

interface RiskAssessmentOut {
  overall: "LOW"|"MEDIUM"|"HIGH";
  factors: { label: string; level: "LOW"|"MEDIUM"|"HIGH"|"UNAVAILABLE"; detail: string }[];
  data_status: string;
}

interface CostBreakdown {
  freight_cost_usd: number; expected_idle_cost_usd: number; expected_demurrage_usd: number;
  deadheading_cost_usd: number; risk_penalty_usd: number; total_expected_cost_usd: number;
  assumptions: string[]; data_status: string;
}

interface ShipmentScenarioRequest {
  origin_code: string; destination_code: string; cargo_type: string; quantity_tonnes: number;
  shipment_date: string; contract_duration_months: number; forecast_horizon_weeks: number; vessel_code?: string | null;
}

interface RecommendationOut {
  action: "BOOK_NOW"|"WAIT"|"BOOK_WITHIN_RANGE"|"MONITOR"; headline: string;
  wait_weeks_min: number | null; wait_weeks_max: number | null;
  explanation: { order: number; statement: string }[]; data_status: string;
}

interface WhatIfScenario {
  scenario_id: string; label: string; description: string; vessel_code: string; vessel_class: string;
  destination_code: string; destination_name: string; wait_weeks: number; feasible: boolean;
  feasibility_reasons: string[]; freight_rate_used: number; cost: CostBreakdown; risk: RiskAssessmentOut; is_best: boolean;
}

interface DecisionPipelineResponse {
  run_id: number | null; shipment: ShipmentScenarioRequest; forecast: ForecastOut;
  feasibility: FeasibilityResponse; risk: RiskAssessmentOut; cost: CostBreakdown;
  recommendation: RecommendationOut; what_if: WhatIfScenario[]; best_scenario_id: string;
  generated_at: string; data_status: string;
}

interface DecisionRunSummary {
  id: number; created_at: string; origin_code: string; destination_code: string; cargo_type: string;
  quantity_tonnes: number; recommended_action: string; overall_risk: string;
  total_expected_cost_usd: number; model_version: string;
}

interface SystemStatus {
  items: { name: string; state: "available"|"prototype"|"not_connected"|"error"; detail: string }[];
  ml_model_version: string; ml_model_ready: boolean; database_url_kind: string; generated_at: string;
}

interface SearchResponse {
  query: string;
  results: { type: "port"|"origin"|"route"|"vessel_class"; code: string; label: string; subtitle: string; action: string }[];
}
```

### Reference data actually seeded (use for building realistic demo states / static previews — not for hardcoding into components)

Origins: Newcastle, Australia (`AUNTL`) · Samarinda/Taboneo Anchorage, Indonesia (`IDSMR`) · Nacala, Mozambique (`MZNAC`) · Vostochny, Russia (`RUVVO`) · Norfolk, United States (`USNFK`).
Destination ports (East Coast India): Paradip (`INPAR`) · Visakhapatnam (`INVTZ`) · Gangavaram (`INGAN`) · Gopalpur (`INGOP`) · Dhamra (`INDHM`) · Sagar-Sandheads (`INSAG`) · Haldia (`INHAL`).
Vessel classes: Handysize (34,000t capacity, ~$9,500/day) · Supramax (56,000t, ~$12,800/day) · Panamax (79,000t, ~$15,600/day) · Capesize (175,000t, ~$22,500/day).
Primary demo scenario: **Newcastle, Australia → Paradip, Coal, 80,000 tonnes, 3-month contract** — this is what should be pre-loadable via a "Demo Mode" action, and it should resolve to Capesize as the only feasible vessel class (the other three are all under-capacity for 80,000t).

---

## 4. Realistic shipping-lane waypoints (fixes finding #1)

Coordinates are `[longitude, latitude]`. Curve smoothly (Catmull-Rom or cubic Bezier through the points, not a straight polyline) from origin → each waypoint in order → the destination port's own coordinates. These are illustrative deep-water routings for visual credibility, not certified navigational data — say so in a tooltip/footnote if asked, same honesty posture as everything else in the app.

```
AUNTL (Newcastle, Australia) [151.78, -32.93] →
  [155.5, -24.0]  // Coral Sea, off the Queensland coast
  [144.5, -10.0]  // Torres Strait corridor
  [120.0, -9.5]   // Timor Sea, well south of the Indonesian archipelago
  [95.0, -6.0]    // open Indian Ocean, south of Sumatra
  → destination port

IDSMR (Samarinda/Taboneo, Indonesia) [117.15, -0.50] →
  [114.0, -4.5]   // Makassar Strait toward the Java Sea
  [105.8, -6.9]   // Sunda Strait, between Java and Sumatra
  [90.0, -3.0]    // open Indian Ocean west of the Sunda Strait
  → destination port

MZNAC (Nacala, Mozambique) [40.68, -14.56] →
  [48.0, -10.0]   // open Indian Ocean, clear of Madagascar's northern tip
  [70.0, 2.0]     // mid Indian Ocean
  → destination port

RUVVO (Vostochny, Russia) [133.08, 42.75] →
  [128.0, 32.0]   // Korea Strait / East China Sea approach
  [118.0, 20.0]   // South China Sea
  [104.0, 4.0]    // Singapore Strait / Strait of Malacca
  [92.0, 8.0]     // Andaman Sea
  → destination port

USNFK (Norfolk, United States) [-76.29, 36.85] →
  [-45.0, 32.0]   // mid North Atlantic
  [-9.5, 35.9]    // Strait of Gibraltar approach
  [14.0, 33.5]    // Mediterranean Sea
  [32.3, 30.5]    // Suez Canal
  [38.0, 20.0]    // Red Sea
  [58.0, 13.0]    // Arabian Sea
  → destination port
```

All seven East Coast India ports sit within roughly `86–88°E, 17–22°N` — the curve's final leg into any of them looks the same regardless of which port is selected.

---

## 5. Anti-"AI slop" design directive (applies to both tools)

The current build already avoided the worst offenders (no glassmorphism, no purple-blue gradient hero, dark enterprise palette). Push further in the same direction — the goal is that it reads like an internal tool built by a shipping company's own dev team, not a generated SaaS template.

**Explicitly avoid:** purple-to-blue or pink-to-orange gradient backgrounds; glassmorphism / frosted-glass cards; heavy drop-shadows or glow effects on buttons and cards; large rounded corners on everything (>8px radius as a default); centered hero sections with vague copy like "The Future of Freight Intelligence"; emoji used as icons; decorative illustrations, blobs, or abstract shapes; a generic icon-in-a-circle stat tile repeated four times identically; animated gradient text; confetti/celebration micro-interactions; stock photography of ships or containers.

**Do instead:** a dense, information-forward layout — real trading/chartering terminals (the ones referenced in Section 1) pack far more data per screen than a typical consumer SaaS dashboard, and that density itself signals "made by people who understand the domain." Sharp or minimally-rounded corners (2–4px) on data containers. Thin 1px borders instead of shadows to separate panels. One accent color used sparingly and purposefully (not on every icon and every border). Tabular numerals / monospace or semi-monospace font for numbers in tables so columns align. Real, specific microcopy tied to the domain ("Cargo capacity 34,000t is below the 80,000t shipment quantity," not "This option isn't available"). Icons only from a single consistent outline icon set (e.g. Lucide, already in use), used sparingly, never as decoration. Motion limited to functional transitions (panel expand/collapse, chart draw-in) — no bouncing, no parallax, no "delightful" flourishes.

**Palette direction:** keep the dark base (near-black to dark slate backgrounds, `#0a0e14`–`#1a2130` range), one desaturated cyan/teal accent for primary actions and the "best option" highlight, and reserve saturated colors (green/amber/red) exclusively for the risk/status semantics (LOW/MEDIUM/HIGH, feasible/rejected) — never for decoration. Text should be a warm-white/off-white, not pure `#fff`, at 85–95% opacity for body text.

**Typography direction:** a real typeface pairing, not the default system-ui stack that every generated app ships with. Suggest something like Inter or IBM Plex Sans for UI text (both read as "designed," neither is the default Tailwind starter font) paired with a tabular-figure numeric style for data tables and stat tiles — IBM Plex Mono or a similar monospace for numbers specifically reads as "financial/maritime terminal," which is exactly the register we want.

---

## 6. LOVABLE — master prompt (paste as-is)

```
Build a maritime freight decision-intelligence web app for a bulk-cargo chartering desk (steel/coal procurement, overseas origins to East Coast India ports). This is a data-dense internal operational tool, not a marketing site or a generic SaaS dashboard — think Bloomberg Terminal or a real shipping/chartering platform (Veson IMOS, Signal Ocean), not a startup landing page.

CRITICAL — DO NOT build a backend, database, or mock API. A real FastAPI backend already exists, is already tested, and this frontend must call it live at a configurable base URL (env var NEXT_PUBLIC_API_BASE_URL, default http://localhost:8000). Every screen below lists the exact endpoint(s) it calls and the exact response fields available — use those field names exactly, do not rename them, do not invent extra fields, and do not hardcode any number that should come from the API. If a `data_status` field is present on a response object, render it as a small badge (ESTIMATED / SYNTHETIC / prototype / unavailable / available / error) — this app's core credibility feature is that nothing is silently fabricated, so this is not optional decoration.

DESIGN DIRECTION: dark theme, near-black background (#0a0e14 to #1a2130 range), one desaturated cyan/teal accent color used only for primary actions and "best option" highlights, saturated green/amber/red reserved exclusively for LOW/MEDIUM/HIGH risk and feasible/rejected states (never decorative). Sharp corners (2-4px radius), thin 1px borders instead of drop-shadows, dense information layout, tabular/monospace numerals in data tables so columns align. Typography: Inter or IBM Plex Sans for UI text, IBM Plex Mono (or similar) for numeric data. Absolutely no purple-to-blue gradients, no glassmorphism, no glowing buttons, no emoji as icons, no decorative illustrations, no vague marketing headlines. Use a single consistent outline icon set (Lucide) sparingly. Microcopy should be specific and domain-accurate (e.g. "Cargo capacity 34,000t is below the 80,000t shipment quantity"), never generic ("This option isn't available").

BUILD FOUR PAGES:

═══ PAGE 1: Global Network (route: /network, default landing page) ═══
An interactive world map (use MapLibre GL JS via react-map-gl or maplibre-gl directly — no Google Maps, no required API key; bundle a simple offline GeoJSON world-countries basemap as a fallback and support an optional NEXT_PUBLIC_MAP_STYLE_URL env var for a live tile provider with automatic fallback to the offline style on load failure).

Data: GET /api/ports (7 East Coast India ports), GET /api/origins (5 overseas origins), GET /api/routes (up to 42 lanes, each with distance_nm, reference_freight_usd_per_tonne, indicative_annual_volume_tonnes, trend, trend_pct_8wk, congestion, risk).

Draw each route as a smooth curved line (Catmull-Rom or cubic bezier) through these real deep-water waypoints — NOT a straight line or simple arc, which cuts across landmasses:

AUNTL (Newcastle, Australia) [151.78,-32.93] → [155.5,-24.0] → [144.5,-10.0] → [120.0,-9.5] → [95.0,-6.0] → destination port
IDSMR (Samarinda, Indonesia) [117.15,-0.50] → [114.0,-4.5] → [105.8,-6.9] → [90.0,-3.0] → destination port
MZNAC (Nacala, Mozambique) [40.68,-14.56] → [48.0,-10.0] → [70.0,2.0] → destination port
RUVVO (Vostochny, Russia) [133.08,42.75] → [128.0,32.0] → [118.0,20.0] → [104.0,4.0] → [92.0,8.0] → destination port
USNFK (Norfolk, USA) [-76.29,36.85] → [-45.0,32.0] → [-9.5,35.9] → [14.0,33.5] → [32.3,30.5] → [38.0,20.0] → [58.0,13.0] → destination port

All 7 India ports sit around 86-88°E, 17-22°N. Line width scales with indicative_annual_volume_tonnes (thin to thick, 1-5px). Line color mode toggles between trend (green=decreasing/low freight, amber=stable, red=increasing/high), risk, and congestion — user picks the mode via three toggle buttons, with a legend that updates to match.

Include: view-switch buttons (World / India / East Coast focus, each flying the camera to a preset), a "Layers & Filters" collapsible panel (toggle port/origin/route/legend layers; filter dropdowns for cargo type, origin, risk, trend), hover tooltips on ports (name, state, draft/LOA/beam limits, congestion, risk, compatible vessel classes, data_status badge) and routes (distance, reference freight rate, 8-week trend, congestion, risk, indicative volume, and a note that live forecast/confidence is computed in the Decision Workspace, not here), a search box in the top nav (GET /api/search?q=, debounced ~200ms, results grouped by type, click navigates to the right page), and stat tiles derived from the fetched data (port count, active lane count, high-risk port count, lanes trending down).

CRITICAL INTERACTION: clicking a route must pre-fill a shared client-side store (origin/destination/cargo) and navigate to /decision — the map is the entry point into the decision workflow, not a decorative visualization. Clicking a port navigates to /ports/{code}.

═══ PAGE 2: Decision Workspace (route: /decision) ═══
One page, sticky section sub-nav (anchor-scroll), sections disabled until a result exists. Reads ?route=CODE or ?demo=1 query params to pre-fill from the map or a "Demo Mode" trigger (the demo scenario is Newcastle,Australia → Paradip → Coal → 80,000 tonnes → 3-month contract → 12-week horizon).

Section 1 — Shipment Scenario: form (origin/destination dropdowns from GET /api/origins + GET /api/routes, cargo type, quantity in tonnes, shipment date, contract duration months, forecast horizon weeks). "Run Analysis" button calls POST /api/decision/run with the full ShipmentScenarioRequest body and renders everything below from the single DecisionPipelineResponse.

Section 2 — Freight Forecast: a composed chart (historical actuals from GET /api/freight-rate-history, joined with response.forecast.forecast[] points) showing historical line → forecast line (visually distinguished, e.g. dashed) with a confidence band (Area between .lower and .upper). Show current_rate, trend + trend_pct, confidence %, volatility, and method_note as supporting stats.

Section 3 — Charter Timing / TCE: the big recommendation action card (BOOK_NOW / WAIT / BOOK_WITHIN_RANGE / MONITOR from response.recommendation, with distinct icon/color per action and the wait_weeks_min/max range when applicable). Add a Time Charter Equivalent stat computed client-side as (cost.total_expected_cost_usd relative to freight revenue) ÷ estimated voyage duration in days — label it clearly as a derived/computed figure, not a raw API field, and show the formula in a tooltip.

Section 4 — Vessel Optimizer: a table of every vessel class from response.feasibility.results — show every candidate (never hide rejected ones), a FEASIBLE/REJECTED badge, the recommended tag, and each check's pass/fail with its literal detail string. Rejection reasons shown in full, not truncated.

Section 5 — Risk Center: overall LOW/MEDIUM/HIGH badge plus the 4 individual risk factor cards from response.risk.factors, each showing its own level and detail explanation.

Section 6 — Scenario Simulator: render response.what_if[] (4 scenarios: Book Now / Wait / Alternative Vessel / Alternative Port) as cards AND as a compact side-by-side comparison table (toggle between the two views) — the table should let a user compare all 4 scenarios' vessel, timing, feasibility, and total cost in one glance without scrolling. Flag the is_best scenario clearly in both views.

Section 7 — Total Expected Cost: a stacked bar breakdown of response.cost's 5 components (freight_cost_usd, expected_idle_cost_usd, expected_demurrage_usd, deadheading_cost_usd, risk_penalty_usd) plus the assumptions[] list rendered underneath as plain readable text.

Section 8 — Why This Recommendation: the numbered response.recommendation.explanation[] list, rendered as an ordered list of real computed statements (not generic text) ending in the headline action, plus a short "AI vs Rules" disclosure noting the forecast comes from a trained model while feasibility/risk/cost/recommendation are deterministic business logic.

Recent Chartering Activity panel (promote this — don't bury it): fetch GET /api/decision/runs?limit=25 and render as a proper activity/fixtures-style feed — route, cargo, quantity, recommended action, risk, total cost, timestamp — styled as a real trading-desk activity log, not an afterthought table.

═══ PAGE 3: Port Intelligence (routes: /ports list, /ports/{code} detail) ═══
List page: card grid from GET /api/ports. Detail page: stat tiles (draft/LOA/beam limits, coordinates), congestion/risk/compatible-vessel-classes panel, and an "Incoming Routes" list (filtered from GET /api/routes by destination_code) where clicking a route pre-fills the shared store and navigates to /decision, same mechanism as the map.

═══ PAGE 4: Data / Model Status (route: /status) ═══
Fetch GET /api/status and render every item's name/state/detail plainly — this is the page a skeptical judge opens when they ask "is this real data?", so it must be complete and honest, not summarized away. Include ml_model_version, ml_model_ready, database_url_kind, generated_at.

Use Next.js 14 App Router, TypeScript, Tailwind CSS, Zustand (or equivalent) for the shared client store connecting map clicks to the Decision Workspace form, Recharts (or equivalent) for the forecast chart and cost breakdown bars. Wrap any component using useSearchParams in a Suspense boundary.
```

---

## 7. GOOGLE STITCH — prompt sequence (run in this order)

Stitch loses coherence if you ask for the whole app at once — the platform's own guidance is to lock a design language on one screen first, then generate the rest against it. Run these five prompts in order, in the same project, so each new screen inherits the visual system from the first.

**Prompt 1 — establish the design language (run first, alone):**
```
Design a dashboard screen for a maritime freight chartering platform used by a bulk-cargo procurement desk — think Bloomberg Terminal or a professional shipping/chartering tool (Veson IMOS, Signal Ocean), not a consumer SaaS product. Platform: web, desktop-width layout.

Visual style: dark theme, near-black background (#0a0e14 to #1a2130 range), one desaturated cyan/teal accent color used only for primary buttons and "best option" highlights. Reserve saturated green/amber/red exclusively for LOW/MEDIUM/HIGH risk badges and feasible/rejected status — never as decoration elsewhere. Sharp corners (2-4px radius, not rounded pill shapes), thin 1px borders between panels instead of drop-shadows or glow effects, dense information layout (real trading terminals pack far more data per screen than typical dashboards — match that density, don't add whitespace padding for its own sake). Typography: a clean geometric sans (Inter-style) for labels and headings, a monospace or tabular-figure numeric style for all data tables and stat numbers so columns align like a spreadsheet. No gradients, no glassmorphism, no glowing buttons, no emoji used as icons, no decorative illustrations or abstract shapes, no vague marketing copy — every label should be a specific, real term a shipping professional would use (e.g. "Draft Limit," "Time Charter Equivalent," "Laytime," not generic dashboard words).

The screen: a top navigation bar with a logo mark ("Freight Intelligence"), 4 nav items (Global Network, Decision Workspace, Port Intelligence, Data/Model), a search input, and a "Demo Mode" button. Below it: 4 compact stat tiles in a row (East Coast Ports: 7, Active Lanes: 42, High-Risk Ports: 2, Lanes Trending Down: 21), each a simple bordered rectangle with a small label and large monospace number — no icons in circles, no gradient backgrounds on the tiles.
```

**Prompt 2 — the map screen (run second, same project):**
```
Using the same dark terminal design language as the previous screen, design the main "Global Network" screen: a full-width world map panel (dark map style, muted landmass fills, no bright default basemap colors) showing curved shipping lane lines connecting 5 overseas origin markers (small blue dots — Australia, Indonesia, Mozambique, Russia, United States) to 7 East Coast India port markers (small teal dots), with line thickness varying to represent trade volume and line color varying by a green/amber/red trend indicator. Include a floating "Layers & Filters" panel (collapsible, top-left) with layer visibility checkboxes and 4 filter dropdowns (Cargo, Origin, Risk, Trend), a small legend panel (bottom-left) explaining the route color coding, and view-switch buttons (World / India / East Coast / Reset) top-right of the map. Show a hover tooltip/popup example on one port marker displaying its name, state, draft/LOA/beam limits, congestion level, risk level, and compatible vessel classes as small pill tags.
```

**Prompt 3 — the decision workspace, top half (run third):**
```
Using the same design language, design the "Decision Workspace" screen, top portion: a shipment scenario input form (Origin dropdown, Destination dropdown, Cargo Type dropdown, Quantity in tonnes number input, Shipment Date picker, Contract Duration in months, Forecast Horizon in weeks, and a prominent "Run Analysis" button in the accent color) at the top. Below it, a sticky horizontal sub-navigation bar with section labels: Shipment Scenario, Freight Forecast, Charter Timing, Vessel Optimizer, Risk Center, Scenario Simulator, Cost, Recommendation. Below that, a freight forecast panel: a line/area chart showing historical freight rate data transitioning into a forecast with a shaded confidence band, plus 4 small stat callouts beside it (Current Rate, Trend, Confidence %, Volatility) and a prominent large recommendation card (icon + colored border matching action type + headline text like "BOOK NOW" + a 1-2 sentence summary).
```

**Prompt 4 — the decision workspace, bottom half (run fourth):**
```
Using the same design language, design the lower portion of the Decision Workspace screen: a "Vessel Optimizer" table listing 4 vessel classes (Handysize, Supramax, Panamax, Capesize) as rows, with columns for each feasibility check (Cargo Capacity, Draft, LOA, Beam, Port Compatibility) shown as small checkmark/x icons, a FEASIBLE (green) or REJECTED (red) badge per row, and a "Recommended" tag on the winning row. Below it, a "Risk Center" panel with one large overall risk badge and 4 smaller factor cards (Freight Volatility, Forecast Uncertainty, Port Congestion, Vessel Availability), each showing a LOW/MEDIUM/HIGH badge and a one-line explanation. Below that, a "Scenario Simulator" section showing 4 comparison cards (Book Now / Wait N Weeks / Alternative Vessel / Alternative Port) side by side, one visually flagged as "Best Expected Option," plus a compact toggle to switch to a table view of the same 4 scenarios. Finally, a "Total Expected Cost" panel with a horizontal stacked bar chart (5 segments: Freight, Idle, Demurrage, Deadheading, Risk Penalty) and a numbered "Why This Recommendation" list below it.
```

**Prompt 5 — port detail and status screens (run fifth):**
```
Using the same design language, design two more screens. First, a "Port Intelligence" detail screen for a single port: a header with the port name and location, 4 stat tiles (Draft Limit, LOA Limit, Beam Limit, Coordinates), a congestion/risk panel with compatible vessel class tags, and a list of "Incoming Routes" (each row showing origin, cargo, distance, freight rate, trend arrow, risk badge). Second, a "Data / Model Status" screen: a clean vertical list of system components (Database, ML Model, Seed Data, API) each with a status icon (available/prototype/not connected/error) and a one-line detail, plus 3 summary stat tiles (Model Version, Model Ready, Database Type) at the top.
```

**After generating:** use Stitch's multi-screen canvas connection feature to wire simple click-through flows between the screens (map route click → decision workspace; port marker click → port detail), export the design (Figma or HTML/CSS), and hand it to a developer (or back into Lovable, or directly into the existing Next.js codebase) to wire up the real API calls per Section 3 — Stitch produces the visual layer only, it does not implement live data fetching or the shared-state click-through logic described in Section 6.

---

## 8. Priority tiers if you're short on time before Sept 10

**Must have (these are what judges will actually poke at):** the fixed shipping-lane waypoints (finding #1 — most visible, easiest to get flagrantly wrong if skipped), the full data contract wired correctly (nothing works if the frontend and backend field names don't match), the honesty/data_status badges preserved everywhere.

**Should have (clear differentiators, moderate effort):** the recent-activity/fixtures panel (finding #4 — pure UI work, data already exists), the scenario comparison table (finding #3 — pure UI work), the TCE stat (finding #2 — one formula).

**Nice to have (real differentiators, but genuinely optional under time pressure):** the emissions/carbon cost estimate (finding #5 — new formula, needs a defensible fuel-burn-per-vessel-class assumption you should be ready to explain), the rate-alert affordance (finding #6 — purely cosmetic unless you also wire it, don't imply it's functional if it isn't).

---

## 9. Post-generation checklist — run this before it goes anywhere near a judge

1. Open the network tab and confirm every screen is actually calling `/api/...` — not rendering hardcoded arrays. This is the #1 way a "polished" regenerated frontend quietly becomes a disconnected mockup.
2. Confirm every response field rendered on screen matches Section 3's contract exactly — a renamed or invented field means either a runtime error or (worse) a silently blank panel.
3. Zoom into the map and manually trace each of the 5 lanes — confirm none of them visibly cross a landmass. This was the headline bug being fixed; verify it's actually fixed, not just prompted for.
4. Run the primary demo scenario (Newcastle → Paradip, Coal, 80,000t) end to end and confirm it still resolves to Capesize as the only feasible vessel, exactly as the tested backend does.
5. Check every `data_status` value that isn't `"available"` actually renders a visible badge — don't let the honesty signal get lost in a redesign.
6. Read the microcopy out loud. If anything sounds like generic AI-generated dashboard copy ("Unlock powerful insights," "Seamless experience") instead of a specific domain statement, rewrite it.
7. Compare a screenshot against the original build's screenshots (already in this repo's QA history) — if the new one looks like a template anyone could have generated for any dashboard, it hasn't hit the brief; it should look like it could only be this product.
