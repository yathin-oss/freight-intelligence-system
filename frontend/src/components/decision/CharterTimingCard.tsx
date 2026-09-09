import { CalendarClock, Eye, PauseCircle, PlayCircle } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { DataStatusBadge } from "@/components/ui/Badge";
import type { RecommendationOut } from "@/types/api";

const ACTION_META: Record<string, { icon: any; color: string; bg: string }> = {
  BOOK_NOW: { icon: PlayCircle, color: "#3dd68c", bg: "rgba(61,214,140,0.10)" },
  WAIT: { icon: PauseCircle, color: "#e8a33d", bg: "rgba(232,163,61,0.10)" },
  BOOK_WITHIN_RANGE: { icon: CalendarClock, color: "#4c8dff", bg: "rgba(76,141,255,0.10)" },
  MONITOR: { icon: Eye, color: "#e8607a", bg: "rgba(232,96,122,0.10)" },
};

export function CharterTimingCard({ recommendation }: { recommendation: RecommendationOut }) {
  const meta = ACTION_META[recommendation.action] || ACTION_META.MONITOR;
  const Icon = meta.icon;

  return (
    <Panel
      id="charter-timing"
      title="Section 3 · Charter Timing"
      right={<DataStatusBadge status={recommendation.data_status} />}
    >
      <div
        className="flex flex-col items-center gap-3 rounded-xl border px-6 py-8 text-center sm:flex-row sm:text-left"
        style={{ borderColor: `${meta.color}33`, background: meta.bg }}
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
    </Panel>
  );
}
