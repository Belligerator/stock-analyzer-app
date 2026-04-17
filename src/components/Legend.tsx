interface LegendProps {
  disclaimer?: string;
}

export function Legend({ disclaimer }: LegendProps) {
  if (!disclaimer) return null;

  return (
    <div
      style={{
        marginTop: 14,
        padding: 12,
        background: "rgba(17,24,34,.5)",
        borderRadius: 6,
        border: "1px solid #1c2533",
        fontSize: 9,
        color: "#778899",
        lineHeight: 1.6,
      }}
    >
      ⚠ {disclaimer}
    </div>
  );
}
