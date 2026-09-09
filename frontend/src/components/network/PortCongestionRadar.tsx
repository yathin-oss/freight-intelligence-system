"use client";

import { Panel } from "@/components/ui/Panel";
import { RiskBadge } from "@/components/ui/Badge";
import { useRawNetworkData } from "@/lib/useNetworkStats";

const SEVERITY_RANK: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const SEVERITY_FILL: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const SEVERITY_COLOR: Record<string, string> = { HIGH: "bg-risk-high", MEDIUM: "bg-risk-medium", LOW: "bg-risk-low" };

// "Port Congestion Radar" - same panel shape as the Stitch reference, but
// deliberately does NOT print a fabricated "X.X days" figure per port: the
// backend only classifies congestion as LOW/MEDIUM/HIGH (see
// backend/app/models/reference.py), it doesn't return a decimal wait time.
// The bar below visualizes that categorical severity honestly - 1/2/3
// segments filled, not a invented number of days.
export function PortCongestionRadar() {
  const { ports, loading } = useRawNetworkData();

  const sorted = [...ports].sort((a, b) => (SEVERITY_RANK[b.congestion] || 0) - (SEVERITY_RANK[a.congestion] || 0));

  return (
    <Panel title="Port Congestion Radar" subtitle={loading ? "Loading..." : "East Coast India · categorical, as reported"}>
      <div className="flex flex-col gap-2.5">
        {sorted.map((p) => (
          <div key={p.code} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-medium text-base-100">
                {p.name} <span className="text-base-500">({p.code})</span>
              </div>
              <div className="mt-1 flex gap-0.5">
                {[1, 2, 3].map((seg) => (
                  <span
                    key={seg}
                    className={`h-1.5 w-6 rounded-sm ${
                      seg <= (SEVERITY_FILL[p.congestion] || 0) ? SEVERITY_COLOR[p.congestion] : "bg-base-100/[0.08]"
                    }`}
                  />
                ))}
              </div>
            </div>
            <RiskBadge level={p.congestion} />
          </div>
        ))}
        {!loading && sorted.length === 0 && <div className="py-4 text-center text-[12px] text-base-500">No port data available.</div>}
      </div>
    </Panel>
  );
}
