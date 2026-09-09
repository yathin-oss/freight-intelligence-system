"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GlobalNetworkMap } from "@/components/map/GlobalNetworkMap";
import { StatTile } from "@/components/ui/Panel";
import { api } from "@/lib/api";
import { useWorkspaceStore, DEMO_SCENARIO } from "@/lib/store";
import { Radar, ArrowRight } from "lucide-react";
import type { Port, Route } from "@/types/api";

export default function NetworkPage() {
  const router = useRouter();
  const [ports, setPorts] = useState<Port[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const setDraft = useWorkspaceStore((s) => s.setDraft);

  useEffect(() => {
    api.listPorts().then(setPorts).catch(() => {});
    api.listRoutes().then(setRoutes).catch(() => {});
  }, []);

  const highRiskPorts = ports.filter((p) => p.risk === "HIGH").length;
  const decreasingRoutes = routes.filter((r) => r.trend === "decreasing").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Global Freight Network</h1>
          <p className="mt-1 max-w-2xl text-sm text-base-500">
            Overseas bulk-cargo origins routed to India&apos;s East Coast ports. Hover a port or route for its
            reference data; click a route to open it directly in the Decision Workspace.
          </p>
        </div>
        <button
          onClick={() => {
            setDraft(DEMO_SCENARIO);
            router.push("/decision?demo=1");
          }}
          className="flex items-center gap-2 rounded-lg bg-accent-cyan/15 px-4 py-2.5 text-sm font-semibold text-accent-cyan ring-1 ring-accent-cyan/30 hover:bg-accent-cyan/25"
        >
          <Radar className="h-4 w-4" />
          Run Demo Scenario: Australia &rarr; Paradip
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="East Coast Ports" value={ports.length || "-"} accent="cyan" />
        <StatTile label="Active Lanes" value={routes.length || "-"} accent="blue" />
        <StatTile label="High-Risk Ports" value={highRiskPorts} accent="rose" />
        <StatTile label="Lanes Trending Down" value={decreasingRoutes} accent="amber" sub="8-week reference trend" />
      </div>

      <div className="h-[calc(100vh-320px)] min-h-[520px]">
        <GlobalNetworkMap />
      </div>
    </div>
  );
}
