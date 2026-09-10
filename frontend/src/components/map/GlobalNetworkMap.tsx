"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type LngLatBoundsLike, type Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { AlertTriangle, Locate, Layers as LayersIcon, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { LOCAL_FALLBACK_STYLE, resolveInitialMapStyle } from "@/lib/mapStyle";
import { buildArc } from "@/lib/geo";
import { useWorkspaceStore } from "@/lib/store";
import { useDisruptionStore } from "@/lib/disruptionStore";
import { portPopupHtml, routePopupHtml } from "./popups";
import type { Origin, Port, Route } from "@/types/api";
import type { DisruptionEvent, DisruptionType } from "@/types/disruption";
import { MapFilters, type FilterState, DEFAULT_FILTERS } from "./MapFilters";
import { DisruptionPanel } from "./DisruptionPanel";

const RISK_COLOR = { LOW: "#3dd68c", MEDIUM: "#e8a33d", HIGH: "#e8607a" } as const;
const TREND_COLOR = { increasing: "#e8607a", decreasing: "#3dd68c", stable: "#7a8aa8" } as const;
const DISRUPTION_COLOR: Record<DisruptionType, string> = { weather: "#4c8dff", geopolitical: "#e8607a", congestion: "#e8a33d" };

// A more pronounced, opposite-curving arc used to visualize a rerouted
// disrupted lane distinctly from its normal (blocked) path.
function buildRerouteArc(from: [number, number], to: [number, number], segments = 64): [number, number][] {
  let [lng1, lat1] = from;
  let [lng2, lat2] = to;
  let dLng = lng2 - lng1;
  if (dLng > 180) lng2 -= 360;
  else if (dLng < -180) lng2 += 360;
  const dist = Math.hypot(lng2 - lng1, lat2 - lat1);
  const bulge = Math.min(dist * 0.28, 30);
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lng = lng1 + (lng2 - lng1) * t;
    const latLinear = lat1 + (lat2 - lat1) * t;
    const lat = latLinear - Math.sin(Math.PI * t) * bulge;
    points.push([((lng + 540) % 360) - 180, lat]);
  }
  return points;
}

const VIEWS: Record<string, { center: [number, number]; zoom: number }> = {
  world: { center: [55, 10], zoom: 1.55 },
  india: { center: [82.5, 21], zoom: 4.1 },
  eastcoast: { center: [85.8, 19.8], zoom: 5.6 },
};

function portsGeoJSON(ports: Port[]) {
  return {
    type: "FeatureCollection" as const,
    features: ports.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
      properties: { code: p.code, name: p.name, congestion: p.congestion, risk: p.risk },
    })),
  };
}

function originsGeoJSON(origins: Origin[]) {
  return {
    type: "FeatureCollection" as const,
    features: origins.map((o) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [o.lon, o.lat] },
      properties: { code: o.code, name: o.name, country: o.country },
    })),
  };
}

function routesGeoJSON(routes: Route[], origins: Origin[], ports: Port[], disruptionByRoute: Map<string, DisruptionEvent>) {
  const originByCode = new Map(origins.map((o) => [o.code, o]));
  const portByCode = new Map(ports.map((p) => [p.code, p]));
  const features = routes
    .map((r) => {
      const o = originByCode.get(r.origin_code);
      const p = portByCode.get(r.destination_code);
      if (!o || !p) return null;
      const coords = buildArc([o.lon, o.lat], [p.lon, p.lat]);
      const disruption = disruptionByRoute.get(r.route_id);
      return {
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: coords },
        properties: {
          route_id: r.route_id,
          origin_code: r.origin_code,
          destination_code: r.destination_code,
          cargo_type: r.cargo_type,
          trend: r.trend,
          risk: r.risk,
          congestion: r.congestion,
          volume: r.indicative_annual_volume_tonnes,
          risk_color: RISK_COLOR[r.risk],
          trend_color: TREND_COLOR[r.trend],
          congestion_color: RISK_COLOR[r.congestion],
          disrupted: Boolean(disruption),
          rerouted: Boolean(disruption?.reroute),
          disruption_color: disruption ? DISRUPTION_COLOR[disruption.type] : "#000000",
        },
      };
    })
    .filter(Boolean);
  return { type: "FeatureCollection" as const, features: features as GeoJSON.Feature[] };
}

function rerouteGeoJSON(routes: Route[], origins: Origin[], ports: Port[], disruptionByRoute: Map<string, DisruptionEvent>) {
  const originByCode = new Map(origins.map((o) => [o.code, o]));
  const portByCode = new Map(ports.map((p) => [p.code, p]));
  const features = routes
    .map((r) => {
      const disruption = disruptionByRoute.get(r.route_id);
      if (!disruption?.reroute) return null;
      const o = originByCode.get(r.origin_code);
      const p = portByCode.get(r.destination_code);
      if (!o || !p) return null;
      const coords = buildRerouteArc([o.lon, o.lat], [p.lon, p.lat]);
      return {
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: coords },
        properties: { route_id: r.route_id, disruption_color: DISRUPTION_COLOR[disruption.type] },
      };
    })
    .filter(Boolean);
  return { type: "FeatureCollection" as const, features: features as GeoJSON.Feature[] };
}

export function GlobalNetworkMap() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const disruptionMarkersRef = useRef<maplibregl.Marker[]>([]);

  const [ports, setPorts] = useState<Port[]>([]);
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [usingFallbackStyle, setUsingFallbackStyle] = useState(!process.env.NEXT_PUBLIC_MAP_STYLE_URL);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [colorMode, setColorMode] = useState<"trend" | "risk" | "congestion">("trend");
  const [showLayers, setShowLayers] = useState({ ports: true, origins: true, routes: true });
  const [activeView, setActiveView] = useState<"world" | "india" | "eastcoast">("world");
  const [showLegend, setShowLegend] = useState(true);

  const setDraft = useWorkspaceStore((s) => s.setDraft);
  const { events: disruptionEvents, init: initDisruptions } = useDisruptionStore();
  const disruptionByRoute = new Map(disruptionEvents.map((e) => [e.route_id, e]));

  // ---- data fetch ------------------------------------------------------
  useEffect(() => {
    Promise.all([api.listPorts(), api.listOrigins(), api.listRoutes()])
      .then(([p, o, r]) => {
        setPorts(p);
        setOrigins(o);
        setRoutes(r);
      })
      .catch((err) => setLoadError(err.message || "Failed to load map data from the API."));
    initDisruptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showPopup(lngLat: maplibregl.LngLatLike, html: string) {
    const map = mapRef.current;
    if (!map) return;
    if (!popupRef.current) {
      popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "320px", offset: 14 });
    }
    popupRef.current.setLngLat(lngLat).setHTML(html).addTo(map);
  }
  function hidePopup() {
    popupRef.current?.remove();
  }

  // ---- map init ----------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveInitialMapStyle(),
      center: VIEWS.world.center,
      zoom: VIEWS.world.zoom,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    map.on("error", (e) => {
      // remote style/tile failure -> fall back to the bundled offline basemap so the
      // analytical map (ports/routes) never becomes unusable because of a network blip.
      const isStyleFailure = !mapRef.current?.isStyleLoaded();
      if (isStyleFailure && !usingFallbackStyle) {
        console.warn("Map style failed to load, falling back to bundled offline basemap.", e.error);
        setUsingFallbackStyle(true);
        map.setStyle(LOCAL_FALLBACK_STYLE);
      }
    });

    map.on("load", () => setMapReady(true));

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- (re)build data layers whenever data or style changes ----------------
  const buildLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || ports.length === 0) return;

    const addOrUpdateSource = (id: string, data: GeoJSON.FeatureCollection) => {
      const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(data as any);
      else map.addSource(id, { type: "geojson", data: data as any });
    };

    addOrUpdateSource("routes-src", routesGeoJSON(routes, origins, ports, disruptionByRoute) as any);
    addOrUpdateSource("routes-reroute-src", rerouteGeoJSON(routes, origins, ports, disruptionByRoute) as any);
    addOrUpdateSource("ports-src", portsGeoJSON(ports) as any);
    addOrUpdateSource("origins-src", originsGeoJSON(origins) as any);

    if (!map.getLayer("routes-line")) {
      map.addLayer({
        id: "routes-line",
        type: "line",
        source: "routes-src",
        paint: {
          "line-color": ["get", "trend_color"],
          "line-width": ["interpolate", ["linear"], ["get", "volume"], 0, 1, 40_000_000, 5],
          "line-opacity": ["case", ["==", ["get", "disrupted"], true], ["case", ["==", ["get", "rerouted"], true], 0.25, 0.45], 0.75],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: "routes-hit",
        type: "line",
        source: "routes-src",
        paint: { "line-color": "#000", "line-width": 14, "line-opacity": 0 },
      });
    }

    if (!map.getLayer("routes-disrupted-overlay")) {
      map.addLayer({
        id: "routes-disrupted-overlay",
        type: "line",
        source: "routes-src",
        filter: ["==", ["get", "disrupted"], true],
        paint: {
          "line-color": ["get", "disruption_color"],
          "line-width": 3,
          "line-dasharray": [1.5, 1.5],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }

    if (!map.getLayer("routes-reroute-line")) {
      map.addLayer({
        id: "routes-reroute-line",
        type: "line",
        source: "routes-reroute-src",
        paint: {
          "line-color": ["get", "disruption_color"],
          "line-width": 2.5,
          "line-dasharray": [3, 2],
          "line-opacity": 0.85,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }

    if (!map.getLayer("origins-circle")) {
      map.addLayer({
        id: "origins-halo",
        type: "circle",
        source: "origins-src",
        paint: { "circle-radius": 11, "circle-color": "#4c8dff", "circle-opacity": 0.15 },
      });
      map.addLayer({
        id: "origins-circle",
        type: "circle",
        source: "origins-src",
        paint: {
          "circle-radius": 5,
          "circle-color": "#4c8dff",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#0a0e14",
        },
      });
    }

    if (!map.getLayer("ports-circle")) {
      map.addLayer({
        id: "ports-halo",
        type: "circle",
        source: "ports-src",
        paint: {
          "circle-radius": 13,
          "circle-color": ["match", ["get", "congestion"], "LOW", RISK_COLOR.LOW, "MEDIUM", RISK_COLOR.MEDIUM, "HIGH", RISK_COLOR.HIGH, "#7a8aa8"],
          "circle-opacity": 0.18,
        },
      });
      map.addLayer({
        id: "ports-circle",
        type: "circle",
        source: "ports-src",
        paint: {
          "circle-radius": 6.5,
          "circle-color": "#3dd6c8",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0a0e14",
        },
      });
    }
  }, [ports, origins, routes, disruptionEvents]);

  useEffect(() => {
    if (mapReady) buildLayers();
  }, [mapReady, buildLayers, usingFallbackStyle]);

  // re-add layers if style was swapped (fallback) after they existed once
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = () => buildLayers();
    map.on("styledata", handler);
    return () => {
      map.off("styledata", handler);
    };
  }, [buildLayers]);

  // ---- route color mode ---------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("routes-line")) return;
    const prop = colorMode === "trend" ? "trend_color" : colorMode === "risk" ? "risk_color" : "congestion_color";
    map.setPaintProperty("routes-line", "line-color", ["get", prop]);
  }, [colorMode, mapReady]);

  // ---- layer visibility toggles --------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const vis = (v: boolean) => (v ? "visible" : "none");
    for (const id of ["ports-circle", "ports-halo"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis(showLayers.ports));
    }
    for (const id of ["origins-circle", "origins-halo"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis(showLayers.origins));
    }
    for (const id of ["routes-line", "routes-hit"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis(showLayers.routes));
    }
  }, [showLayers, mapReady]);

  // ---- filters -> maplibre filter expression on routes ---------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("routes-line")) return;
    const clauses: any[] = ["all"];
    if (filters.cargoType) clauses.push(["==", ["get", "cargo_type"], filters.cargoType]);
    if (filters.originCode) clauses.push(["==", ["get", "origin_code"], filters.originCode]);
    if (filters.risk) clauses.push(["==", ["get", "risk"], filters.risk]);
    if (filters.trend) clauses.push(["==", ["get", "trend"], filters.trend]);
    map.setFilter("routes-line", clauses.length > 1 ? (clauses as any) : null);
    map.setFilter("routes-hit", clauses.length > 1 ? (clauses as any) : null);
  }, [filters, mapReady]);

  // ---- interactions: hover + click -----------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const portByCode = new Map(ports.map((p) => [p.code, p]));
    const routeByCode = new Map(routes.map((r) => [r.route_id, r]));

    function onPortEnter(e: maplibregl.MapLayerMouseEvent) {
      map!.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      if (!f) return;
      const port = portByCode.get(f.properties?.code);
      if (port) showPopup(e.lngLat, portPopupHtml(port));
    }
    function onPortLeave() {
      map!.getCanvas().style.cursor = "";
      hidePopup();
    }
    function onPortClick(e: maplibregl.MapLayerMouseEvent) {
      const code = e.features?.[0]?.properties?.code;
      if (code) router.push(`/ports/${code}`);
    }

    function onRouteEnter(e: maplibregl.MapLayerMouseEvent) {
      map!.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      if (!f) return;
      const route = routeByCode.get(f.properties?.route_id);
      if (route) showPopup(e.lngLat, routePopupHtml(route, disruptionByRoute.get(route.route_id)));
    }
    function onRouteLeave() {
      map!.getCanvas().style.cursor = "";
      hidePopup();
    }
    function onRouteClick(e: maplibregl.MapLayerMouseEvent) {
      const routeId = e.features?.[0]?.properties?.route_id;
      const route = routeByCode.get(routeId);
      if (!route) return;
      setDraft({
        originCode: route.origin_code,
        destinationCode: route.destination_code,
        cargoType: route.cargo_type,
      });
      router.push("/decision");
    }

    map.on("mouseenter", "ports-circle", onPortEnter);
    map.on("mouseleave", "ports-circle", onPortLeave);
    map.on("click", "ports-circle", onPortClick);
    map.on("mouseenter", "routes-hit", onRouteEnter);
    map.on("mouseleave", "routes-hit", onRouteLeave);
    map.on("click", "routes-hit", onRouteClick);

    return () => {
      map.off("mouseenter", "ports-circle", onPortEnter);
      map.off("mouseleave", "ports-circle", onPortLeave);
      map.off("click", "ports-circle", onPortClick);
      map.off("mouseenter", "routes-hit", onRouteEnter);
      map.off("mouseleave", "routes-hit", onRouteLeave);
      map.off("click", "routes-hit", onRouteClick);
    };
  }, [mapReady, ports, routes, router, setDraft, disruptionByRoute]);

  // ---- disruption warning markers ------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    disruptionMarkersRef.current.forEach((m) => m.remove());
    disruptionMarkersRef.current = [];

    const originByCode = new Map(origins.map((o) => [o.code, o]));
    const portByCode = new Map(ports.map((p) => [p.code, p]));

    for (const event of disruptionEvents) {
      const route = routes.find((r) => r.route_id === event.route_id);
      const o = route && originByCode.get(route.origin_code);
      const p = route && portByCode.get(route.destination_code);
      if (!route || !o || !p) continue;

      const arc = buildArc([o.lon, o.lat], [p.lon, p.lat]);
      const mid = arc[Math.floor(arc.length / 2)];
      const color = DISRUPTION_COLOR[event.type];

      const el = document.createElement("div");
      el.style.cssText = `width:22px;height:22px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:12px;background:${color};box-shadow:0 0 0 5px ${color}33;cursor:pointer;`;
      el.textContent = "⚠";
      el.addEventListener("mouseenter", () => showPopup(mid as [number, number], routePopupHtml(route, event)));
      el.addEventListener("mouseleave", hidePopup);
      el.addEventListener("click", () => {
        setDraft({ originCode: route.origin_code, destinationCode: route.destination_code, cargoType: route.cargo_type });
        router.push("/decision");
      });

      const marker = new maplibregl.Marker({ element: el }).setLngLat(mid as [number, number]).addTo(map);
      disruptionMarkersRef.current.push(marker);
    }

    return () => {
      disruptionMarkersRef.current.forEach((m) => m.remove());
      disruptionMarkersRef.current = [];
    };
  }, [mapReady, disruptionEvents, routes, origins, ports, router, setDraft]);

  // popup click delegation ("View Port Intelligence" button inside popup HTML)
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const btn = target.closest("[data-action='view-port']") as HTMLElement | null;
      if (btn) {
        const code = btn.getAttribute("data-code");
        if (code) router.push(`/ports/${code}`);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [router]);

  function flyTo(view: "world" | "india" | "eastcoast") {
    setActiveView(view);
    mapRef.current?.flyTo({ ...VIEWS[view], duration: 900 });
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-white/[0.06]">
      <div ref={containerRef} className="h-full w-full" />

      {loadError && (
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-accent-rose/15 px-4 py-2 text-xs text-accent-rose">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {loadError} - is the backend running at the configured API URL?
        </div>
      )}

      {usingFallbackStyle && (
        <div className="absolute left-4 top-4 z-10 rounded-md border border-accent-amber/30 bg-base-900/90 px-2.5 py-1.5 text-[10px] uppercase tracking-wide text-accent-amber">
          Offline basemap (bundled) - configure NEXT_PUBLIC_MAP_STYLE_URL for a live tile provider
        </div>
      )}

      {/* view controls */}
      <div className="absolute right-4 top-4 z-10 flex gap-1 rounded-lg border border-white/[0.08] bg-base-900/90 p-1">
        {(["world", "india", "eastcoast"] as const).map((v) => (
          <button
            key={v}
            onClick={() => flyTo(v)}
            className={`rounded px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              activeView === v ? "bg-accent-cyan/20 text-accent-cyan" : "text-base-500 hover:text-base-100"
            }`}
          >
            {v === "world" ? "World" : v === "india" ? "India" : "East Coast"}
          </button>
        ))}
        <button
          onClick={() => flyTo("world")}
          title="Reset view"
          className="rounded px-2 py-1.5 text-base-500 hover:text-base-100"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <DisruptionPanel routes={routes} />

      {/* filters + layer controls */}
      <MapFilters
        filters={filters}
        onChange={setFilters}
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        showLayers={showLayers}
        onShowLayersChange={setShowLayers}
        showLegend={showLegend}
        onToggleLegend={() => setShowLegend((s) => !s)}
      />

      {/* legend */}
      {showLegend && (
        <div className="absolute bottom-4 left-4 z-10 w-56 rounded-lg border border-white/[0.08] bg-base-900/90 p-3 text-[11px]">
          <div className="mb-2 flex items-center gap-1.5 font-semibold text-base-100">
            <LayersIcon className="h-3 w-3" /> Legend - route color: {colorMode}
          </div>
          <LegendRow color="#3dd68c" label="Low" />
          <LegendRow color="#e8a33d" label="Medium" />
          <LegendRow color="#e8607a" label="High" />
          <div className="mt-2 border-t border-white/[0.08] pt-2 text-base-500">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent-blue" /> Overseas origin
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent-cyan" /> East Coast India port
            </div>
            <div className="mt-1 text-[10px] text-base-500/80">Line width ∝ indicative annual cargo volume</div>
          </div>
        </div>
      )}

      {!mapReady && !loadError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-base-950/60 text-sm text-base-500">
          Loading Global Network...
        </div>
      )}
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-base-500">{label}</span>
    </div>
  );
}
