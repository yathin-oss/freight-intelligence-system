"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Anchor, Compass, Gauge, Moon, Radar, Search, Ship, Sliders, Sun } from "lucide-react";
import { api } from "@/lib/api";
import type { SearchResultItem } from "@/types/api";
import { useWorkspaceStore } from "@/lib/store";
import { useNetworkStats } from "@/lib/useNetworkStats";
import { useThemeStore } from "@/lib/theme";
import { formatUsd, formatPct } from "@/lib/format";

const NAV_ITEMS = [
  { href: "/network", label: "Global Network", icon: Compass },
  { href: "/decision", label: "Decision Workspace", icon: Sliders },
  { href: "/ports", label: "Port Intelligence", icon: Anchor },
  { href: "/status", label: "Data / Model", icon: Gauge },
];

const GROUP_ORDER: SearchResultItem["type"][] = ["port", "route", "origin", "vessel_class"];
const GROUP_LABEL: Record<SearchResultItem["type"], string> = {
  port: "Ports",
  route: "Routes",
  origin: "Overseas Origins",
  vessel_class: "Vessel Classes",
};

function TickerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-[10.5px] uppercase tracking-wider text-base-500">{label}</span>
      <span className="font-mono text-[12.5px] font-medium tabular-nums text-base-100">{value}</span>
    </div>
  );
}

function StatusTicker() {
  const stats = useNetworkStats();

  return (
    <div className="border-b border-base-100/[0.06] bg-base-900/70">
      <div className="mx-auto flex h-8 max-w-[1680px] items-center gap-5 overflow-x-auto px-6 text-[12.5px]">
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="status-dot bg-risk-low" />
          <span className="text-[10.5px] uppercase tracking-wider text-base-500">Prototype Desk</span>
        </div>
        <span className="h-3 w-px shrink-0 bg-base-100/10" />
        <TickerStat label="East Coast Ports" value={stats.loading ? "…" : String(stats.portCount)} />
        <TickerStat label="Active Lanes" value={stats.loading ? "…" : String(stats.laneCount)} />
        <TickerStat label="High-Risk Ports" value={stats.loading ? "…" : String(stats.highRiskPortCount)} />
        <TickerStat label="Lanes ↓ (8wk)" value={stats.loading ? "…" : String(stats.decreasingLaneCount)} />
        {stats.demoLaneRate != null && (
          <>
            <span className="h-3 w-px shrink-0 bg-base-100/10" />
            <TickerStat
              label="Newcastle→Paradip Ref."
              value={`${formatUsd(stats.demoLaneRate, { maximumFractionDigits: 2 })}/t`}
            />
            {stats.demoLaneTrendPct != null && (
              <TickerStat label="8wk Δ" value={formatPct(stats.demoLaneTrendPct)} />
            )}
          </>
        )}
        <span className="ml-auto shrink-0 text-[10.5px] uppercase tracking-wider text-base-500/70">
          Reference &amp; synthetic data — see Data / Model Status
        </span>
      </div>
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const setDraft = useWorkspaceStore((s) => s.setDraft);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  // The server always renders "light" (it has no access to localStorage),
  // so the Sun/Moon icon - a real structural DOM difference, not just an
  // attribute - must also render identically on the client's first pass or
  // hydration fails. Gate on `mounted` (flips true in an effect, after
  // hydration) so both passes agree, then swap to the real icon a moment
  // later - the standard pattern for theme toggles.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .search(query)
        .then((r) => {
          setResults(r.results);
          setOpen(true);
        })
        .catch(() => setResults([]));
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  // Dispatch on the backend's own `action` field (VIEW_PORT_INTELLIGENCE /
  // FOCUS_MAP_ORIGIN / VIEW_VESSEL_CLASS / OPEN_DECISION_WORKSPACE) rather
  // than re-deriving navigation from `type` client-side, so the API stays
  // the source of truth for "where does this result go."
  function handleSelect(item: SearchResultItem) {
    setOpen(false);
    setQuery("");
    switch (item.action) {
      case "VIEW_PORT_INTELLIGENCE":
        router.push(`/ports/${item.code}`);
        break;
      case "OPEN_DECISION_WORKSPACE":
        router.push(`/decision?route=${item.code}`);
        break;
      case "FOCUS_MAP_ORIGIN":
        router.push(`/network?focus=origin&code=${item.code}`);
        break;
      case "VIEW_VESSEL_CLASS":
        // No standalone vessel-class page exists in this prototype - the closest
        // real destination is the Decision Workspace's optional vessel override,
        // prefilled with this class so the Vessel Optimizer evaluates it directly.
        setDraft({ vesselCode: item.code });
        router.push("/decision?vessel=1");
        break;
      default:
        router.push("/decision");
    }
  }

  const grouped = GROUP_ORDER.map((type) => ({
    type,
    label: GROUP_LABEL[type],
    items: results.filter((r) => r.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <header className="sticky top-0 z-40 bg-base-950/95 backdrop-blur">
      <div className="border-b border-base-100/[0.06]">
        <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-6 px-6">
          <Link href="/network" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded border border-accent-gold/30 bg-accent-gold/10">
              <Ship className="h-3.5 w-3.5 text-accent-gold" strokeWidth={2} />
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold tracking-tight text-base-100">Freight Intelligence</div>
              <div className="text-[10px] uppercase tracking-widest text-base-500">SIH26006 · Prototype</div>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || (item.href !== "/network" && pathname?.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active ? "bg-base-100/[0.06] text-base-100" : "text-base-500 hover:bg-base-100/[0.04] hover:text-base-100"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div ref={boxRef} className="relative ml-auto w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-base-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setOpen(true)}
              placeholder="Search ports, routes, vessel classes..."
              className="w-full rounded border border-base-100/[0.08] bg-base-900 py-1.5 pl-9 pr-3 text-[13px] text-base-100 placeholder:text-base-500 focus:border-accent-gold/40 focus:outline-none focus:ring-1 focus:ring-accent-gold/30"
            />
            {open && results.length > 0 && (
              <div className="absolute right-0 top-full mt-2 max-h-[70vh] w-96 overflow-y-auto rounded border border-base-100/[0.08] bg-base-850 shadow-2xl">
                {grouped.map((g) => (
                  <div key={g.type}>
                    <div className="sticky top-0 bg-base-800/95 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-500">
                      {g.label}
                    </div>
                    {g.items.map((r, i) => (
                      <button
                        key={`${r.type}-${r.code}-${i}`}
                        onClick={() => handleSelect(r)}
                        className="flex w-full items-center justify-between gap-3 border-b border-base-100/[0.04] px-4 py-2.5 text-left last:border-b-0 hover:bg-base-100/[0.04]"
                      >
                        <div>
                          <div className="text-[13px] text-base-100">{r.label}</div>
                          <div className="text-[11px] text-base-500">{r.subtitle}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={toggleTheme}
            title={mounted && theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle color theme"
            className="flex shrink-0 items-center justify-center rounded border border-base-100/[0.08] p-1.5 text-base-500 transition-colors hover:border-base-100/20 hover:text-base-100"
          >
            {mounted && theme === "dark" ? (
              <Sun className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <Moon className="h-3.5 w-3.5" strokeWidth={2} />
            )}
          </button>

          <button
            onClick={() => {
              setDraft({});
              router.push("/decision?demo=1");
            }}
            className="flex shrink-0 items-center gap-1.5 rounded bg-accent-gold/15 px-3 py-1.5 text-[13px] font-semibold text-accent-gold ring-1 ring-accent-gold/30 transition-colors hover:bg-accent-gold/25"
          >
            <Radar className="h-3.5 w-3.5" />
            Demo Mode
          </button>
        </div>
      </div>
      <StatusTicker />
    </header>
  );
}
