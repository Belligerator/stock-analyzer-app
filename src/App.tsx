import { useEffect, useMemo, useState } from "react";
import type { NotesFile, Stock, StocksDataset } from "./types/stocks";
import { Header } from "./components/Header";
import { SectorFilter } from "./components/SectorFilter";
import { StockTable } from "./components/StockTable";
import { Legend } from "./components/Legend";
import { StockModal } from "./components/StockModal";
import { DataEditorModal } from "./components/DataEditorModal";
import { CopyPromptButton } from "./components/CopyPromptButton";
import {
  NOTES_KEY,
  STOCKS_KEY,
  clearOverride,
  loadOverride,
  saveOverride,
  type Override,
} from "./utils/storage";

const STOCKS_URL = `${import.meta.env.BASE_URL}data/stocks.json`;
const NOTES_URL = `${import.meta.env.BASE_URL}data/notes.json`;

function validateStocksDataset(obj: unknown): string | null {
  if (typeof obj !== "object" || obj === null) return "JSON musí být objekt.";
  const o = obj as Partial<StocksDataset>;
  if (!Array.isArray(o.stocks)) return "Chybí pole `stocks` (array).";
  if (typeof o.dataAsOf !== "string") return "Chybí `dataAsOf` (string).";
  return null;
}

function validateNotesFile(obj: unknown): string | null {
  if (typeof obj !== "object" || obj === null) return "JSON musí být objekt.";
  const o = obj as Partial<NotesFile>;
  if (typeof o.notes !== "object" || o.notes === null || Array.isArray(o.notes)) {
    return "Chybí `notes` (objekt ticker → string).";
  }
  for (const [k, v] of Object.entries(o.notes)) {
    if (typeof v !== "string") return `Hodnota pro '${k}' musí být string.`;
  }
  return null;
}

export default function App() {
  const [data, setData] = useState<StocksDataset | null>(null);
  const [notesFile, setNotesFile] = useState<NotesFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<Stock | null>(null);

  const [stocksOverride, setStocksOverride] = useState<Override | null>(() => loadOverride(STOCKS_KEY));
  const [notesOverride, setNotesOverride] = useState<Override | null>(() => loadOverride(NOTES_KEY));
  const [showStocksEditor, setShowStocksEditor] = useState(false);
  const [showNotesEditor, setShowNotesEditor] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadStocks = async (): Promise<StocksDataset> => {
      if (stocksOverride) {
        try {
          const parsed = JSON.parse(stocksOverride.json) as StocksDataset;
          if (validateStocksDataset(parsed) === null) return parsed;
        } catch {
          /* fall through */
        }
      }
      const r = await fetch(STOCKS_URL);
      if (!r.ok) throw new Error(`stocks.json HTTP ${r.status}`);
      return (await r.json()) as StocksDataset;
    };

    const loadNotes = async (): Promise<NotesFile> => {
      if (notesOverride) {
        try {
          const parsed = JSON.parse(notesOverride.json) as NotesFile;
          if (validateNotesFile(parsed) === null) return parsed;
        } catch {
          /* fall through */
        }
      }
      try {
        const r = await fetch(NOTES_URL);
        if (r.ok) return (await r.json()) as NotesFile;
      } catch {
        /* ignore */
      }
      return { generatedAt: null, notes: {} };
    };

    Promise.all([loadStocks(), loadNotes()])
      .then(([stocks, nf]) => {
        if (cancelled) return;
        setData(stocks);
        setNotesFile(nf);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [stocksOverride, notesOverride]);

  const sanitizedNotes = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [ticker, note] of Object.entries(notesFile?.notes ?? {})) {
      if (typeof note === "string" && note.trim().length > 0) out[ticker] = note;
    }
    return out;
  }, [notesFile]);

  const mergedStocks = useMemo(() => {
    if (!data) return [];
    return data.stocks.map(s => (sanitizedNotes[s.ticker] ? { ...s, note: sanitizedNotes[s.ticker] } : s));
  }, [data, sanitizedNotes]);

  const sectors = useMemo(
    () => (data ? ["All", ...Array.from(new Set(data.stocks.map(s => s.sector)))] : ["All"]),
    [data]
  );

  const filtered = useMemo(
    () => (filter === "All" ? mergedStocks : mergedStocks.filter(s => s.sector === filter)),
    [mergedStocks, filter]
  );

  const stocksJsonPretty = useMemo(() => (data ? JSON.stringify(data, null, 2) : ""), [data]);
  const notesJsonPretty = useMemo(
    () => (notesFile ? JSON.stringify(notesFile, null, 2) : JSON.stringify({ generatedAt: null, notes: {} }, null, 2)),
    [notesFile]
  );

  const btn: React.CSSProperties = {
    background: "transparent",
    border: "1px solid #2a3a4a",
    borderRadius: 4,
    color: "#b8c5d6",
    padding: "6px 12px",
    fontSize: 11,
    fontFamily: "inherit",
    cursor: "pointer",
  };

  const activeBtn: React.CSSProperties = {
    ...btn,
    color: "#60a5fa",
    borderColor: "rgba(59,130,246,.4)",
    background: "rgba(59,130,246,.08)",
  };

  const headerButtons = (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={() => setShowStocksEditor(true)}
        style={stocksOverride ? activeBtn : btn}
        title={stocksOverride ? "Aktivní vlastní data" : "Upravit stocks.json"}
      >
        Data {stocksOverride && <span style={{ marginLeft: 4 }}>●</span>}
      </button>
      <button
        onClick={() => setShowNotesEditor(true)}
        style={notesOverride ? activeBtn : btn}
        title={notesOverride ? "Aktivní vlastní poznámky" : "AI poznámky"}
      >
        AI poznámky {notesOverride && <span style={{ marginLeft: 4 }}>●</span>}
      </button>
    </div>
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
            <Header dataAsOf={data.dataAsOf} sources={data.sources} rightSlot={headerButtons} />
            <SectorFilter sectors={sectors} value={filter} onChange={setFilter} />
            <StockTable stocks={filtered} onSelect={setSelected} />
            <Legend disclaimer={data.disclaimer} />
          </>
        )}
      </div>
      <StockModal stock={selected} onClose={() => setSelected(null)} />

      <DataEditorModal
        isOpen={showStocksEditor}
        onClose={() => setShowStocksEditor(false)}
        title="Vlastní stocks.json"
        hint="Vlož sem obsah stocks.json (např. z Python scriptu). Data se uloží do prohlížeče a apka je bude používat místo výchozího souboru."
        currentJson={stocksJsonPretty}
        override={stocksOverride}
        validateParsed={validateStocksDataset}
        onSave={json => setStocksOverride(saveOverride(STOCKS_KEY, json))}
        onReset={() => {
          clearOverride(STOCKS_KEY);
          setStocksOverride(null);
        }}
      />

      <DataEditorModal
        isOpen={showNotesEditor}
        onClose={() => setShowNotesEditor(false)}
        title="Vlastní notes.json (AI poznámky)"
        hint="Zkopíruj AI prompt, pošli ho Claudovi spolu s aktuálními daty, výstup vlož do textarey níže a ulož."
        currentJson={notesJsonPretty}
        override={notesOverride}
        validateParsed={validateNotesFile}
        onSave={json => setNotesOverride(saveOverride(NOTES_KEY, json))}
        onReset={() => {
          clearOverride(NOTES_KEY);
          setNotesOverride(null);
        }}
        toolbar={<CopyPromptButton stocksJson={stocksJsonPretty} />}
      />
    </div>
  );
}
