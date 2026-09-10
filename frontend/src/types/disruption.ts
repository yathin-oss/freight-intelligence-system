export type DisruptionType = "weather" | "geopolitical" | "congestion";

export interface DisruptionPreset {
  id: string;
  type: DisruptionType;
  label: string;
  description: string;
  severity: "MEDIUM" | "HIGH";
  bdi_impact_pct: number;
  delay_days: number;
  reroute: boolean;
}

export interface DisruptionEvent extends DisruptionPreset {
  instance_id: string;
  route_id: string;
  activated_at: string;
}

// Must stay in sync with the rows inserted by supabase/generate-seed.mjs
// (same ids) - disruption_events.preset_id is a foreign key into
// disruption_presets(id), so activating a preset not present in the seeded
// table will fail at the database.
export const DISRUPTION_PRESETS: DisruptionPreset[] = [
  {
    id: "cyclone-bay-of-bengal",
    type: "weather",
    label: "Cyclone Warning - Bay of Bengal",
    description: "Tropical cyclone approaching East Coast India ports; port operations and inbound transits suspended.",
    severity: "HIGH",
    bdi_impact_pct: 14,
    delay_days: 5,
    reroute: false,
  },
  {
    id: "red-sea-security",
    type: "geopolitical",
    label: "Red Sea Security Alert",
    description: "Vessels rerouting around the Cape of Good Hope to avoid the Red Sea corridor, adding transit time and risk premium.",
    severity: "HIGH",
    bdi_impact_pct: 22,
    delay_days: 10,
    reroute: true,
  },
  {
    id: "hormuz-tension",
    type: "geopolitical",
    label: "Strait of Hormuz Tensions",
    description: "Elevated geopolitical risk raising war-risk insurance premiums and charter rates on affected lanes.",
    severity: "MEDIUM",
    bdi_impact_pct: 11,
    delay_days: 3,
    reroute: false,
  },
  {
    id: "port-congestion-surge",
    type: "congestion",
    label: "Port Congestion Surge",
    description: "Berth congestion and equipment shortages at the destination port causing extended waiting times.",
    severity: "MEDIUM",
    bdi_impact_pct: 8,
    delay_days: 4,
    reroute: false,
  },
  {
    id: "canal-draft-restriction",
    type: "geopolitical",
    label: "Canal Draft Restrictions",
    description: "Low water levels forcing draft restrictions and transit slot auctions, spilling over to alternate bulk routes.",
    severity: "MEDIUM",
    bdi_impact_pct: 9,
    delay_days: 6,
    reroute: true,
  },
];
