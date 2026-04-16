import type { Stock } from "../types/stocks";

interface LegendProps {
  stocks: Stock[];
  disclaimer?: string;
}

export function Legend({ stocks, disclaimer }: LegendProps) {
  const notes = stocks.filter(s => s.note);

  return (
    <div
      style={{
        marginTop: 14,
        padding: 12,
        background: "rgba(17,24,34,.5)",
        borderRadius: 6,
        border: "1px solid #1c2533",
      }}
    >
      <p style={{ fontSize: 9, color: "#556677", lineHeight: 1.6, margin: 0 }}>
        <strong style={{ color: "#778899" }}>Legenda:</strong>{" "}
        P/E = trailing 12M · Fwd P/E = odhad dalších 12M · Target = avg 12M price target analytiků · Upside = k avg targetu ·{" "}
        <span style={{ color: "#22c55e" }}>Zelená</span> Fwd PE&lt;25 ·{" "}
        <span style={{ color: "#f59e0b" }}>Žlutá</span> PE&gt;50 / Fwd PE&gt;35
        {notes.length > 0 && (
          <>
            {" · "}
            {notes.map((s, i) => (
              <span key={s.ticker}>
                {i > 0 ? " · " : ""}
                <strong style={{ color: "#778899" }}>{s.ticker}:</strong> {s.note}
              </span>
            ))}
          </>
        )}
        {disclaimer && (
          <>
            {" · "}
            <span style={{ color: "#778899" }}>⚠ {disclaimer}</span>
          </>
        )}
      </p>
    </div>
  );
}
