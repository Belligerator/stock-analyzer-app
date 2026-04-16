import { useState } from "react";
import type { Stock } from "../types/stocks";
import { upside, formatPrice, formatPe, formatPct, gainColor } from "../utils/format";

type SortKey = "ticker" | "name" | "price" | "pe" | "fwdPe" | "gain52w" | "avgTarget" | "upside" | "cons";

interface Column {
  key: SortKey;
  label: string;
  align: "left" | "right" | "center";
}

const columns: Column[] = [
  { key: "ticker", label: "Ticker", align: "left" },
  { key: "name", label: "Název", align: "left" },
  { key: "price", label: "Cena", align: "right" },
  { key: "pe", label: "P/E", align: "right" },
  { key: "fwdPe", label: "Fwd P/E", align: "right" },
  { key: "gain52w", label: "52W", align: "right" },
  { key: "avgTarget", label: "Target", align: "right" },
  { key: "upside", label: "Upside", align: "right" },
  { key: "cons", label: "Rating", align: "center" },
];

interface StockTableProps {
  stocks: Stock[];
}

export function StockTable({ stocks }: StockTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(1);
    }
  };

  const valueFor = (s: Stock, k: SortKey): string | number | null => {
    if (k === "upside") return upside(s.price, s.avgTarget);
    return s[k];
  };

  const sorted = [...stocks].sort((a, b) => {
    const va = valueFor(a, sortKey);
    const vb = valueFor(b, sortKey);
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * sortDir;
    return ((va as number) - (vb as number)) * sortDir;
  });

  const ratingStyle = (cons: Stock["cons"]) => {
    if (cons === "Strong Buy")
      return {
        background: "rgba(34,197,94,.1)",
        color: "#22c55e",
        border: "1px solid rgba(34,197,94,.25)",
      };
    if (cons === "Hold")
      return {
        background: "rgba(148,163,184,.1)",
        color: "#94a3b8",
        border: "1px solid rgba(148,163,184,.2)",
      };
    return {
      background: "rgba(250,204,21,.08)",
      color: "#eab308",
      border: "1px solid rgba(250,204,21,.2)",
    };
  };

  return (
    <div style={{ overflowX: "auto", borderRadius: 6, border: "1px solid #1c2533" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ background: "#111822" }}>
            {columns.map(c => (
              <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                style={{
                  padding: "8px 8px",
                  textAlign: c.align,
                  color: "#778899",
                  fontWeight: 600,
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  userSelect: "none",
                  borderBottom: "2px solid #1c2533",
                }}
              >
                {c.label}{" "}
                <span style={{ opacity: sortKey === c.key ? 1 : 0.25 }}>
                  {sortKey === c.key ? (sortDir === 1 ? "▲" : "▼") : "↕"}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => {
            const u = upside(s.price, s.avgTarget);
            const peColor = s.pe == null ? "#b8c5d6" : s.pe > 50 ? "#f59e0b" : s.pe < 20 ? "#22c55e" : "#b8c5d6";
            const fwdColor = s.fwdPe == null ? "#b8c5d6" : s.fwdPe < 25 ? "#22c55e" : s.fwdPe > 35 ? "#f59e0b" : "#b8c5d6";
            return (
              <tr
                key={s.ticker}
                title={s.note || undefined}
                style={{
                  background: i % 2 === 0 ? "rgba(17,24,34,.4)" : "transparent",
                  borderBottom: "1px solid #141c28",
                }}
              >
                <td style={{ padding: "7px 8px", fontWeight: 700, color: "#60a5fa" }}>{s.ticker}</td>
                <td style={{ padding: "7px 8px", color: "#d0d8e4" }}>
                  {s.name}
                  {s.currency === "EUR" ? " (€)" : ""}
                </td>
                <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, color: "#e8edf3" }}>
                  {formatPrice(s.price, s.currency)}
                </td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: peColor }}>{formatPe(s.pe)}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, color: fwdColor }}>
                  {formatPe(s.fwdPe)}
                </td>
                <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, ...gainColor(s.gain52w) }}>
                  {formatPct(s.gain52w)}
                </td>
                <td style={{ padding: "7px 8px", textAlign: "right" }}>
                  {formatPrice(s.avgTarget, s.currency)}
                </td>
                <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, ...gainColor(u) }}>
                  {u != null ? formatPct(u) : "—"}
                </td>
                <td style={{ padding: "7px 8px", textAlign: "center" }}>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 600,
                      ...ratingStyle(s.cons),
                    }}
                  >
                    {s.cons}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
