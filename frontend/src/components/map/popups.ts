import type { Port, Route } from "@/types/api";
import type { DisruptionEvent } from "@/types/disruption";
import { formatRatePerTonne } from "@/lib/currency";
import type { Currency } from "@/lib/currencyStore";

function val(v: number | null | undefined, suffix = ""): string {
  return v === null || v === undefined ? "DATA UNAVAILABLE" : `${v}${suffix}`;
}

const LEVEL_COLOR: Record<string, string> = { LOW: "#3dd68c", MEDIUM: "#e8a33d", HIGH: "#e8607a" };
const TREND_ARROW: Record<string, string> = { increasing: "&uarr;", decreasing: "&darr;", stable: "&rarr;" };

export function portPopupHtml(port: Port): string {
  const congestionColor = LEVEL_COLOR[port.congestion] || "#7a8aa8";
  const riskColor = LEVEL_COLOR[port.risk] || "#7a8aa8";
  return `
  <div style="width:280px;font-family:Inter,system-ui,sans-serif;font-size:12.5px;color:#e6ebf2;">
    <div style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="font-size:13px;font-weight:700;letter-spacing:0.02em;">${port.name.toUpperCase()} PORT</div>
      <div style="color:#7a8aa8;font-size:11px;margin-top:2px;">${port.state}, India</div>
    </div>
    <div style="padding:12px 14px;display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;">
      <div style="color:#7a8aa8;">Port Type</div><div style="text-align:right;">${port.port_type}</div>
      <div style="color:#7a8aa8;">Draft Limit</div><div style="text-align:right;">${val(port.draft_limit_m, " m")}</div>
      <div style="color:#7a8aa8;">LOA Limit</div><div style="text-align:right;">${val(port.loa_limit_m, " m")}</div>
      <div style="color:#7a8aa8;">Beam Limit</div><div style="text-align:right;">${val(port.beam_limit_m, " m")}</div>
      <div style="color:#7a8aa8;">Congestion</div><div style="text-align:right;color:${congestionColor};font-weight:600;">${port.congestion}</div>
      <div style="color:#7a8aa8;">Risk</div><div style="text-align:right;color:${riskColor};font-weight:600;">${port.risk}</div>
    </div>
    <div style="padding:0 14px 12px;">
      <div style="color:#7a8aa8;font-size:11px;">Compatible Vessel Classes</div>
      <div style="margin-top:2px;">${port.compatible_classes.join(", ") || "DATA UNAVAILABLE"}</div>
    </div>
    <div style="padding:0 14px 12px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#e8a33d;border:1px solid rgba(232,163,61,0.3);background:rgba(232,163,61,0.1);border-radius:4px;padding:2px 6px;">${port.data_status}</span>
    </div>
    <button data-action="view-port" data-code="${port.code}"
      style="display:block;width:100%;padding:10px 14px;background:rgba(61,214,200,0.12);color:#3dd6c8;border:none;border-top:1px solid rgba(255,255,255,0.08);font-weight:600;font-size:11.5px;letter-spacing:0.03em;cursor:pointer;text-transform:uppercase;">
      View Port Intelligence &rarr;
    </button>
  </div>`;
}

const DISRUPTION_TYPE_COLOR: Record<string, string> = { weather: "#4c8dff", geopolitical: "#e8607a", congestion: "#e8a33d" };

function disruptionBannerHtml(disruption: DisruptionEvent): string {
  const color = DISRUPTION_TYPE_COLOR[disruption.type] || "#e8a33d";
  return `
  <div style="padding:10px 14px;background:${color}1a;border-bottom:1px solid ${color}4d;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${color};">⚠ ${disruption.label}</div>
    <div style="margin-top:2px;font-size:11px;color:#e6ebf2;">+${disruption.bdi_impact_pct}% BDI impact · ${disruption.delay_days}d delay${disruption.reroute ? " · rerouted" : ""}</div>
  </div>`;
}

export function routePopupHtml(route: Route, disruption?: DisruptionEvent, currency: Currency = "USD"): string {
  const riskColor = LEVEL_COLOR[route.risk] || "#7a8aa8";
  const congestionColor = LEVEL_COLOR[route.congestion] || "#7a8aa8";
  const trendColor = route.trend === "decreasing" ? "#3dd68c" : route.trend === "increasing" ? "#e8607a" : "#7a8aa8";
  return `
  <div style="width:290px;font-family:Inter,system-ui,sans-serif;font-size:12.5px;color:#e6ebf2;">
    ${disruption ? disruptionBannerHtml(disruption) : ""}
    <div style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="font-size:13px;font-weight:700;">${route.origin_name.toUpperCase()} &rarr; ${route.destination_name.toUpperCase()}</div>
      <div style="color:#7a8aa8;font-size:11px;margin-top:2px;">${route.origin_country} &middot; ${route.cargo_type}</div>
    </div>
    <div style="padding:12px 14px;display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;">
      <div style="color:#7a8aa8;">Distance</div><div style="text-align:right;">${Math.round(route.distance_nm).toLocaleString()} nm</div>
      <div style="color:#7a8aa8;">Reference Freight</div><div style="text-align:right;">${formatRatePerTonne(route.reference_freight_usd_per_tonne, currency)}</div>
      <div style="color:#7a8aa8;">8-Week Trend</div><div style="text-align:right;color:${trendColor};font-weight:600;">${TREND_ARROW[route.trend] || ""} ${route.trend_pct_8wk.toFixed(1)}%</div>
      <div style="color:#7a8aa8;">Congestion</div><div style="text-align:right;color:${congestionColor};font-weight:600;">${route.congestion}</div>
      <div style="color:#7a8aa8;">Risk</div><div style="text-align:right;color:${riskColor};font-weight:600;">${route.risk}</div>
      <div style="color:#7a8aa8;">Indicative Volume</div><div style="text-align:right;">${(route.indicative_annual_volume_tonnes / 1e6).toFixed(1)} Mt/yr</div>
    </div>
    <div style="padding:0 14px 10px;color:#7a8aa8;font-size:10.5px;line-height:1.4;">
      Live model forecast, confidence &amp; recommended charter window are computed in the
      Decision Workspace, not in this hover preview.
    </div>
    <div style="padding:0 14px 12px;">
      <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#4c8dff;border:1px solid rgba(76,141,255,0.3);background:rgba(76,141,255,0.1);border-radius:4px;padding:2px 6px;">${route.data_status}</span>
    </div>
    <div style="padding:10px 14px;background:rgba(61,214,200,0.12);color:#3dd6c8;border-top:1px solid rgba(255,255,255,0.08);font-weight:600;font-size:11.5px;letter-spacing:0.03em;text-transform:uppercase;">
      Click route to open Decision Workspace &rarr;
    </div>
  </div>`;
}
