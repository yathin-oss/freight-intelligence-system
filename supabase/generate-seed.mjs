// Generates supabase/seed.sql deterministically. Re-run with `node
// supabase/generate-seed.mjs > supabase/seed.sql` any time the reference
// data below changes. Kept as a script (rather than hand-written SQL) so the
// historic BDI/rate/vessel-hire series stay reproducible and easy to
// regenerate instead of hand-maintained magic numbers.

function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRandom(key) {
  return mulberry32(hashSeed(key));
}

function haversineNm(a, b) {
  const R_km = 6371;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlmb = ((lon2 - lon1) * Math.PI) / 180;
  const h = Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dlmb / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R_km * c * 0.539957;
}

function sqlStr(v) {
  return `'${String(v).replace(/'/g, "''")}'`;
}
function sqlArr(arr) {
  return `ARRAY[${arr.map(sqlStr).join(",")}]::text[]`;
}
function sqlNum(v) {
  return Number(v.toFixed(4));
}

const ORIGINS = [
  { code: "AUNTL", country: "Australia", name: "Newcastle", lat: -32.93, lon: 151.78, cargoes: ["Coal", "Iron Ore"] },
  { code: "IDSMR", country: "Indonesia", name: "Samarinda", lat: -0.5, lon: 117.15, cargoes: ["Coal"] },
  { code: "MZNAC", country: "Mozambique", name: "Nacala", lat: -14.57, lon: 40.68, cargoes: ["Coal"] },
  { code: "RUVVO", country: "Russia", name: "Vostochny", lat: 42.75, lon: 133.08, cargoes: ["Coal"] },
  { code: "USNFK", country: "United States", name: "Norfolk", lat: 36.85, lon: -76.3, cargoes: ["Coal"] },
];

const PORTS = [
  { code: "INPAR", name: "Paradip", state: "Odisha", lat: 20.31, lon: 86.67, port_type: "Major Port", draft_limit_m: 18.1, loa_limit_m: 300, beam_limit_m: 48, congestion: "MEDIUM", risk: "LOW", compatible_classes: ["HANDYSIZE", "SUPRAMAX", "PANAMAX", "CAPESIZE"], notes: "Deepest East Coast port; primary Capesize-capable berth for dry bulk import." },
  { code: "INVTZ", name: "Visakhapatnam", state: "Andhra Pradesh", lat: 17.68, lon: 83.28, port_type: "Major Port", draft_limit_m: 17.0, loa_limit_m: 280, beam_limit_m: 45, congestion: "MEDIUM", risk: "LOW", compatible_classes: ["HANDYSIZE", "SUPRAMAX", "PANAMAX", "CAPESIZE"], notes: "Natural harbour with dedicated dry-bulk terminal; steady congestion levels." },
  { code: "INGAN", name: "Gangavaram", state: "Andhra Pradesh", lat: 17.62, lon: 83.23, port_type: "Non-Major Port", draft_limit_m: 20.0, loa_limit_m: 320, beam_limit_m: 50, congestion: "LOW", risk: "LOW", compatible_classes: ["HANDYSIZE", "SUPRAMAX", "PANAMAX", "CAPESIZE"], notes: "Deep-draft private port capable of fully-laden Capesize vessels." },
  { code: "INHAL", name: "Haldia", state: "West Bengal", lat: 22.03, lon: 88.06, port_type: "Major Port", draft_limit_m: 8.5, loa_limit_m: 186, beam_limit_m: 28, congestion: "HIGH", risk: "MEDIUM", compatible_classes: ["HANDYSIZE"], notes: "River port with tidal and draft restrictions; frequent congestion." },
  { code: "INENN", name: "Ennore (Kamarajar)", state: "Tamil Nadu", lat: 13.27, lon: 80.33, port_type: "Major Port", draft_limit_m: 16.5, loa_limit_m: 275, beam_limit_m: 43, congestion: "LOW", risk: "MEDIUM", compatible_classes: ["HANDYSIZE", "SUPRAMAX", "PANAMAX"], notes: "Dedicated dry-bulk berths; exposed anchorage during Bay of Bengal cyclone season." },
];

const VESSEL_CLASSES = [
  { code: "HANDYSIZE", name: "Handysize", dwt_tonnes: 35000, draft_m: 10.0, loa_m: 180, beam_m: 30, cargo_capacity_tonnes: 33000, typical_daily_hire_usd: 9000 },
  { code: "SUPRAMAX", name: "Supramax", dwt_tonnes: 58000, draft_m: 12.5, loa_m: 190, beam_m: 32.3, cargo_capacity_tonnes: 55000, typical_daily_hire_usd: 12000 },
  { code: "PANAMAX", name: "Panamax", dwt_tonnes: 82000, draft_m: 14.5, loa_m: 225, beam_m: 32.3, cargo_capacity_tonnes: 78000, typical_daily_hire_usd: 15500 },
  { code: "CAPESIZE", name: "Capesize", dwt_tonnes: 180000, draft_m: 18.0, loa_m: 290, beam_m: 45, cargo_capacity_tonnes: 170000, typical_daily_hire_usd: 22500 },
];

const DISRUPTION_PRESETS = [
  { id: "cyclone-bay-of-bengal", type: "weather", label: "Cyclone Warning - Bay of Bengal", description: "Tropical cyclone approaching East Coast India ports; port operations and inbound transits suspended.", severity: "HIGH", bdi_impact_pct: 14, delay_days: 5, reroute: false },
  { id: "red-sea-security", type: "geopolitical", label: "Red Sea Security Alert", description: "Vessels rerouting around the Cape of Good Hope to avoid the Red Sea corridor, adding transit time and risk premium.", severity: "HIGH", bdi_impact_pct: 22, delay_days: 10, reroute: true },
  { id: "hormuz-tension", type: "geopolitical", label: "Strait of Hormuz Tensions", description: "Elevated geopolitical risk raising war-risk insurance premiums and charter rates on affected lanes.", severity: "MEDIUM", bdi_impact_pct: 11, delay_days: 3, reroute: false },
  { id: "port-congestion-surge", type: "congestion", label: "Port Congestion Surge", description: "Berth congestion and equipment shortages at the destination port causing extended waiting times.", severity: "MEDIUM", bdi_impact_pct: 8, delay_days: 4, reroute: false },
  { id: "canal-draft-restriction", type: "geopolitical", label: "Canal Draft Restrictions", description: "Low water levels forcing draft restrictions and transit slot auctions, spilling over to alternate bulk routes.", severity: "MEDIUM", bdi_impact_pct: 9, delay_days: 6, reroute: true },
];

function routeId(originCode, destinationCode, cargoType) {
  return `${originCode}-${destinationCode}-${cargoType}`.toUpperCase().replace(/\s+/g, "");
}

const lines = [];
lines.push("-- Generated by supabase/generate-seed.mjs — do not hand-edit, re-run the script instead.");
lines.push("begin;");
lines.push("truncate table decision_runs, disruption_events, disruption_presets, vessel_class_rate_history, freight_rate_history, routes, vessel_classes, ports, origins restart identity cascade;");
lines.push("");

// origins
lines.push("insert into origins (code, country, name, lat, lon, cargoes, data_status) values");
lines.push(
  ORIGINS.map(
    (o) => `  (${sqlStr(o.code)}, ${sqlStr(o.country)}, ${sqlStr(o.name)}, ${o.lat}, ${o.lon}, ${sqlArr(o.cargoes)}, 'SYNTHETIC')`
  ).join(",\n") + ";"
);
lines.push("");

// ports
lines.push("insert into ports (code, name, state, lat, lon, port_type, draft_limit_m, loa_limit_m, beam_limit_m, congestion, risk, compatible_classes, notes, data_status) values");
lines.push(
  PORTS.map(
    (p) =>
      `  (${sqlStr(p.code)}, ${sqlStr(p.name)}, ${sqlStr(p.state)}, ${p.lat}, ${p.lon}, ${sqlStr(p.port_type)}, ${p.draft_limit_m}, ${p.loa_limit_m}, ${p.beam_limit_m}, ${sqlStr(p.congestion)}, ${sqlStr(p.risk)}, ${sqlArr(p.compatible_classes)}, ${sqlStr(p.notes)}, 'SYNTHETIC')`
  ).join(",\n") + ";"
);
lines.push("");

// vessel classes
lines.push("insert into vessel_classes (code, name, dwt_tonnes, draft_m, loa_m, beam_m, cargo_capacity_tonnes, typical_daily_hire_usd, data_status) values");
lines.push(
  VESSEL_CLASSES.map(
    (v) =>
      `  (${sqlStr(v.code)}, ${sqlStr(v.name)}, ${v.dwt_tonnes}, ${v.draft_m}, ${v.loa_m}, ${v.beam_m}, ${v.cargo_capacity_tonnes}, ${v.typical_daily_hire_usd}, 'SYNTHETIC')`
  ).join(",\n") + ";"
);
lines.push("");

// disruption presets
lines.push("insert into disruption_presets (id, type, label, description, severity, bdi_impact_pct, delay_days, reroute) values");
lines.push(
  DISRUPTION_PRESETS.map(
    (d) =>
      `  (${sqlStr(d.id)}, ${sqlStr(d.type)}, ${sqlStr(d.label)}, ${sqlStr(d.description)}, ${sqlStr(d.severity)}, ${d.bdi_impact_pct}, ${d.delay_days}, ${d.reroute})`
  ).join(",\n") + ";"
);
lines.push("");

// routes
const routeRows = [];
for (const origin of ORIGINS) {
  for (const port of PORTS) {
    for (const cargoType of origin.cargoes) {
      const id = routeId(origin.code, port.code, cargoType);
      const rng = seededRandom(id);
      const distance_nm = haversineNm([origin.lon, origin.lat], [port.lon, port.lat]);
      const baseRate = 6 + distance_nm / 1000 + rng() * 4;
      const trendRoll = rng();
      const trend = trendRoll < 0.35 ? "increasing" : trendRoll < 0.7 ? "decreasing" : "stable";
      const trend_pct_8wk = trend === "increasing" ? 2 + rng() * 9 : trend === "decreasing" ? -(2 + rng() * 9) : (rng() - 0.5) * 2;
      const risk = rng() < 0.15 ? "HIGH" : port.risk;
      const volume = Math.round((2_000_000 + rng() * 38_000_000) / 100_000) * 100_000;
      routeRows.push(
        `  (${sqlStr(id)}, ${sqlStr(origin.code)}, ${sqlStr(origin.country)}, ${sqlStr(origin.name)}, ${sqlStr(port.code)}, ${sqlStr(port.name)}, ${sqlStr(cargoType)}, ${sqlNum(distance_nm)}, ${sqlNum(baseRate)}, ${volume}, ${sqlStr(trend)}, ${sqlNum(trend_pct_8wk)}, ${sqlStr(port.congestion)}, ${sqlStr(risk)}, 'ACTIVE', 'SYNTHETIC')`
      );
    }
  }
}
lines.push("insert into routes (route_id, origin_code, origin_country, origin_name, destination_code, destination_name, cargo_type, distance_nm, reference_freight_usd_per_tonne, indicative_annual_volume_tonnes, trend, trend_pct_8wk, congestion, risk, route_status, data_status) values");
lines.push(routeRows.join(",\n") + ";");
lines.push("");

// freight rate history: 26 weeks per (origin, cargo), random walk ending near a base rate
const historyRows = [];
const WEEKS = 26;
const today = new Date();
today.setUTCHours(0, 0, 0, 0);
// snap to most recent Monday for tidy weekly dates
const day = today.getUTCDay();
const monday = new Date(today);
monday.setUTCDate(today.getUTCDate() - ((day + 6) % 7));

for (const origin of ORIGINS) {
  for (const cargoType of origin.cargoes) {
    const key = `${origin.code}-${cargoType}-history`;
    const rng = seededRandom(key);
    const baseRate = 8 + rng() * 5;
    let rate = baseRate * (0.85 + rng() * 0.3);
    const path = [];
    for (let w = WEEKS - 1; w >= 0; w--) {
      const drift = (rng() - 0.48) * 0.35;
      rate = Math.max(3, rate + drift + (baseRate - rate) * 0.03);
      path.unshift(rate);
    }
    for (let w = 0; w < WEEKS; w++) {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() - (WEEKS - 1 - w) * 7);
      const iso = date.toISOString().slice(0, 10);
      historyRows.push(`  (${sqlStr(origin.code)}, ${sqlStr(cargoType)}, ${sqlStr(iso)}, ${sqlNum(path[w])})`);
    }
  }
}
lines.push("insert into freight_rate_history (origin_code, cargo_type, date, rate_usd_per_tonne) values");
lines.push(historyRows.join(",\n") + ";");
lines.push("");

// vessel-class historic daily-hire rate ("loads")
const vesselHistoryRows = [];
for (const v of VESSEL_CLASSES) {
  const rng = seededRandom(`${v.code}-history`);
  let rate = v.typical_daily_hire_usd * (0.85 + rng() * 0.3);
  const path = [];
  for (let w = WEEKS - 1; w >= 0; w--) {
    const drift = (rng() - 0.48) * v.typical_daily_hire_usd * 0.03;
    rate = Math.max(1000, rate + drift + (v.typical_daily_hire_usd - rate) * 0.03);
    path.unshift(rate);
  }
  for (let w = 0; w < WEEKS; w++) {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() - (WEEKS - 1 - w) * 7);
    const iso = date.toISOString().slice(0, 10);
    vesselHistoryRows.push(`  (${sqlStr(v.code)}, ${sqlStr(iso)}, ${sqlNum(path[w])})`);
  }
}
lines.push("insert into vessel_class_rate_history (vessel_code, date, daily_hire_usd) values");
lines.push(vesselHistoryRows.join(",\n") + ";");
lines.push("");
lines.push("commit;");

process.stdout.write(lines.join("\n") + "\n");
