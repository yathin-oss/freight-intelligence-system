"use client";

import { useEffect, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel, StatTile } from "@/components/ui/Panel";
import { DataStatusBadge, TrendBadge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { convert, formatRatePerTonne } from "@/lib/currency";
import { useCurrencyStore } from "@/lib/currencyStore";
import { useThemeStore } from "@/lib/themeStore";
import type { ForecastOut } from "@/types/api";

interface ChartRow {
  date: string;
  historical?: number;
  forecast?: number;
  band?: [number, number];
}

export function ForecastPanel({ forecast, originCode, cargoType }: { forecast: ForecastOut; originCode: string; cargoType: string }) {
  const [history, setHistory] = useState<{ date: string; rate_usd_per_tonne: number }[]>([]);
  const { currency } = useCurrencyStore();
  const { theme } = useThemeStore();
  const gridStroke = theme === "light" ? "rgba(15,20,30,0.08)" : "rgba(255,255,255,0.06)";
  const tooltipBg = theme === "light" ? "#f5f7fa" : "#0d121a";
  const tooltipBorder = theme === "light" ? "rgba(15,20,30,0.12)" : "rgba(255,255,255,0.1)";
  const refLineStroke = theme === "light" ? "rgba(15,20,30,0.18)" : "rgba(255,255,255,0.15)";

  useEffect(() => {
    api
      .freightRateHistory(originCode, cargoType, 26)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [originCode, cargoType]);

  const historyRows: ChartRow[] = history.map((r) => ({ date: r.date, historical: convert(r.rate_usd_per_tonne, currency) }));
  const forecastRows: ChartRow[] = forecast.forecast.map((p) => ({
    date: p.date,
    forecast: convert(p.predicted_rate, currency),
    band: [convert(p.lower, currency), convert(p.upper, currency)],
  }));

  // bridge point so the forecast line connects visually to the last historical point
  const currentRateConverted = convert(forecast.current_rate, currency);
  const bridge: ChartRow = { date: forecast.current_rate_date, historical: currentRateConverted, forecast: currentRateConverted, band: [currentRateConverted, currentRateConverted] };
  const data = [...historyRows.filter((h) => h.date !== bridge.date), bridge, ...forecastRows];

  return (
    <Panel
      id="freight-forecast"
      title="Section 2 · Freight Forecast"
      subtitle={forecast.method_note}
      right={<DataStatusBadge status={forecast.data_status} />}
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Current / Reference Rate" value={formatRatePerTonne(forecast.current_rate, currency)} sub={forecast.current_rate_date} />
        <StatTile label="Trend" value={<TrendBadge trend={forecast.trend} />} sub={`${forecast.trend_pct > 0 ? "+" : ""}${forecast.trend_pct.toFixed(1)}% over horizon`} accent="amber" />
        <StatTile label="Confidence" value={`${Math.round(forecast.confidence * 100)}%`} sub={`model: ${forecast.model_version}`} accent="cyan" />
        <StatTile label="Volatility" value={forecast.volatility.toUpperCase()} sub={`${forecast.forecast.length}-week horizon`} accent="rose" />
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#7a8aa8" }} minTickGap={40} />
            <YAxis tick={{ fontSize: 10, fill: "#7a8aa8" }} domain={["auto", "auto"]} unit="" />
            <Tooltip
              contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#7a8aa8" }}
              formatter={(value: any, name: string) => [
                `${currency === "INR" ? "₹" : "$"}${Number(value).toFixed(2)}/t`,
                name === "historical" ? "Actual" : "Forecast",
              ]}
            />
            <ReferenceLine x={forecast.current_rate_date} stroke={refLineStroke} strokeDasharray="4 4" />
            <Area
              dataKey="band"
              stroke="none"
              fill="#4c8dff"
              fillOpacity={0.12}
              connectNulls
              isAnimationActive={false}
              activeDot={false}
              legendType="none"
            />
            <Line type="monotone" dataKey="historical" stroke="#7a8aa8" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="forecast" stroke="#3dd6c8" strokeWidth={2.5} strokeDasharray="0" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-base-500">
        <LegendDot color="#7a8aa8" label="Historical (actual/reference)" />
        <LegendDot color="#3dd6c8" label="Model forecast" />
        <LegendDot color="#4c8dff" label="Confidence band" />
      </div>
    </Panel>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
