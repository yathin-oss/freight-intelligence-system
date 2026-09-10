"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, TrendingDown, TrendingUp, X } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { Panel } from "@/components/ui/Panel";
import { DataStatusBadge } from "@/components/ui/Badge";
import { vesselClassRateHistory } from "@/lib/api";
import type { FeasibilityResponse } from "@/types/api";

// Per-vessel-class historic daily-hire trend ("loads") - see
// implementation_plan.txt Section 1b. A compact sparkline next to each
// vessel class's estimated daily hire, independent of the origin/cargo BDI
// forecast above.
function LoadsSparkline({ vesselCode }: { vesselCode: string }) {
  const [history, setHistory] = useState<{ date: string; daily_hire_usd: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    vesselClassRateHistory(vesselCode, 8)
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vesselCode]);

  if (history.length < 2) return null;

  const first = history[0].daily_hire_usd;
  const last = history[history.length - 1].daily_hire_usd;
  const pct = ((last - first) / first) * 100;
  const up = pct >= 0;

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-6 w-16">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history}>
            <Line type="monotone" dataKey="daily_hire_usd" stroke={up ? "#e8607a" : "#3dd68c"} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <span className={clsx("flex items-center gap-0.5 text-[10.5px] font-medium", up ? "text-accent-rose" : "text-risk-low")}>
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {up ? "+" : ""}
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export function VesselOptimizerTable({ feasibility }: { feasibility: FeasibilityResponse }) {
  return (
    <Panel
      id="vessel-optimizer"
      title="Section 4 · Vessel Optimizer"
      subtitle="Every candidate class is evaluated against the destination port's actual constraints - none are silently dropped."
      right={<DataStatusBadge status={feasibility.data_status} />}
    >
      <div className="space-y-3">
        {feasibility.results.map((r) => {
          const isRecommended = r.vessel_code === feasibility.recommended_vessel_code;
          return (
            <div
              key={r.vessel_code}
              className={clsx(
                "rounded-lg border px-4 py-3.5",
                r.feasible
                  ? isRecommended
                    ? "border-accent-cyan/40 bg-accent-cyan/[0.06]"
                    : "border-risk-low/25 bg-risk-low/[0.04]"
                  : "border-white/[0.06] bg-base-900/40 opacity-70"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-base-100">{r.vessel_class}</span>
                  {isRecommended && (
                    <span className="rounded bg-accent-cyan/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent-cyan">
                      Recommended
                    </span>
                  )}
                </div>
                <span
                  className={clsx(
                    "rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                    r.feasible ? "bg-risk-low/15 text-risk-low" : "bg-risk-high/15 text-risk-high"
                  )}
                >
                  {r.feasible ? "Feasible" : "Rejected"}
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-5">
                {r.checks.map((c) => (
                  <div key={c.label} className="flex items-start gap-1.5 text-[11.5px]">
                    {c.passed ? (
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-risk-low" />
                    ) : (
                      <X className="mt-0.5 h-3 w-3 shrink-0 text-risk-high" />
                    )}
                    <span className={c.passed ? "text-base-500" : "text-base-100"}>{c.label}</span>
                  </div>
                ))}
              </div>

              {!r.feasible && r.rejection_reasons.length > 0 && (
                <div className="mt-2 rounded-md bg-risk-high/[0.06] px-3 py-2 text-[11.5px] text-accent-rose">
                  {r.rejection_reasons.join(" · ")}
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-base-500">
                <span>
                  Estimated daily hire: <span className="text-base-100">${r.estimated_daily_hire_usd.toLocaleString()}</span>
                </span>
                <LoadsSparkline vesselCode={r.vessel_code} />
              </div>
            </div>
          );
        })}
      </div>

      {!feasibility.recommended_vessel_code && (
        <div className="mt-3 rounded-md border border-accent-rose/30 bg-accent-rose/10 px-3 py-2 text-xs text-accent-rose">
          No evaluated vessel class is feasible for this shipment at the selected port. Try a smaller quantity, a
          different destination port, or review the rejection reasons above.
        </div>
      )}
    </Panel>
  );
}
