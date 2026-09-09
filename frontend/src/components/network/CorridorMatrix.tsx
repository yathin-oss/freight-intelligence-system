"use client";

import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui/Panel";
import { RiskBadge } from "@/components/ui/Badge";
import { useRawNetworkData } from "@/lib/useNetworkStats";
import { useWorkspaceStore } from "@/lib/store";
import { estimatedVoyageDays } from "@/lib/geo";
import { formatUsd, formatNm, formatPct } from "@/lib/format";

const SHOWN = 8;

// "Corridor Assessment Matrix" - same panel shape as the Stitch reference,
// but every column is either a real Route field or a disclosed derivation
// (Est. Time = distance ÷ an assumed 13.5kt service speed), and there is no
// per-lane "FEASIBLE/REJECTED" verdict here - that requires a vessel class
// and quantity, which only exist once a scenario is run in the Decision
// Workspace. Ranking a verdict without that input would be fabricating a
// conclusion, so this table sticks to what a lane's own data supports.
export function CorridorMatrix() {
  const router = useRouter();
  const setDraft = useWorkspaceStore((s) => s.setDraft);
  const { routes, loading } = useRawNetworkData();

  const top = [...routes]
    .sort((a, b) => (b.indicative_annual_volume_tonnes || 0) - (a.indicative_annual_volume_tonnes || 0))
    .slice(0, SHOWN);

  return (
    <Panel
      title="Corridor Assessment Matrix"
      subtitle={loading ? "Loading..." : `Top ${Math.min(SHOWN, routes.length)} of ${routes.length} tracked lanes, by indicative volume`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-base-100/[0.08] text-[10px] uppercase tracking-wider text-base-500">
              <th className="px-3 py-2 font-medium">Lane</th>
              <th className="px-3 py-2 font-medium">Dist.</th>
              <th className="px-3 py-2 font-medium">Est. Time</th>
              <th className="px-3 py-2 font-medium">Ref. $/t</th>
              <th className="px-3 py-2 font-medium">8wk Δ</th>
              <th className="px-3 py-2 font-medium">Risk</th>
            </tr>
          </thead>
          <tbody>
            {top.map((r) => (
              <tr
                key={r.route_id}
                onClick={() => {
                  setDraft({ originCode: r.origin_code, destinationCode: r.destination_code, cargoType: r.cargo_type });
                  router.push("/decision");
                }}
                className="cursor-pointer border-b border-base-100/[0.04] last:border-b-0 hover:bg-base-100/[0.03]"
              >
                <td className="px-3 py-2">
                  <div className="font-medium text-base-100">
                    {r.origin_name} → {r.destination_name}
                  </div>
                  <div className="text-[10.5px] text-base-500">{r.cargo_type}</div>
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-base-500">{formatNm(r.distance_nm)}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-base-500">
                  {estimatedVoyageDays(r.distance_nm).toFixed(1)}d
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-base-100">
                  {formatUsd(r.reference_freight_usd_per_tonne, { maximumFractionDigits: 2 })}
                </td>
                <td
                  className={`px-3 py-2 font-mono tabular-nums ${
                    r.trend_pct_8wk > 0 ? "text-risk-high" : r.trend_pct_8wk < 0 ? "text-risk-low" : "text-base-500"
                  }`}
                >
                  {formatPct(r.trend_pct_8wk)}
                </td>
                <td className="px-3 py-2">
                  <RiskBadge level={r.risk} />
                </td>
              </tr>
            ))}
            {!loading && top.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-base-500">
                  No lane data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
