"use client";

interface SectorFilterProps {
  sectors: string[];
  value: string;
  onChange: (sector: string) => void;
}

export function SectorFilter({ sectors, value, onChange }: SectorFilterProps) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
      {sectors.map(s => {
        const active = value === s;
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            style={{
              padding: "4px 10px",
              fontSize: 10,
              borderRadius: 3,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all .15s",
              border: active ? "1px solid #3b82f6" : "1px solid #1c2533",
              background: active ? "rgba(59,130,246,.12)" : "rgba(12,16,23,.6)",
              color: active ? "#60a5fa" : "#778899",
            }}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
