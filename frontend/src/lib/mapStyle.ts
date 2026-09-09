import type { StyleSpecification } from "maplibre-gl";

// Configurable map-style/provider layer (per project requirement): if
// NEXT_PUBLIC_MAP_STYLE_URL is set, the map tries that remote vector-tile
// style first (e.g. a MapTiler/OpenFreeMap style.json) for a richer-looking
// basemap. If it's unset, OR the remote style fails to load at runtime
// (offline demo, blocked network, expired key), the map falls back to this
// locally-bundled style, which sources its country polygons from
// /public/data/world-countries.geojson and needs NO network access at all.
// This is what keeps the Global Network map usable even with zero internet
// connectivity during a judge demo.
export const LOCAL_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  name: "freight-intelligence-offline-basemap",
  sources: {
    countries: {
      type: "geojson",
      data: "/data/world-countries.geojson",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#060a10" } },
    {
      id: "countries-fill",
      type: "fill",
      source: "countries",
      paint: { "fill-color": "#101a28", "fill-opacity": 1 },
    },
    {
      id: "countries-outline",
      type: "line",
      source: "countries",
      paint: { "line-color": "#22314a", "line-width": 0.7 },
    },
  ],
};

export function resolveInitialMapStyle(): string | StyleSpecification {
  const remote = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
  if (remote && remote.trim().length > 0) return remote;
  return LOCAL_FALLBACK_STYLE;
}
