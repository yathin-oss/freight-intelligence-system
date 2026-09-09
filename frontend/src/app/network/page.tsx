"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { GlobalNetworkMap } from "@/components/map/GlobalNetworkMap";
import { ActiveScenarioBanner } from "@/components/ActiveScenarioBanner";
import { CorridorMatrix } from "@/components/network/CorridorMatrix";
import { PortCongestionRadar } from "@/components/network/PortCongestionRadar";
import { useWorkspaceStore, DEMO_SCENARIO } from "@/lib/store";
import { Radar, ArrowRight } from "lucide-react";

export default function NetworkPage() {
  const router = useRouter();
  const setDraft = useWorkspaceStore((s) => s.setDraft);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-base-100">Global Freight Network</h1>
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
          className="flex items-center gap-2 rounded bg-accent-gold/15 px-4 py-2.5 text-sm font-semibold text-accent-gold ring-1 ring-accent-gold/30 hover:bg-accent-gold/25"
        >
          <Radar className="h-4 w-4" />
          Run Demo Scenario: Australia &rarr; Paradip
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <ActiveScenarioBanner />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_360px]">
        <div className="h-[calc(100vh-360px)] min-h-[480px]">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-base-500">Loading Global Network...</div>}>
            <GlobalNetworkMap />
          </Suspense>
        </div>
        <div className="flex max-h-[calc(100vh-360px)] min-h-[480px] flex-col gap-3 overflow-y-auto pr-0.5">
          <CorridorMatrix />
          <PortCongestionRadar />
        </div>
      </div>
    </div>
  );
}
