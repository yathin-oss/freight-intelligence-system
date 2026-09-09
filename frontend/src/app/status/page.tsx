"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, CircleDashed, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Panel, StatTile } from "@/components/ui/Panel";
import { ModelValidationPanel } from "@/components/status/ModelValidationPanel";
import type { SystemStatus } from "@/types/api";

const STATE_META: Record<string, { icon: any; color: string; label: string }> = {
  available: { icon: CheckCircle2, color: "rgb(var(--c-good))", label: "Available" },
  prototype: { icon: CircleDashed, color: "rgb(var(--c-warn))", label: "Prototype" },
  not_connected: { icon: XCircle, color: "rgb(var(--c-base-500))", label: "Not Connected" },
  error: { icon: CircleAlert, color: "rgb(var(--c-danger))", label: "Error" },
};

export default function StatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.status().then(setStatus).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-base-100">Data / Model Status</h1>
        <p className="mt-1 max-w-2xl text-sm text-base-500">
          Every figure in this application is one of: real, prototype/estimated, synthetic, or explicitly
          unavailable. This page is the single source of truth for which is which - see also{" "}
          <code className="rounded bg-base-800 px-1 py-0.5 text-[11px]">data/DATA_DICTIONARY.md</code> in the repo.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
          Cannot reach the backend: {error}
        </div>
      )}

      {status && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="ML Model" value={status.ml_model_ready ? "Loaded" : "Fallback"} accent={status.ml_model_ready ? "gold" : "rose"} sub={status.ml_model_version} />
            <StatTile label="Database" value={status.database_url_kind.toUpperCase()} accent="blue" />
            <StatTile label="Components Tracked" value={status.items.length} accent="amber" />
            <StatTile label="Generated" value={new Date(status.generated_at).toLocaleTimeString()} />
          </div>

          <Panel title="Component Status">
            <div className="space-y-2">
              {status.items.map((item) => {
                const meta = STATE_META[item.state] || STATE_META.error;
                const Icon = meta.icon;
                return (
                  <div key={item.name} className="flex items-start gap-3 rounded-lg border border-base-100/[0.06] bg-base-900/40 px-4 py-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: meta.color }} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-base-100">{item.name}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-base-500">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <ModelValidationPanel />

          <Panel title="Production Roadmap" subtitle="What this prototype does NOT do yet, disclosed explicitly.">
            <ul className="space-y-1.5 text-[12.5px] text-base-500">
              <li>· Live AIS vessel tracking &amp; ETA prediction</li>
              <li>· Live port congestion telemetry (VTMS)</li>
              <li>· Licensed freight-rate index (Baltic Exchange / Clarksons)</li>
              <li>· SAIL&apos;s actual historical charter / procurement data</li>
              <li>· ERP / SAP and procurement system integration</li>
              <li>· Automated model retraining and alerting</li>
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}
