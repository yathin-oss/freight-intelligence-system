"use client";

import { useRouter } from "next/navigation";
import { Ship, ArrowRight } from "lucide-react";
import { useWorkspaceStore } from "@/lib/store";
import { useRawNetworkData } from "@/lib/useNetworkStats";
import { chokepointForOrigin, estimatedVoyageDays } from "@/lib/geo";
import { formatUsd, formatNm, formatTonnes } from "@/lib/format";
import { DataStatusBadge } from "@/components/ui/Badge";

// Reuses the "Active Operational Fixture" panel shape from the Stitch
// visual reference, but every value in it traces to a real Route/Port field
// or a disclosed client-side derivation (voyage days from distance ÷ an
// assumed service speed) - nothing here is a live feed, unlike the
// reference's implied "PROD / EC-INDIA DESK" AIS-backed banner.
export function ActiveScenarioBanner() {
  const router = useRouter();
  const draft = useWorkspaceStore((s) => s.draft);
  const { ports, routes, loading } = useRawNetworkData();

  if (loading) {
    return <div className="h-[86px] animate-pulse rounded border border-base-100/[0.08] bg-base-850" />;
  }

  const route = routes.find(
    (r) => r.origin_code === draft.originCode && r.destination_code === draft.destinationCode && r.cargo_type === draft.cargoType
  );
  const port = ports.find((p) => p.code === draft.destinationCode);
  const chokepoint = chokepointForOrigin(draft.originCode);

  if (!route) return null;

  const voyageDays = estimatedVoyageDays(route.distance_nm);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-accent-gold/25 bg-accent-gold/[0.04] px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-accent-gold/30 bg-accent-gold/10">
          <Ship className="h-3.5 w-3.5 text-accent-gold" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-semibold text-base-100">
              {route.origin_name} ({route.origin_country}) → {route.destination_name}
            </span>
            <DataStatusBadge status={route.data_status} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-base-500">
            <span>
              {route.cargo_type} · {formatTonnes(draft.quantityTonnes)}
            </span>
            <span>{formatNm(route.distance_nm)}</span>
            <span>~{voyageDays.toFixed(1)} days est. @ 13.5kt</span>
            {chokepoint && <span>via {chokepoint}</span>}
            {port?.draft_limit_m != null && <span>Disport draft limit {port.draft_limit_m.toFixed(1)}m</span>}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-base-500">Reference Freight</div>
          <div className="font-mono text-lg font-semibold text-accent-gold">
            {formatUsd(route.reference_freight_usd_per_tonne, { maximumFractionDigits: 2 })}/t
          </div>
        </div>
        <button
          onClick={() => router.push("/decision")}
          className="flex items-center gap-1.5 rounded bg-accent-gold/15 px-3 py-2 text-[13px] font-semibold text-accent-gold ring-1 ring-accent-gold/30 hover:bg-accent-gold/25"
        >
          Open Decision Workspace
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
