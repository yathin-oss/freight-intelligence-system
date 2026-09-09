// Route "geometry" (the line drawn on the map) is generated on the client
// purely for visual presentation of a plausible sailing path between two
// real coordinates; it is kept separate from the analytical route data
// (freight, risk, volume, congestion) which always comes from the API. See
// project README "Map Data / Routes" - geometry vs analytics are
// intentionally decoupled data sources.
//
// v2: routes are no longer a straight lng/lat interpolation with a cosmetic
// bulge (that drew lines straight across Australia, Thailand, southern China
// and the Middle East - a real bug, not a hypothetical one). Each of the 5
// seeded origins now has a short list of real deep-water waypoints (named
// straits/canals/seas a bulk carrier would actually transit) that the line
// is splined through. These are illustrative routing waypoints chosen for
// visual credibility, not certified navigational data - if asked, that's
// the honest answer, consistent with every other ESTIMATED/SYNTHETIC label
// in this app.

export type LngLat = [number, number];

interface LaneRouting {
  waypoints: LngLat[];
  /** Human-readable label for the primary chokepoint this lane transits -
   * reused in the UI (e.g. the Active Scenario banner) as real, disclosed
   * metadata about our own routing choice, not a live navigational feed. */
  chokepoint: string;
}

const LANE_ROUTING: Record<string, LaneRouting> = {
  AUNTL: {
    // Newcastle, Australia -> East Coast India
    waypoints: [
      [155.5, -24.0], // Coral Sea, off the Queensland coast
      [144.5, -10.0], // Torres Strait corridor
      [120.0, -9.5], // Timor Sea, well south of the Indonesian archipelago
      [95.0, -6.0], // open Indian Ocean, south of Sumatra
    ],
    chokepoint: "Torres Strait",
  },
  IDSMR: {
    // Samarinda / Taboneo Anchorage, Indonesia -> East Coast India
    waypoints: [
      [114.0, -4.5], // Makassar Strait toward the Java Sea
      [105.8, -6.9], // Sunda Strait, between Java and Sumatra
      [90.0, -3.0], // open Indian Ocean west of the Sunda Strait
    ],
    chokepoint: "Sunda Strait",
  },
  MZNAC: {
    // Nacala, Mozambique -> East Coast India
    waypoints: [
      [48.0, -10.0], // open Indian Ocean, clear of Madagascar's northern tip
      [70.0, 2.0], // mid Indian Ocean
    ],
    chokepoint: "open Indian Ocean",
  },
  RUVVO: {
    // Vostochny, Russia -> East Coast India
    waypoints: [
      [128.0, 32.0], // Korea Strait / East China Sea approach
      [118.0, 20.0], // South China Sea
      [104.0, 4.0], // Singapore Strait / Strait of Malacca
      [92.0, 8.0], // Andaman Sea
    ],
    chokepoint: "Malacca Strait",
  },
  USNFK: {
    // Norfolk, United States -> East Coast India
    waypoints: [
      [-45.0, 32.0], // mid North Atlantic
      [-9.5, 35.9], // Strait of Gibraltar approach
      [14.0, 33.5], // Mediterranean Sea
      [32.3, 30.5], // Suez Canal
      [38.0, 20.0], // Red Sea
      [58.0, 13.0], // Arabian Sea
    ],
    chokepoint: "Suez Canal",
  },
};

/** Real chokepoint label for an origin's lane into East Coast India, for
 * display in the UI. Returns null for an origin we have no routing entry
 * for (so callers can omit the field rather than show something wrong). */
export function chokepointForOrigin(originCode: string): string | null {
  return LANE_ROUTING[originCode]?.chokepoint ?? null;
}

function catmullRomPoint(p0: LngLat, p1: LngLat, p2: LngLat, p3: LngLat, t: number): LngLat {
  const t2 = t * t;
  const t3 = t2 * t;
  const lng =
    0.5 *
    (2 * p1[0] +
      (-p0[0] + p2[0]) * t +
      (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
      (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
  const lat =
    0.5 *
    (2 * p1[1] +
      (-p0[1] + p2[1]) * t +
      (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
      (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
  return [lng, lat];
}

/** Fallback for an origin with no known waypoints (shouldn't happen for the
 * 5 seeded origins, but keeps a future new origin from drawing nothing or
 * crashing) - a gentle bulge, same idea as the old buildArc, used only as a
 * safety net. */
function fallbackBulge(from: LngLat, to: LngLat, segments = 48): LngLat[] {
  const [lng1, lat1] = from;
  let [lng2, lat2] = to;
  const dLng = lng2 - lng1;
  if (dLng > 180) lng2 -= 360;
  else if (dLng < -180) lng2 += 360;
  const dist = Math.hypot(lng2 - lng1, lat2 - lat1);
  const bulge = Math.min(dist * 0.12, 14);
  const points: LngLat[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lng = lng1 + (lng2 - lng1) * t;
    const lat = lat1 + (lat2 - lat1) * t + Math.sin(Math.PI * t) * bulge;
    points.push([((lng + 540) % 360) - 180, lat]);
  }
  return points;
}

/** Builds a smooth line (Catmull-Rom spline) from an origin, through that
 * lane's real deep-water waypoints, into a destination port - the line a
 * bulk carrier's route would actually resemble, not a straight geodesic
 * that ignores coastlines. `originCode` looks up the lane's waypoint table;
 * an unknown code falls back to a cosmetic bulge rather than breaking. */
export function buildRouteLine(originCode: string, from: LngLat, to: LngLat, segmentsPerLeg = 24): LngLat[] {
  const lane = LANE_ROUTING[originCode];
  if (!lane || lane.waypoints.length === 0) return fallbackBulge(from, to);

  const controlPoints: LngLat[] = [from, ...lane.waypoints, to];
  const n = controlPoints.length;
  const points: LngLat[] = [];

  for (let i = 0; i < n - 1; i++) {
    const p0 = controlPoints[Math.max(0, i - 1)];
    const p1 = controlPoints[i];
    const p2 = controlPoints[i + 1];
    const p3 = controlPoints[Math.min(n - 1, i + 2)];
    for (let s = 0; s < segmentsPerLeg; s++) {
      points.push(catmullRomPoint(p0, p1, p2, p3, s / segmentsPerLeg));
    }
  }
  points.push(controlPoints[n - 1]);
  return points;
}

/** @deprecated kept only so nothing importing the old name breaks during
 * the transition - use buildRouteLine(originCode, from, to) instead, which
 * routes through real waypoints rather than a straight-line bulge. */
export function buildArc(from: LngLat, to: LngLat, segments = 64): LngLat[] {
  return fallbackBulge(from, to, segments);
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

/** ESTIMATED voyage duration in days at a typical laden bulk-carrier service
 * speed. Disclosed assumption, same posture as cost_service.py's formulas -
 * a derived number, not a fabricated one. */
export const ASSUMED_SERVICE_SPEED_KNOTS = 13.5;

export function estimatedVoyageDays(distanceNm: number, speedKnots = ASSUMED_SERVICE_SPEED_KNOTS): number {
  return distanceNm / speedKnots / 24;
}
