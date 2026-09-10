"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Anchor, Compass, Moon, Radar, Search, Ship, Sliders, Sun } from "lucide-react";
import { api } from "@/lib/api";
import type { SearchResultItem } from "@/types/api";
import { useWorkspaceStore } from "@/lib/store";
import { useCurrencyStore } from "@/lib/currencyStore";
import { useThemeStore } from "@/lib/themeStore";

const NAV_ITEMS = [
  { href: "/network", label: "Global Network", icon: Compass },
  { href: "/decision", label: "Decision Workspace", icon: Sliders },
  { href: "/ports", label: "Port Intelligence", icon: Anchor },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const setDraft = useWorkspaceStore((s) => s.setDraft);
  const { currency, set: setCurrency } = useCurrencyStore();
  const { theme, toggle: toggleTheme } = useThemeStore();

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

  function handleSelect(item: SearchResultItem) {
    setOpen(false);
    setQuery("");
    if (item.type === "port") {
      router.push(`/ports/${item.code}`);
    } else if (item.type === "route") {
      router.push(`/decision?route=${item.code}`);
    } else {
      router.push("/decision");
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-base-950/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-6 px-6">
        <Link href="/network" className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-cyan/20 to-accent-blue/20 ring-1 ring-accent-cyan/30">
            <Ship className="h-4 w-4 text-accent-cyan" strokeWidth={2} />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight text-white">Freight Intelligence</div>
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
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                  active ? "bg-white/[0.06] text-white" : "text-base-500 hover:bg-white/[0.04] hover:text-base-100"
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
            className="w-full rounded-lg border border-white/[0.08] bg-base-900/80 py-2 pl-9 pr-3 text-[13px] text-base-100 placeholder:text-base-500 focus:border-accent-cyan/40 focus:outline-none focus:ring-1 focus:ring-accent-cyan/30"
          />
          {open && results.length > 0 && (
            <div className="absolute right-0 top-full mt-2 w-96 overflow-hidden rounded-lg border border-white/[0.08] bg-base-850 shadow-2xl">
              {results.map((r, i) => (
                <button
                  key={`${r.type}-${r.code}-${i}`}
                  onClick={() => handleSelect(r)}
                  className="flex w-full items-center justify-between gap-3 border-b border-white/[0.04] px-4 py-2.5 text-left last:border-b-0 hover:bg-white/[0.04]"
                >
                  <div>
                    <div className="text-[13px] text-base-100">{r.label}</div>
                    <div className="text-[11px] text-base-500">{r.subtitle}</div>
                  </div>
                  <span className="rounded bg-base-700 px-1.5 py-0.5 text-[10px] uppercase text-base-500">{r.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          title="Toggle light/dark theme"
          className="flex shrink-0 items-center justify-center rounded-lg border border-white/[0.08] p-2 text-base-500 hover:text-base-100"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        <div className="flex shrink-0 overflow-hidden rounded-lg border border-white/[0.08]" title="Display currency (all figures are computed in USD; this only converts what's shown)">
          {(["USD", "INR"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-2.5 py-2 text-[12px] font-semibold transition-colors ${
                currency === c ? "bg-accent-cyan/20 text-accent-cyan" : "bg-base-900/60 text-base-500 hover:text-base-100"
              }`}
            >
              {c === "USD" ? "$" : "₹"} {c}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setDraft({});
            router.push("/decision?demo=1");
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-cyan/15 px-3 py-2 text-[13px] font-semibold text-accent-cyan ring-1 ring-accent-cyan/30 transition-colors hover:bg-accent-cyan/25"
        >
          <Radar className="h-3.5 w-3.5" />
          Demo Mode
        </button>
      </div>
    </header>
  );
}
