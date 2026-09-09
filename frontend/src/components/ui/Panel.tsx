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
      className={clsx(
        "rounded-xl border border-white/[0.06] bg-base-850/60 shadow-panel backdrop-blur-sm",
        className
      )}
    >
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
          <div>
            {title && <h2 className="text-[13px] font-semibold uppercase tracking-wider text-base-500">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-base-500/80">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      <div className="p-5">{children}</div>
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
  accent?: "cyan" | "amber" | "rose" | "blue";
}) {
  const accentCls = {
    cyan: "text-accent-cyan",
    amber: "text-accent-amber",
    rose: "text-accent-rose",
    blue: "text-accent-blue",
  }[accent || "cyan"];

  return (
    <div className="rounded-lg border border-white/[0.06] bg-base-900/60 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-base-500">{label}</div>
      <div className={clsx("mt-1 text-xl font-semibold tabular-nums", accentCls)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-base-500/70">{sub}</div>}
    </div>
  );
}
