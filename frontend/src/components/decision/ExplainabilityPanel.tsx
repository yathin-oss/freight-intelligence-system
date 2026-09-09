import { Lightbulb } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import type { RecommendationOut } from "@/types/api";

export function ExplainabilityPanel({ recommendation }: { recommendation: RecommendationOut }) {
  return (
    <Panel id="explainability" title="Why This Recommendation?" subtitle="Traced directly from forecast → constraints → risk → cost → optimizer, in order.">
      <ol className="space-y-2.5">
        {recommendation.explanation.map((e) => (
          <li key={e.order} className="flex items-start gap-3 rounded-lg border border-base-100/[0.06] bg-base-900/40 px-3.5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-gold/15 text-[11px] font-bold text-accent-gold">
              {e.order}
            </span>
            <span className="text-[12.5px] leading-relaxed text-base-100">{e.statement}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-start gap-2 rounded-lg bg-accent-amber/[0.06] px-3.5 py-2.5 text-[11px] leading-relaxed text-accent-amber">
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        ML predicts the freight rate. Feasibility constraints, risk classification and the charter-timing rule are
        deterministic business logic, not model output - see Data / Model page and the README &quot;AI vs Rules&quot;
        section for the full separation.
      </div>
    </Panel>
  );
}
