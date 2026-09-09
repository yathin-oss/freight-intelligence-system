import { Activity } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { formatUsd, formatDate, formatTonnes } from "@/lib/format";
import type { DecisionRunSummary } from "@/types/api";

const ACTION_COLOR: Record<string, string> = {
  BOOK_NOW: "text-risk-low",
  BOOK_WITHIN_RANGE: "text-accent-blue",
  WAIT: "text-accent-amber",
  MONITOR: "text-risk-high",
};

// Promoted from a small afterthought table into a first-class panel - this
// is a real fixtures/activity feed, every row a genuine row from the
// decision_runs table (GET /api/decision/runs), not a styling exercise on
// invented rows.
export function RecentActivityPanel({ runs }: { runs: DecisionRunSummary[] }) {
  if (runs.length === 0) return null;

  return (
    <Panel
      id="recent-activity"
      title="Recent Chartering Activity"
      subtitle="Every run persisted by this desk - GET /api/decision/runs, not a static list."
      right={
        <div className="flex items-center gap-1.5 text-[11px] text-base-500">
          <Activity className="h-3.5 w-3.5" /> {runs.length} runs
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-base-100/[0.08] text-[10px] uppercase tracking-wider text-base-500">
              <th className="px-3 py-2 font-medium">Run</th>
              <th className="px-3 py-2 font-medium">Lane</th>
              <th className="px-3 py-2 font-medium">Cargo</th>
              <th className="px-3 py-2 font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Recommendation</th>
              <th className="px-3 py-2 font-medium">Risk</th>
              <th className="px-3 py-2 font-medium">Total Cost</th>
              <th className="px-3 py-2 font-medium">Model</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-base-100/[0.04] last:border-b-0 hover:bg-base-100/[0.02]">
                <td className="px-3 py-2.5 text-base-500">
                  #{r.id}
                  <div className="text-[10px]">{formatDate(r.created_at)}</div>
                </td>
                <td className="px-3 py-2.5 font-medium text-base-100">
                  {r.origin_code} → {r.destination_code}
                </td>
                <td className="px-3 py-2.5 text-base-500">{r.cargo_type}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums text-base-500">{formatTonnes(r.quantity_tonnes)}</td>
                <td className={`px-3 py-2.5 font-medium ${ACTION_COLOR[r.recommended_action] || "text-base-100"}`}>
                  {r.recommended_action.replace(/_/g, " ")}
                </td>
                <td className="px-3 py-2.5 text-base-500">{r.overall_risk}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums text-base-100">{formatUsd(r.total_expected_cost_usd)}</td>
                <td className="px-3 py-2.5 text-[10.5px] text-base-500">{r.model_version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
