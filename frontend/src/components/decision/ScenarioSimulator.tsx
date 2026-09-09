"use client";

import { useState } from "react";
import clsx from "clsx";
import { Award, Ship, Anchor, Clock, LayoutGrid, Table2 } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { RiskBadge } from "@/components/ui/Badge";
import { formatUsd } from "@/lib/format";
import type { WhatIfScenario } from "@/types/api";

export function ScenarioSimulator({ scenarios }: { scenarios: WhatIfScenario[] }) {
  const [view, setView] = useState<"cards" | "table">("cards");

  return (
    <Panel
      id="scenario-simulator"
      title="Scenario Simulator"
      subtitle="Book Now vs Wait vs Alternative Vessel vs Alternative Port, compared on total expected logistics cost."
      right={
        <div className="flex gap-1 rounded border border-base-100/[0.08] p-0.5">
          <button
            onClick={() => setView("cards")}
            className={clsx(
              "flex items-center gap-1 rounded px-2 py-1 text-[11px]",
              view === "cards" ? "bg-accent-gold/15 text-accent-gold" : "text-base-500 hover:text-base-100"
            )}
          >
            <LayoutGrid className="h-3 w-3" /> Cards
          </button>
          <button
            onClick={() => setView("table")}
            className={clsx(
              "flex items-center gap-1 rounded px-2 py-1 text-[11px]",
              view === "table" ? "bg-accent-gold/15 text-accent-gold" : "text-base-500 hover:text-base-100"
            )}
          >
            <Table2 className="h-3 w-3" /> Table
          </button>
        </div>
      }
    >
      {view === "cards" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {scenarios.map((s) => (
            <div
              key={s.scenario_id}
              className={clsx(
                "flex flex-col rounded border p-4",
                s.is_best ? "border-accent-gold/50 bg-accent-gold/[0.06]" : "border-base-100/[0.06] bg-base-900/40",
                !s.feasible && "opacity-60"
              )}
            >
              {s.is_best && (
                <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-accent-gold">
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

              <div className="mt-3 border-t border-base-100/[0.06] pt-3">
                {s.feasible ? (
                  <>
                    <div className="text-[10px] uppercase tracking-wide text-base-500">Total Expected Cost</div>
                    <div className="text-lg font-bold text-base-100">{formatUsd(s.cost.total_expected_cost_usd)}</div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-base-500">Risk</span>
                      <RiskBadge level={s.risk.overall} />
                    </div>
                  </>
                ) : (
                  <div className="rounded bg-risk-high/10 px-2 py-1.5 text-[11px] text-accent-rose">
                    Infeasible: {s.feasibility_reasons[0]}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-base-100/[0.08] text-[10px] uppercase tracking-wider text-base-500">
                <th className="px-3 py-2 font-medium">Scenario</th>
                <th className="px-3 py-2 font-medium">Vessel</th>
                <th className="px-3 py-2 font-medium">Destination</th>
                <th className="px-3 py-2 font-medium">Timing</th>
                <th className="px-3 py-2 font-medium">Feasible</th>
                <th className="px-3 py-2 font-medium">Freight Rate</th>
                <th className="px-3 py-2 font-medium">Risk</th>
                <th className="px-3 py-2 font-medium">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr
                  key={s.scenario_id}
                  className={clsx(
                    "border-b border-base-100/[0.04] last:border-b-0",
                    s.is_best && "bg-accent-gold/[0.05]"
                  )}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5 font-medium text-base-100">
                      {s.is_best && <Award className="h-3.5 w-3.5 text-accent-gold" />}
                      {s.label}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-base-500">{s.vessel_class || "—"}</td>
                  <td className="px-3 py-2.5 text-base-500">{s.destination_name}</td>
                  <td className="px-3 py-2.5 text-base-500">{s.wait_weeks === 0 ? "Immediate" : `Wait ${s.wait_weeks} wk`}</td>
                  <td className="px-3 py-2.5">
                    <span className={s.feasible ? "text-risk-low" : "text-risk-high"}>
                      {s.feasible ? "Feasible" : "Rejected"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-base-500">
                    ${s.freight_rate_used.toFixed(2)}/t
                  </td>
                  <td className="px-3 py-2.5">
                    <RiskBadge level={s.risk.overall} />
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-base-100">
                    {s.feasible ? formatUsd(s.cost.total_expected_cost_usd) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
