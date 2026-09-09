import { Panel } from "@/components/ui/Panel";
import { DataStatusBadge, RiskBadge } from "@/components/ui/Badge";
import type { RiskAssessmentOut } from "@/types/api";

const LEVEL_SCORE: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

export function RiskPanel({ risk }: { risk: RiskAssessmentOut }) {
  // A small client-computed summary, not a backend field: sum of the same
  // 1/2/3 scores shown below as LOW/MEDIUM/HIGH badges, out of the max
  // possible for however many factors actually carry a scorable level
  // (UNAVAILABLE factors are excluded from both the numerator and the max,
  // never silently treated as zero risk).
  const scored = risk.factors.filter((f) => LEVEL_SCORE[f.level] !== undefined);
  const sum = scored.reduce((acc, f) => acc + LEVEL_SCORE[f.level], 0);
  const max = scored.length * 3;

  return (
    <Panel
      id="risk-center"
      title="Risk Center"
      subtitle="Every factor traces to a real input - no factor is a random draw."
      right={<DataStatusBadge status={risk.data_status} />}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-base-100/[0.08] bg-base-900/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-wider text-base-500">Overall Risk</span>
          <RiskBadge level={risk.overall} />
        </div>
        {max > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-base-500" title="Client-computed from the 4 factors below - sum of LOW=1/MEDIUM=2/HIGH=3, not a separate backend score.">
            Aggregate index
            <span className="font-mono tabular-nums text-base-100">
              {sum}/{max}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {risk.factors.map((f) => (
          <div key={f.label} className="rounded border border-base-100/[0.08] bg-base-900/40 px-3.5 py-3">
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
