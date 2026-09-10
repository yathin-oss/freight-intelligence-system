import type { StyleSpecification } from "maplibre-gl";

// Configurable map-style/provider layer (per project requirement): if
// NEXT_PUBLIC_MAP_STYLE_URL is set, the map tries that remote vector-tile
// style first (e.g. a MapTiler/OpenFreeMap style.json) for a richer-looking
// basemap. If it's unset, OR the remote style fails to load at runtime
// (offline demo, blocked network, expired key), the map falls back to one of
// these two locally-bundled styles (picked by the current light/dark theme),
// which source their country polygons from /public/data/world-countries.geojson
// and need NO network access at all. This is what keeps the Global Network
// map usable even with zero internet connectivity during a judge demo.
export const LOCAL_FALLBACK_STYLE_DARK: StyleSpecification = {
  version: 8,
  name: "freight-intelligence-offline-basemap-dark",
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

export const LOCAL_FALLBACK_STYLE_LIGHT: StyleSpecification = {
  version: 8,
  name: "freight-intelligence-offline-basemap-light",
  sources: {
    countries: {
      type: "geojson",
      data: "/data/world-countries.geojson",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#eef2f6" } },
    {
      id: "countries-fill",
      type: "fill",
      source: "countries",
      paint: { "fill-color": "#dbe2ea", "fill-opacity": 1 },
    },
    {
      id: "countries-outline",
      type: "line",
      source: "countries",
      paint: { "line-color": "#b9c4d1", "line-width": 0.7 },
    },
  ],
};

export function localFallbackStyle(theme: "dark" | "light"): StyleSpecification {
  return theme === "light" ? LOCAL_FALLBACK_STYLE_LIGHT : LOCAL_FALLBACK_STYLE_DARK;
}

export function resolveInitialMapStyle(theme: "dark" | "light" = "dark"): string | StyleSpecification {
  const remote = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
  if (remote && remote.trim().length > 0) return remote;
  return localFallbackStyle(theme);
}
