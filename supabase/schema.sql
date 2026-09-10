-- Freight Intelligence — schema for the frontend's Supabase-backed data layer.
-- Run this ONCE in the Supabase SQL Editor (Project -> SQL Editor -> New query),
-- then run seed.sql. Field names deliberately mirror frontend/src/types/api.ts
-- so the client can map rows straight onto existing TypeScript types.
--
-- Security note: this is a public hackathon prototype with no user auth, so
-- RLS policies below are intentionally permissive (anon key can read
-- everything, and can write only to the two interactive-demo tables:
-- disruption_events and decision_runs). This is NOT a template for a
-- multi-tenant production app — do not carry these policies forward as-is
-- once real auth exists.

-- ---------------------------------------------------------------------------
-- Reference data (read-only from the client; managed via seed.sql / dashboard)
-- ---------------------------------------------------------------------------

create table if not exists origins (
  code text primary key,
  country text not null,
  name text not null,
  lat double precision not null,
  lon double precision not null,
  cargoes text[] not null,
  data_status text not null default 'SYNTHETIC'
);

create table if not exists ports (
  code text primary key,
  name text not null,
  state text not null,
  lat double precision not null,
  lon double precision not null,
  port_type text not null,
  draft_limit_m numeric,
  loa_limit_m numeric,
  beam_limit_m numeric,
  congestion text not null check (congestion in ('LOW','MEDIUM','HIGH')),
  risk text not null check (risk in ('LOW','MEDIUM','HIGH')),
  compatible_classes text[] not null default '{}',
  notes text default '',
  data_status text not null default 'SYNTHETIC'
);

create table if not exists vessel_classes (
  code text primary key,
  name text not null,
  dwt_tonnes numeric not null,
  draft_m numeric not null,
  loa_m numeric not null,
  beam_m numeric not null,
  cargo_capacity_tonnes numeric not null,
  typical_daily_hire_usd numeric not null,
  data_status text not null default 'SYNTHETIC'
);

create table if not exists routes (
  route_id text primary key,
  origin_code text not null references origins(code) on delete cascade,
  origin_country text not null,
  origin_name text not null,
  destination_code text not null references ports(code) on delete cascade,
  destination_name text not null,
  cargo_type text not null,
  distance_nm numeric not null,
  reference_freight_usd_per_tonne numeric not null,
  indicative_annual_volume_tonnes numeric not null,
  trend text not null check (trend in ('increasing','decreasing','stable')),
  trend_pct_8wk numeric not null default 0,
  congestion text not null check (congestion in ('LOW','MEDIUM','HIGH')),
  risk text not null check (risk in ('LOW','MEDIUM','HIGH')),
  route_status text not null default 'ACTIVE',
  data_status text not null default 'SYNTHETIC'
);

create table if not exists freight_rate_history (
  id bigint generated always as identity primary key,
  origin_code text not null references origins(code) on delete cascade,
  cargo_type text not null,
  date date not null,
  rate_usd_per_tonne numeric not null,
  unique (origin_code, cargo_type, date)
);
create index if not exists idx_freight_rate_history_lookup on freight_rate_history (origin_code, cargo_type, date);

-- Per-vessel-class historic daily-hire rate ("loads") — see implementation_plan.txt Section 1b.
create table if not exists vessel_class_rate_history (
  id bigint generated always as identity primary key,
  vessel_code text not null references vessel_classes(code) on delete cascade,
  date date not null,
  daily_hire_usd numeric not null,
  unique (vessel_code, date)
);
create index if not exists idx_vessel_class_rate_history_lookup on vessel_class_rate_history (vessel_code, date);

-- ---------------------------------------------------------------------------
-- Disruption simulation
-- ---------------------------------------------------------------------------

create table if not exists disruption_presets (
  id text primary key,
  type text not null check (type in ('weather','geopolitical','congestion')),
  label text not null,
  description text not null,
  severity text not null check (severity in ('MEDIUM','HIGH')),
  bdi_impact_pct numeric not null,
  delay_days integer not null,
  reroute boolean not null default false
);

-- Active/instantiated disruptions. One row per (route_id) — activating a new
-- one on a route replaces the old row (see app logic). Realtime-enabled so
-- every open browser tab sees activations/clears live.
create table if not exists disruption_events (
  instance_id uuid primary key default gen_random_uuid(),
  route_id text not null references routes(route_id) on delete cascade,
  preset_id text not null references disruption_presets(id),
  activated_at timestamptz not null default now(),
  unique (route_id)
);

create table if not exists decision_runs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  origin_code text not null,
  destination_code text not null,
  cargo_type text not null,
  quantity_tonnes numeric not null,
  recommended_action text not null,
  overall_risk text not null,
  total_expected_cost_usd numeric not null,
  model_version text not null,
  full_result jsonb not null
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table origins enable row level security;
alter table ports enable row level security;
alter table vessel_classes enable row level security;
alter table routes enable row level security;
alter table freight_rate_history enable row level security;
alter table vessel_class_rate_history enable row level security;
alter table disruption_presets enable row level security;
alter table disruption_events enable row level security;
alter table decision_runs enable row level security;

create policy "public read origins" on origins for select using (true);
create policy "public read ports" on ports for select using (true);
create policy "public read vessel_classes" on vessel_classes for select using (true);
create policy "public read routes" on routes for select using (true);
create policy "public read freight_rate_history" on freight_rate_history for select using (true);
create policy "public read vessel_class_rate_history" on vessel_class_rate_history for select using (true);
create policy "public read disruption_presets" on disruption_presets for select using (true);

create policy "public read disruption_events" on disruption_events for select using (true);
create policy "public insert disruption_events" on disruption_events for insert with check (true);
create policy "public delete disruption_events" on disruption_events for delete using (true);

create policy "public read decision_runs" on decision_runs for select using (true);
create policy "public insert decision_runs" on decision_runs for insert with check (true);

-- Live sync for the disruption simulator across tabs/users.
alter publication supabase_realtime add table disruption_events;
