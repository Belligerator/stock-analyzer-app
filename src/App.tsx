import { useEffect, useMemo, useState } from "react";
import type { StocksDataset } from "./types/stocks";
import { Header } from "./components/Header";
import { SectorFilter } from "./components/SectorFilter";
import { StockTable } from "./components/StockTable";
import { Legend } from "./components/Legend";

const DATA_URL = `${import.meta.env.BASE_URL}data/stocks.json`;

export default function App() {
  const [data, setData] = useState<StocksDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    fetch(DATA_URL)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<StocksDataset>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  const sectors = useMemo(
    () => (data ? ["All", ...Array.from(new Set(data.stocks.map(s => s.sector)))] : ["All"]),
    [data]
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    return filter === "All" ? data.stocks : data.stocks.filter(s => s.sector === filter);
  }, [data, filter]);

  return (
    <div
      style={{
        fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace",
        background: "#0c1017",
        color: "#b8c5d6",
        minHeight: "100vh",
        padding: "20px 12px",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {error && (
          <div style={{ color: "#ef4444", padding: 12, fontSize: 12 }}>
            Chyba při načítání dat: {error}
          </div>
        )}
        {!data && !error && <div style={{ padding: 12, fontSize: 12 }}>Načítám data…</div>}
        {data && (
          <>
            <Header dataAsOf={data.dataAsOf} sources={data.sources} />
            <SectorFilter sectors={sectors} value={filter} onChange={setFilter} />
            <StockTable stocks={filtered} />
            <Legend stocks={data.stocks} disclaimer={data.disclaimer} />
          </>
        )}
      </div>
    </div>
  );
}
