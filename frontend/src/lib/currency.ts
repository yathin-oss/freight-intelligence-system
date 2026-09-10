import type { Currency } from "./currencyStore";

// Fixed, approximate rate for display purposes only - not a live FX feed.
// All figures are stored/computed in USD; conversion happens only here, at
// render time.
export const USD_TO_INR = 83.5;

export function convert(usdValue: number, currency: Currency): number {
  return currency === "INR" ? usdValue * USD_TO_INR : usdValue;
}

export function formatCurrency(usdValue: number, currency: Currency, opts: Intl.NumberFormatOptions = {}): string {
  const value = convert(usdValue, currency);
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    ...opts,
  }).format(value);
}

export function formatRatePerTonne(usdPerTonne: number, currency: Currency): string {
  return `${formatCurrency(usdPerTonne, currency, { maximumFractionDigits: 2 })}/t`;
}
