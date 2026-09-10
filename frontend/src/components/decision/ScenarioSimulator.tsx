"use client";

import clsx from "clsx";
import { Award, Ship, Anchor, Clock } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { RiskBadge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/currency";
import { useCurrencyStore } from "@/lib/currencyStore";
import type { WhatIfScenario } from "@/types/api";

export function ScenarioSimulator({ scenarios }: { scenarios: WhatIfScenario[] }) {
  const { currency } = useCurrencyStore();
  return (
    <Panel
      id="scenario-simulator"
      title="Scenario Simulator"
      subtitle="Book Now vs Wait vs Alternative Vessel vs Alternative Port, compared on total expected logistics cost."
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {scenarios.map((s) => (
          <div
            key={s.scenario_id}
            className={clsx(
              "flex flex-col rounded-xl border p-4",
              s.is_best ? "border-accent-cyan/50 bg-accent-cyan/[0.06]" : "border-white/[0.06] bg-base-900/40",
              !s.feasible && "opacity-60"
            )}
          >
            {s.is_best && (
              <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-accent-cyan">
                <Award className="h-3.5 w-3.5" /> Best Expected Option
              </div>
            )}
            <div className="text-sm font-semibold text-base-100">{s.label}</div>
            <p className="mt-1 flex-1 text-[11.5px] leading-snug text-base-500">{s.description}</p>

            <div className="mt-3 space-y-1.5 text-[11.5px] text-base-500">
              <div className="flex items-center gap-1.5">
                <Ship className="h-3 w-3" /> {s.vessel_class || "—"}
              </div>
              <div className="flex items-center gap-1.5">
                <Anchor className="h-3 w-3" /> {s.destination_name}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> {s.wait_weeks === 0 ? "Immediate" : `Wait ${s.wait_weeks} wk`}
              </div>
            </div>

            <div className="mt-3 border-t border-white/[0.06] pt-3">
              {s.feasible ? (
                <>
                  <div className="text-[10px] uppercase tracking-wide text-base-500">Total Expected Cost</div>
                  <div className="text-lg font-bold text-base-100">{formatCurrency(s.cost.total_expected_cost_usd, currency)}</div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-base-500">Risk</span>
                    <RiskBadge level={s.risk.overall} />
                  </div>
                </>
              ) : (
                <div className="rounded-md bg-risk-high/10 px-2 py-1.5 text-[11px] text-accent-rose">
                  Infeasible: {s.feasibility_reasons[0]}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
