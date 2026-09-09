"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Anchor } from "lucide-react";
import { api } from "@/lib/api";
import { Panel, StatTile } from "@/components/ui/Panel";
import { DataStatusBadge, RiskBadge, TrendBadge } from "@/components/ui/Badge";
import { useWorkspaceStore } from "@/lib/store";
import type { Port, Route } from "@/types/api";

export default function PortDetailPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const setDraft = useWorkspaceStore((s) => s.setDraft);
  const [port, setPort] = useState<Port | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPort(params.code)
      .then(setPort)
      .catch((e) => setError(e.message));
    api
      .listRoutes({ destination_code: params.code })
      .then(setRoutes)
      .catch(() => {});
  }, [params.code]);

  if (error) {
    return (
      <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
        {error}
      </div>
    );
  }
  if (!port) return <div className="text-sm text-base-500">Loading port intelligence...</div>;

  function openInDecisionWorkspace(route: Route) {
    setDraft({ originCode: route.origin_code, destinationCode: route.destination_code, cargoType: route.cargo_type });
    router.push("/decision");
  }

  return (
    <div className="space-y-4">
      <button onClick={() => router.push("/ports")} className="flex items-center gap-1.5 text-xs text-base-500 hover:text-base-100">
        <ArrowLeft className="h-3.5 w-3.5" /> All Ports
      </button>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-cyan/15 ring-1 ring-accent-cyan/30">
          <Anchor className="h-5 w-5 text-accent-cyan" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">{port.name} Port</h1>
          <p className="text-sm text-base-500">
            {port.state}, India · {port.port_type}
          </p>
        </div>
        <DataStatusBadge status={port.data_status} className="ml-auto" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Draft Limit" value={port.draft_limit_m ? `${port.draft_limit_m} m` : "DATA UNAVAILABLE"} />
        <StatTile label="LOA Limit" value={port.loa_limit_m ? `${port.loa_limit_m} m` : "DATA UNAVAILABLE"} />
        <StatTile label="Beam Limit" value={port.beam_limit_m ? `${port.beam_limit_m} m` : "DATA UNAVAILABLE"} />
        <StatTile label="Coordinates" value={`${port.lat.toFixed(2)}, ${port.lon.toFixed(2)}`} />
      </div>

      <Panel title="Congestion & Risk">
        <div className="flex flex-wrap gap-6">
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wide text-base-500">Congestion</div>
            <RiskBadge level={port.congestion} />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wide text-base-500">Operational Risk</div>
            <RiskBadge level={port.risk} />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wide text-base-500">Compatible Vessel Classes</div>
            <div className="flex flex-wrap gap-1.5">
              {port.compatible_classes.map((c) => (
                <span key={c} className="rounded bg-base-700/60 px-2 py-0.5 text-xs text-base-100">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
        {port.notes && <p className="mt-4 text-xs leading-relaxed text-base-500">{port.notes}</p>}
      </Panel>

      <Panel title="Incoming Routes" subtitle="Port → Routes → Shipment → Decision. Click a route to open the Decision Workspace prefilled.">
        <div className="space-y-2">
          {routes.map((r) => (
            <button
              key={r.route_id}
              onClick={() => openInDecisionWorkspace(r)}
              className="flex w-full items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-base-900/40 px-4 py-3 text-left hover:border-accent-cyan/30"
            >
              <div>
                <div className="text-sm font-medium text-base-100">
                  {r.origin_name}, {r.origin_country} → {port.name}
                </div>
                <div className="mt-0.5 text-xs text-base-500">
                  {r.cargo_type} · {Math.round(r.distance_nm).toLocaleString()} nm · ${r.reference_freight_usd_per_tonne.toFixed(2)}/t
                </div>
              </div>
              <div className="flex items-center gap-3">
                <TrendBadge trend={r.trend} />
                <RiskBadge level={r.risk} />
                <ArrowRight className="h-4 w-4 text-base-500" />
              </div>
            </button>
          ))}
          {routes.length === 0 && <p className="text-sm text-base-500">No routes on file for this port.</p>}
        </div>
      </Panel>
    </div>
  );
}
