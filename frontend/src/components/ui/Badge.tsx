import clsx from "clsx";

const LEVEL_STYLES: Record<string, string> = {
  LOW: "bg-risk-low/15 text-risk-low border-risk-low/30",
  MEDIUM: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
  HIGH: "bg-risk-high/15 text-risk-high border-risk-high/30",
  UNAVAILABLE: "bg-base-600/40 text-base-500 border-base-600",
};

export function RiskBadge({ level }: { level: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        LEVEL_STYLES[level] || LEVEL_STYLES.UNAVAILABLE
      )}
    >
      <span
        className={clsx(
          "status-dot",
          level === "LOW" && "bg-risk-low",
          level === "MEDIUM" && "bg-risk-medium",
          level === "HIGH" && "bg-risk-high",
          !["LOW", "MEDIUM", "HIGH"].includes(level) && "bg-base-500"
        )}
      />
      {level}
    </span>
  );
}

// Data provenance badge - the single most important honesty signal in the UI.
// Every figure sourced from the backend carries one of these so a viewer
// (or a judge) never mistakes prototype/synthetic data for a live feed.
const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  ESTIMATED: { label: "ESTIMATED", cls: "bg-accent-amber/10 text-accent-amber border-accent-amber/30" },
  SYNTHETIC: { label: "SYNTHETIC", cls: "bg-accent-blue/10 text-accent-blue border-accent-blue/30" },
  prototype: { label: "PROTOTYPE", cls: "bg-accent-amber/10 text-accent-amber border-accent-amber/30" },
  "prototype-fallback": { label: "BASELINE FALLBACK", cls: "bg-accent-rose/10 text-accent-rose border-accent-rose/30" },
  unavailable: { label: "DATA UNAVAILABLE", cls: "bg-base-600/50 text-base-500 border-base-600" },
  available: { label: "AVAILABLE", cls: "bg-risk-low/10 text-risk-low border-risk-low/30" },
  not_connected: { label: "NOT CONNECTED", cls: "bg-base-600/50 text-base-500 border-base-600" },
  error: { label: "ERROR", cls: "bg-risk-high/10 text-risk-high border-risk-high/30" },
};

export function DataStatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_STYLES[status] || { label: status.toUpperCase(), cls: "bg-base-600/40 text-base-500 border-base-600" };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        meta.cls,
        className
      )}
      title="Data provenance - see Data / Model Status page for details"
    >
      {meta.label}
    </span>
  );
}

export function TrendBadge({ trend }: { trend: string }) {
  const styles: Record<string, string> = {
    increasing: "text-risk-high",
    decreasing: "text-risk-low",
    stable: "text-base-500",
  };
  const arrow = trend === "increasing" ? "↑" : trend === "decreasing" ? "↓" : "→";
  return (
    <span className={clsx("inline-flex items-center gap-1 text-sm font-semibold", styles[trend] || "text-base-500")}>
      {arrow} {trend}
    </span>
  );
}
