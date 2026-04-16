import { formatDate } from "../utils/format";

interface HeaderProps {
  dataAsOf: string;
  sources: string[];
}

export function Header({ dataAsOf, sources }: HeaderProps) {
  return (
    <div style={{ marginBottom: 20, borderBottom: "1px solid #1c2533", paddingBottom: 14 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "#e8edf3", margin: 0 }}>
        Akciový přehled — {formatDate(dataAsOf)}
      </h1>
      <p style={{ fontSize: 10, color: "#556677", marginTop: 4 }}>
        {sources.map(s => s.replace(/^https?:\/\//, "").replace(/\/$/, "")).join(" · ")} — Dassault v EUR, ostatní USD
      </p>
    </div>
  );
}
