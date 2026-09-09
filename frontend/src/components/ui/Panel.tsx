import clsx from "clsx";
import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  right,
  children,
  className,
  id,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={clsx("rounded border border-base-100/[0.08] bg-base-850", className)}
    >
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-base-100/[0.08] px-4 py-2.5">
          <div>
            {title && <h2 className="text-[12px] font-semibold uppercase tracking-wider text-base-500">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-base-500/80">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "gold" | "amber" | "rose" | "blue";
}) {
  const accentCls = {
    gold: "text-accent-gold",
    amber: "text-accent-amber",
    rose: "text-accent-rose",
    blue: "text-accent-blue",
  }[accent || "gold"];

  return (
    <div className="rounded border border-base-100/[0.08] bg-base-900 px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-base-500">{label}</div>
      <div className={clsx("mt-1 font-mono text-lg font-semibold tabular-nums", accentCls)}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-base-500/70">{sub}</div>}
    </div>
  );
}
