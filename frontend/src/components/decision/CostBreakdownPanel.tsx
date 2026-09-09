import { Panel } from "@/components/ui/Panel";
import { DataStatusBadge } from "@/components/ui/Badge";
import { formatUsd } from "@/lib/format";
import type { CostBreakdown } from "@/types/api";

const ROWS: { key: keyof CostBreakdown; label: string; color: string }[] = [
  { key: "freight_cost_usd", label: "Freight Cost", color: "#3dd6c8" },
  { key: "expected_idle_cost_usd", label: "Expected Idle Cost", color: "#4c8dff" },
  { key: "expected_demurrage_usd", label: "Expected Demurrage", color: "#e8a33d" },
  { key: "deadheading_cost_usd", label: "Deadheading / Repositioning", color: "#a78bfa" },
  { key: "risk_penalty_usd", label: "Risk Penalty", color: "#e8607a" },
];

export function CostBreakdownPanel({ cost }: { cost: CostBreakdown }) {
  const max = Math.max(...ROWS.map((r) => cost[r.key] as number), 1);
  return (
    <Panel id="cost-intelligence" title="Total Expected Cost" right={<DataStatusBadge status={cost.data_status} />}>
      <div className="mb-4 flex items-baseline justify-between rounded-lg border border-white/[0.06] bg-base-900/50 px-4 py-3.5">
        <span className="text-[12px] uppercase tracking-wide text-base-500">Total Expected Logistics Cost</span>
        <span className="text-2xl font-bold text-base-100">{formatUsd(cost.total_expected_cost_usd)}</span>
      </div>

      <div className="space-y-2.5">
        {ROWS.map((r) => {
          const value = cost[r.key] as number;
          const pct = Math.max(2, (value / max) * 100);
          return (
            <div key={r.key}>
              <div className="mb-1 flex justify-between text-[11.5px]">
                <span className="text-base-500">{r.label}</span>
                <span className="font-medium text-base-100">{formatUsd(value)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-900">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: r.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-1 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-base-500">
        {cost.assumptions.map((a, i) => (
          <p key={i}>· {a}</p>
        ))}
      </div>
    </Panel>
  );
}
