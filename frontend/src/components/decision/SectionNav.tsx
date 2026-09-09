"use client";

const SECTIONS = [
  { id: "shipment-scenario", label: "Shipment Scenario" },
  { id: "freight-forecast", label: "Freight Forecast" },
  { id: "charter-timing", label: "Charter Timing" },
  { id: "vessel-optimizer", label: "Vessel Optimizer" },
  { id: "risk-center", label: "Risk Center" },
  { id: "scenario-simulator", label: "Scenario Simulator" },
  { id: "cost-intelligence", label: "Cost" },
  { id: "explainability", label: "Recommendation" },
  { id: "recent-activity", label: "Activity" },
];

export function SectionNav({ hasResult }: { hasResult: boolean }) {
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <div className="sticky top-[88px] z-30 -mx-6 mb-4 border-b border-base-100/[0.06] bg-base-950/95 px-6 py-2 backdrop-blur">
      <div className="flex flex-wrap gap-1 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            disabled={s.id !== "shipment-scenario" && s.id !== "recent-activity" && !hasResult}
            className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11.5px] font-medium text-base-500 transition-colors hover:bg-base-100/[0.05] hover:text-base-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
