import { Panel } from "@/components/ui/Panel";
import { DataStatusBadge, RiskBadge } from "@/components/ui/Badge";
import type { RiskAssessmentOut } from "@/types/api";

export function RiskPanel({ risk }: { risk: RiskAssessmentOut }) {
  return (
    <Panel
      id="risk-center"
      title="Risk Center"
      subtitle="Every factor traces to a real input - no factor is a random draw."
      right={<DataStatusBadge status={risk.data_status} />}
    >
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-base-900/50 px-4 py-3">
        <span className="text-[11px] uppercase tracking-wider text-base-500">Overall Risk</span>
        <RiskBadge level={risk.overall} />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {risk.factors.map((f) => (
          <div key={f.label} className="rounded-lg border border-white/[0.06] bg-base-900/40 px-3.5 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-base-100">{f.label}</span>
              <RiskBadge level={f.level} />
            </div>
            <p className="mt-1.5 text-[11.5px] leading-snug text-base-500">{f.detail}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
