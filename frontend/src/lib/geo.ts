// Route "geometry" (arcs) is generated on the client purely for visual
// presentation of a straight-line/great-circle-ish path between two real
// coordinates; it is kept separate from the analytical route data (freight,
// risk, volume, congestion) which always comes from the API. See project
// README "Map Data / Routes" - geometry vs analytics are intentionally
// decoupled data sources.

export type LngLat = [number, number];

/** Builds a gently-curved arc (great-circle-ish bulge) between two points as
 * a sequence of [lng, lat] points, suitable for a GeoJSON LineString. Also
 * unwraps longitude across the antimeridian so routes crossing the Pacific
 * (e.g. Australia/Russia -> India) don't get drawn the "wrong way around". */
export function buildArc(from: LngLat, to: LngLat, segments = 64): LngLat[] {
  let [lng1, lat1] = from;
  let [lng2, lat2] = to;

  // choose the shorter path across the antimeridian
  let dLng = lng2 - lng1;
  if (dLng > 180) lng2 -= 360;
  else if (dLng < -180) lng2 += 360;

  const midLng = (lng1 + lng2) / 2;
  const midLat = (lat1 + lat2) / 2;
  const dist = Math.hypot(lng2 - lng1, lat2 - lat1);
  const bulge = Math.min(dist * 0.12, 14); // cap the bulge so short hops don't look silly

  const points: LngLat[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lng = lng1 + (lng2 - lng1) * t;
    const latLinear = lat1 + (lat2 - lat1) * t;
    const arcOffset = Math.sin(Math.PI * t) * bulge;
    const lat = latLinear + arcOffset;
    points.push([((lng + 540) % 360) - 180, lat]);
  }
  return points;
}

export function haversineNm(a: LngLat, b: LngLat): number {
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
