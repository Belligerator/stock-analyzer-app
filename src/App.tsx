import { useEffect, useMemo, useState } from "react";
import type { NotesFile, StocksDataset } from "./types/stocks";
import { Header } from "./components/Header";
import { SectorFilter } from "./components/SectorFilter";
import { StockTable } from "./components/StockTable";
import { Legend } from "./components/Legend";

const STOCKS_URL = `${import.meta.env.BASE_URL}data/stocks.json`;
const NOTES_URL = `${import.meta.env.BASE_URL}data/notes.json`;

export default function App() {
  const [data, setData] = useState<StocksDataset | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    const stocksReq = fetch(STOCKS_URL).then(r => {
      if (!r.ok) throw new Error(`stocks.json HTTP ${r.status}`);
      return r.json() as Promise<StocksDataset>;
    });

    const notesReq = fetch(NOTES_URL)
      .then(r => (r.ok ? (r.json() as Promise<NotesFile>) : { notes: {} } as NotesFile))
      .catch(() => ({ notes: {} } as NotesFile));

    Promise.all([stocksReq, notesReq])
      .then(([stocks, notesFile]) => {
        setData(stocks);
        const sanitized: Record<string, string> = {};
        for (const [ticker, note] of Object.entries(notesFile.notes ?? {})) {
          if (typeof note === "string" && note.trim().length > 0) {
            sanitized[ticker] = note;
          }
        }
        setNotes(sanitized);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const mergedStocks = useMemo(() => {
    if (!data) return [];
    return data.stocks.map(s => (notes[s.ticker] ? { ...s, note: notes[s.ticker] } : s));
  }, [data, notes]);

  const sectors = useMemo(
    () => (data ? ["All", ...Array.from(new Set(data.stocks.map(s => s.sector)))] : ["All"]),
    [data]
  );

  const filtered = useMemo(
    () => (filter === "All" ? mergedStocks : mergedStocks.filter(s => s.sector === filter)),
    [mergedStocks, filter]
  );

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
            <Legend stocks={mergedStocks} disclaimer={data.disclaimer} />
          </>
        )}
      </div>
    </div>
  );
}
