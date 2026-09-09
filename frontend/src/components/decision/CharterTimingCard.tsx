import { CalendarClock, Eye, PauseCircle, PlayCircle, Info } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { DataStatusBadge } from "@/components/ui/Badge";
import { formatUsd } from "@/lib/format";
import type { RecommendationOut } from "@/types/api";
import type { TceResult } from "@/lib/tce";

const ACTION_META: Record<string, { icon: any; color: string; bg: string; border: string }> = {
  BOOK_NOW: { icon: PlayCircle, color: "rgb(var(--c-good))", bg: "rgb(var(--c-good) / 0.10)", border: "rgb(var(--c-good) / 0.2)" },
  WAIT: { icon: PauseCircle, color: "rgb(var(--c-warn))", bg: "rgb(var(--c-warn) / 0.10)", border: "rgb(var(--c-warn) / 0.2)" },
  BOOK_WITHIN_RANGE: { icon: CalendarClock, color: "rgb(var(--c-info))", bg: "rgb(var(--c-info) / 0.10)", border: "rgb(var(--c-info) / 0.2)" },
  MONITOR: { icon: Eye, color: "rgb(var(--c-danger))", bg: "rgb(var(--c-danger) / 0.10)", border: "rgb(var(--c-danger) / 0.2)" },
};

export function CharterTimingCard({
  recommendation,
  tce,
}: {
  recommendation: RecommendationOut;
  tce?: TceResult | null;
}) {
  const meta = ACTION_META[recommendation.action] || ACTION_META.MONITOR;
  const Icon = meta.icon;

  return (
    <Panel
      id="charter-timing"
      title="Section 3 · Charter Timing"
      right={<DataStatusBadge status={recommendation.data_status} />}
    >
      <div
        className="flex flex-col items-center gap-3 rounded border px-6 py-8 text-center sm:flex-row sm:text-left"
        style={{ borderColor: meta.border, background: meta.bg }}
      >
        <Icon className="h-12 w-12 shrink-0" style={{ color: meta.color }} strokeWidth={1.5} />
        <div>
          <div className="text-2xl font-bold tracking-tight" style={{ color: meta.color }}>
            {recommendation.headline}
          </div>
          {recommendation.wait_weeks_min !== null && recommendation.wait_weeks_max !== null && (
            <div className="mt-1 text-sm text-base-500">
              Target window: week {recommendation.wait_weeks_min}–{recommendation.wait_weeks_max} from today
            </div>
          )}
        </div>
      </div>

      {tce && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded border border-base-100/[0.08] bg-base-900/50 px-4 py-3">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-base-500">
              Time Charter Equivalent
              <span title="Computed client-side, not an API field: (freight cost − recommended vessel's daily hire × estimated voyage days) ÷ estimated voyage days. The standard unit a chartering desk compares against a vessel's actual daily hire rate.">
                <Info className="h-3 w-3 cursor-help" />
              </span>
            </div>
            <div
              className={`font-mono text-xl font-semibold tabular-nums ${
                tce.tceUsdPerDay >= 0 ? "text-risk-low" : "text-risk-high"
              }`}
            >
              {formatUsd(tce.tceUsdPerDay)}/day
            </div>
          </div>
          <div className="text-right text-[11px] text-base-500">
            <div>~{tce.voyageDays.toFixed(1)} est. voyage days</div>
            <div>{formatUsd(tce.voyageOperatingCostUsd)} est. voyage operating cost</div>
          </div>
        </div>
      )}
    </Panel>
  );
}
