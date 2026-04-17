import { useEffect, useState } from "react";
import type { Override } from "../utils/storage";
import { formatSavedAt } from "../utils/storage";

interface DataEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  hint: string;
  currentJson: string;
  override: Override | null;
  validateParsed: (obj: unknown) => string | null;
  onSave: (json: string) => void;
  onReset: () => void;
  toolbar?: React.ReactNode;
}

export function DataEditorModal({
  isOpen,
  onClose,
  title,
  hint,
  currentJson,
  override,
  validateParsed,
  onSave,
  onReset,
  toolbar,
}: DataEditorModalProps) {
  const [value, setValue] = useState(currentJson);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(currentJson);
      setError(null);
    }
  }, [isOpen, currentJson]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch (e) {
      setError(`Neplatný JSON: ${(e as Error).message}`);
      return;
    }
    const err = validateParsed(parsed);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onSave(value);
    onClose();
  };

  const btn: React.CSSProperties = {
    background: "transparent",
    border: "1px solid #2a3a4a",
    borderRadius: 4,
    color: "#b8c5d6",
    padding: "7px 14px",
    fontSize: 11,
    fontFamily: "inherit",
    cursor: "pointer",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.65)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 16px",
        zIndex: 1000,
        overflowY: "auto",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          background: "#0c1017",
          border: "1px solid #1c2533",
          borderRadius: 8,
          padding: 20,
          fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace",
          color: "#b8c5d6",
          boxShadow: "0 20px 60px rgba(0,0,0,.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e8edf3", marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 11, color: "#778899", lineHeight: 1.5 }}>{hint}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Zavřít"
            style={{ ...btn, width: 28, height: 28, padding: 0, fontSize: 14 }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            padding: "8px 10px",
            borderRadius: 4,
            fontSize: 10,
            background: override ? "rgba(59,130,246,.08)" : "rgba(148,163,184,.06)",
            border: `1px solid ${override ? "rgba(59,130,246,.22)" : "#1c2533"}`,
            color: override ? "#93c5fd" : "#778899",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span>
            {override
              ? `Vlastní data uložena ${formatSavedAt(override.savedAt)}`
              : "Používá se výchozí datový soubor z public/data/"}
          </span>
          {override && (
            <button
              onClick={() => {
                onReset();
                onClose();
              }}
              style={{ ...btn, padding: "3px 8px", fontSize: 10, color: "#93c5fd", borderColor: "rgba(59,130,246,.35)" }}
            >
              Vrátit na default
            </button>
          )}
        </div>

        {toolbar && <div style={{ marginTop: 12 }}>{toolbar}</div>}

        <textarea
          value={value}
          onChange={e => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: 320,
            marginTop: 12,
            padding: 10,
            background: "#070a10",
            border: "1px solid #1c2533",
            borderRadius: 4,
            color: "#d0d8e4",
            fontFamily: "inherit",
            fontSize: 11,
            lineHeight: 1.5,
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />

        {error && (
          <div
            style={{
              marginTop: 8,
              padding: "8px 10px",
              background: "rgba(239,68,68,.08)",
              border: "1px solid rgba(239,68,68,.3)",
              borderRadius: 4,
              fontSize: 11,
              color: "#f87171",
              whiteSpace: "pre-wrap",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={btn}>
            Zrušit
          </button>
          <button
            onClick={handleSave}
            style={{
              ...btn,
              background: "rgba(34,197,94,.12)",
              borderColor: "rgba(34,197,94,.35)",
              color: "#22c55e",
            }}
          >
            Uložit
          </button>
        </div>
      </div>
    </div>
  );
}
