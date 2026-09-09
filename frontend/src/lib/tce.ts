// Time Charter Equivalent - the unit a real chartering desk actually thinks
// in (see Veson IMOS / Signal Ocean), computed client-side from fields the
// backend already returns. Never sent to or received from the API - this
// is a disclosed derivation, not a new data source, and is labeled as such
// everywhere it's shown.
//
//   TCE ($/day) = (freight revenue - voyage operating cost) / voyage days
//
// freight revenue for this shipment == cost.freight_cost_usd (the backend
// already computes quantity x freight_rate as that field - it's the same
// number viewed from the vessel-owner's side instead of the charterer's).
// voyage operating cost is approximated as the recommended vessel's daily
// hire rate x the estimated voyage duration (see lib/geo.ts).
export interface TceInput {
  freightCostUsd: number;
  dailyHireUsd: number;
  voyageDays: number;
}

export interface TceResult {
  tceUsdPerDay: number;
  voyageDays: number;
  freightCostUsd: number;
  voyageOperatingCostUsd: number;
}

export function computeTce({ freightCostUsd, dailyHireUsd, voyageDays }: TceInput): TceResult | null {
  if (!voyageDays || voyageDays <= 0) return null;
  const voyageOperatingCostUsd = dailyHireUsd * voyageDays;
  const tceUsdPerDay = (freightCostUsd - voyageOperatingCostUsd) / voyageDays;
  return { tceUsdPerDay, voyageDays, freightCostUsd, voyageOperatingCostUsd };
}
