import { useState } from "react";
import { buildFullPrompt } from "../constants/prompt";

interface Props {
  stocksJson: string;
}

type State = "idle" | "copied" | "error";

export function CopyPromptButton({ stocksJson }: Props) {
  const [state, setState] = useState<State>("idle");

  const handleCopy = async () => {
    try {
      const full = buildFullPrompt(stocksJson);
      await navigator.clipboard.writeText(full);
      setState("copied");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 2500);
  };

  const label =
    state === "copied" ? "✓ Zkopírováno do schránky"
    : state === "error" ? "✗ Nepovedlo se zkopírovat"
    : "Zkopírovat AI prompt (včetně stocks.json)";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "rgba(59,130,246,.06)",
        border: "1px solid rgba(59,130,246,.2)",
        borderRadius: 4,
      }}
    >
      <div style={{ fontSize: 11, color: "#b8c5d6", lineHeight: 1.5 }}>
        Zkopíruj prompt, pošli ho Claudovi, výstup vlož níže.
      </div>
      <button
        onClick={handleCopy}
        style={{
          background: state === "copied" ? "rgba(34,197,94,.12)" : "rgba(59,130,246,.15)",
          border: `1px solid ${state === "copied" ? "rgba(34,197,94,.35)" : "rgba(59,130,246,.35)"}`,
          color: state === "copied" ? "#22c55e" : "#60a5fa",
          borderRadius: 4,
          padding: "7px 12px",
          fontSize: 11,
          fontFamily: "inherit",
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {label}
      </button>
    </div>
  );
}
