# Architecture

## 1. System Architecture

```mermaid
flowchart TB
    subgraph Client["Browser"]
        FE["Next.js Frontend<br/>(App Router, TypeScript, Tailwind)"]
        Map["MapLibre GL<br/>(bundled offline basemap)"]
        Charts["Recharts"]
        FE --- Map
        FE --- Charts
    end

    subgraph Server["FastAPI Backend"]
        API["API Routers<br/>ports / routes / forecast / feasibility / decision / search / status"]
        SVC["Services<br/>forecast · feasibility · risk · cost · optimization · recommendation"]
        ORM["SQLAlchemy Models"]
        API --> SVC
        SVC --> ORM
    end

    subgraph ML["ML Layer"]
        Core["ml_core<br/>features.py + forecaster.py<br/>(shared by train.py AND the API)"]
        Model["freight_model.joblib"]
        Core --> Model
    end

    subgraph DB["Database"]
        PG[("PostgreSQL<br/>(docker compose)")]
        SQ[("SQLite<br/>(local dev)")]
    end

    subgraph Data["Prototype Data"]
        CSV["data/synthetic/*.csv<br/>(deterministic generator, seed=42)"]
    end

    FE <-->|"HTTP/JSON, NEXT_PUBLIC_API_BASE_URL"| API
    SVC -->|"forecast_service imports"| Core
    ORM <-->|"DATABASE_URL"| PG
    ORM <-->|"DATABASE_URL"| SQ
    CSV -->|"app/seed.py"| ORM
    CSV -->|"ml/training/train.py"| Model
```

## 2. Data Flow — one Decision Workspace run

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as POST /api/decision/run
    participant FC as forecast_service
    participant FS as feasibility_service
    participant RS as risk_service
    participant OS as optimization_service
    participant CS as cost_service
    participant RC as recommendation_service
    participant DB as Database

    U->>FE: fills shipment scenario, clicks Run Analysis
    FE->>API: ShipmentScenarioRequest
    API->>FC: get_forecast(origin, cargo, horizon)
    FC-->>API: ForecastOut (rate, trend, confidence, volatility)
    API->>FS: evaluate_all(vessels, port, quantity)
    FS-->>API: per-vessel FEASIBLE/REJECTED + reasons
    API->>RS: assess(forecast, port, feasibility)
    RS-->>API: 4-factor explainable risk
    API->>OS: build_scenarios(...)
    OS->>CS: estimate_cost(...) x4 scenarios
    CS-->>OS: cost breakdowns
    OS-->>API: WhatIfScenario[] + best flagged
    API->>RC: recommend(forecast, risk, what_if, ...)
    RC-->>API: action + numbered explanation
    API->>DB: persist DecisionRun (audit trail)
    API-->>FE: DecisionPipelineResponse
    FE-->>U: renders forecast chart, vessel table, risk panel,<br/>scenario cards, cost bars, explanation
```

## 3. ML Pipeline

```mermaid
flowchart LR
    A["freight_rate_history.csv<br/>(1,248 rows, 6 lanes, 208 weeks)"] --> B["ml_core/features.py<br/>lag 1/2/4/8, rolling mean/std,<br/>calendar features, bunker lag"]
    B --> C{"Chronological split<br/>70% train / 15% val / 15% test"}
    C --> D1["Naive Persistence"]
    C --> D2["Moving Average (4wk)"]
    C --> D3["Linear Regression"]
    C --> D4["Random Forest"]
    D1 & D2 & D3 & D4 --> E["Validation comparison:<br/>eliminate DirAcc <= 50%,<br/>pick lowest MAPE among the rest"]
    E --> F["Refit winner on train+val"]
    F --> G["Evaluate ONCE on untouched test set"]
    G --> H["ml/models/freight_model.joblib<br/>+ ml/evaluation/results.json"]
    H --> I["ml_core/forecaster.py<br/>recursive multi-step serving,<br/>confidence band widens with sqrt(horizon)"]
    I --> J["/api/forecast"]
```

## 4. Decision Engine — AI vs Rules

```mermaid
flowchart TB
    ML["ML PREDICTION<br/>forecast_service -> ml_core.forecaster<br/>(the ONLY .predict() call in the codebase)"]
    BC["BUSINESS CONSTRAINTS<br/>feasibility_service<br/>deterministic draft/LOA/beam/capacity checks"]
    RK["RISK<br/>risk_service<br/>deterministic 4-factor scoring from real inputs"]
    OPT["OPTIMIZATION<br/>optimization_service + cost_service<br/>enumerate & compare 4 scenarios by total expected cost"]
    REC["FINAL RECOMMENDATION<br/>recommendation_service<br/>deterministic decision tree, numbered explanation"]

    ML --> REC
    BC --> REC
    RK --> REC
    OPT --> REC
    BC -.->|"feasible vessel count feeds"| RK
    ML -.->|"confidence/volatility feeds"| RK
    ML -.->|"forecast rate feeds"| OPT
    RK -.->|"risk penalty feeds"| OPT
```

## 5. Database ER Diagram

```mermaid
erDiagram
    PORT {
        string code PK
        string name
        string state
        float draft_limit_m
        float loa_limit_m
        float beam_limit_m
        string congestion
        string risk
        json compatible_classes
        string data_status
    }
    ORIGIN {
        string code PK
        string country
        string name
        json cargoes
        string data_status
    }
    VESSEL_CLASS {
        string code PK
        string name
        float dwt_tonnes
        float draft_m
        float loa_m
        float beam_m
        float cargo_capacity_tonnes
        float typical_daily_hire_usd
    }
    ROUTE {
        string route_id PK
        string origin_code FK
        string destination_code FK
        string cargo_type
        float distance_nm
        float reference_freight_usd_per_tonne
        float indicative_annual_volume_tonnes
        string trend
        string congestion
        string risk
    }
    FREIGHT_RATE_HISTORY {
        int id PK
        date date
        string origin_code FK
        string cargo_type
        float rate_usd_per_tonne
    }
    DECISION_RUN {
        int id PK
        datetime created_at
        string origin_code FK
        string destination_code FK
        string cargo_type
        float quantity_tonnes
        string recommended_action
        string overall_risk
        float total_expected_cost_usd
        json result_json
    }

    ORIGIN ||--o{ ROUTE : "origin_code"
    PORT ||--o{ ROUTE : "destination_code"
    ORIGIN ||--o{ FREIGHT_RATE_HISTORY : "origin_code"
    ORIGIN ||--o{ DECISION_RUN : "origin_code"
    PORT ||--o{ DECISION_RUN : "destination_code"
```

## 6. User Journey

```mermaid
journey
    title Judge Demo Journey
    section Explore
      Open Global Network: 5: User
      Focus India / East Coast: 5: User
      Hover Paradip port: 5: User
    section Select
      Click Australia -> Paradip route: 5: User
      Decision Workspace opens, prefilled: 5: User
    section Decide
      Adjust cargo qty / horizon: 4: User
      Run Analysis: 5: User
      Review forecast + confidence: 5: User
      See Capesize recommended, others rejected: 5: User
      Review 4-factor risk: 4: User
    section Compare
      Open Scenario Simulator: 5: User
      Compare Book Now vs Wait vs Alt Port: 5: User
      See Best Expected Option highlighted: 5: User
    section Conclude
      Read numbered explanation: 5: User
      See final BOOK NOW / WAIT recommendation: 5: User
```

## 7. Map → Decision Workspace Flow

```mermaid
flowchart LR
    A["GlobalNetworkMap.tsx<br/>route click"] --> B["useWorkspaceStore.setDraft()<br/>(Zustand, shared client state)"]
    B --> C["router.push('/decision')"]
    C --> D["ShipmentScenarioForm<br/>reads draft from store, prefilled"]
    D --> E["user adjusts qty/date/horizon<br/>(optional)"]
    E --> F["POST /api/decision/run"]
    F --> G["DecisionPipelineResponse<br/>rendered across all workspace sections"]
```

## Design decision: why the Decision Workspace is one page, not four

The project brief lists `FREIGHT FORECAST`, `CHARTER OPTIMIZER`, `SCENARIO SIMULATOR`, and `RISK CENTER` as separate primary nav items, but its own **"DECISION INTELLIGENCE"** spec describes them as *Section 2 / Section 3 / Section 4* of one dashboard, run from one shipment scenario. Building four separate routes would mean either re-fetching (and re-running the ML forecast) four times per demo, or building a second piece of cross-page state synchronization on top of the one that already connects the map to the workspace — both add real engineering risk for a Sept 10 deadline with no corresponding judge-visible benefit. The Decision Workspace is implemented as **one page with a sticky section sub-nav** (`SectionNav.tsx`) so all section names from the brief are present and independently reachable, backed by exactly one pipeline call. `Risk Center` and `Port Intelligence` are also reachable as their own concepts (Risk Center is a section of the workspace; Port Intelligence is a full separate page, since it doesn't require a run shipment scenario).
