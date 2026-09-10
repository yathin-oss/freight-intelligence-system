"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Anchor, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Panel } from "@/components/ui/Panel";
import { DataStatusBadge, RiskBadge } from "@/components/ui/Badge";
import type { Port } from "@/types/api";

export default function PortsListPage() {
  const [ports, setPorts] = useState<Port[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listPorts()
      .then(setPorts)
      .catch((e) => setError(e.message || "Failed to load ports."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-white">Port Intelligence</h1>
      <p className="mt-1 max-w-2xl text-sm text-base-500">
        East Coast India bulk-cargo ports evaluated in this prototype, with infrastructure constraints, congestion
        and risk classification.
      </p>

      {loading && <div className="mt-8 text-sm text-base-500">Loading ports...</div>}

      {error && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Could not load ports</div>
            <div className="mt-0.5 text-xs text-accent-rose/80">{error}</div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ports.map((p) => (
          <Link key={p.code} href={`/ports/${p.code}`}>
            <Panel className="h-full transition-colors hover:border-accent-cyan/30">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Anchor className="h-4 w-4 text-accent-cyan" />
                  <div>
                    <div className="font-semibold text-base-100">{p.name}</div>
                    <div className="text-xs text-base-500">
                      {p.state} · {p.port_type}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-base-500" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <RiskBadge level={p.congestion} />
                <span className="text-[10px] text-base-500">congestion</span>
                <RiskBadge level={p.risk} />
                <span className="text-[10px] text-base-500">risk</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.compatible_classes.map((c) => (
                  <span key={c} className="rounded bg-base-700/60 px-1.5 py-0.5 text-[10px] text-base-500">
                    {c}
                  </span>
                ))}
              </div>
              <div className="mt-3">
                <DataStatusBadge status={p.data_status} />
              </div>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
