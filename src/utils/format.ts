import type { Currency } from "../types/stocks";

export const upside = (price: number | null, target: number | null): number | null =>
  target != null && price != null && price > 0 ? ((target - price) / price) * 100 : null;

const symbol = (c: Currency): string => (c === "EUR" ? "€" : "$");

export const formatPrice = (v: number | null, currency: Currency = "USD"): string => {
  if (v == null) return "—";
  const s = symbol(currency);
  if (v >= 1000) return `${s}${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `${s}${v.toFixed(2)}`;
};

export const formatPe = (v: number | null): string => (v == null ? "—" : `${v.toFixed(1)}×`);

export const formatPct = (v: number | null): string =>
  v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

export const gainColor = (v: number | null): { color?: string } =>
  v == null ? {} : v >= 0 ? { color: "#22c55e" } : { color: "#ef4444" };

const pad = (n: number) => String(n).padStart(2, "0");

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

export const formatDateTime = (iso: string | undefined | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
