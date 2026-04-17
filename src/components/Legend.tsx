import type { Stock } from "../types/stocks";

interface LegendProps {
  stocks: Stock[];
  disclaimer?: string;
}

export function Legend({ stocks, disclaimer }: LegendProps) {
  const notes = stocks.filter(s => s.note);

  const sectionStyle: React.CSSProperties = {
    fontSize: 9,
    color: "#556677",
    lineHeight: 1.6,
    margin: 0,
  };

  const divider: React.CSSProperties = {
    border: 0,
    borderTop: "1px solid #1c2533",
    margin: "10px 0",
  };

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
      <p style={sectionStyle}>
        <strong style={{ color: "#778899" }}>Legenda:</strong>{" "}
        P/E = trailing 12M · Fwd P/E = odhad dalších 12M · Target = avg 12M price target analytiků · Upside = k avg targetu ·{" "}
        <span style={{ color: "#22c55e" }}>Zelená</span> Fwd PE&lt;25 ·{" "}
        <span style={{ color: "#f59e0b" }}>Žlutá</span> PE&gt;50 / Fwd PE&gt;35
      </p>

      {notes.length > 0 && (
        <>
          <hr style={divider} />
          <div style={sectionStyle}>
            <strong style={{ color: "#778899" }}>Poznámky:</strong>
            <ul style={{ margin: "4px 0 0", padding: "0 0 0 16px" }}>
              {notes.map(s => (
                <li key={s.ticker}>
                  <strong style={{ color: "#778899" }}>{s.ticker}:</strong> {s.note}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {disclaimer && (
        <>
          <hr style={divider} />
          <p style={sectionStyle}>
            <span style={{ color: "#778899" }}>⚠ {disclaimer}</span>
          </p>
        </>
      )}
    </div>
  );
}
