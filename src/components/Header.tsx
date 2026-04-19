import { formatDate } from '../utils/format';

interface HeaderProps {
  dataAsOf: string;
  sources: string[];
  rightSlot?: React.ReactNode;
}

export function Header({ dataAsOf, sources, rightSlot }: HeaderProps) {
  return (
    <div
      style={{
        marginBottom: 20,
        borderBottom: '1px solid #1c2533',
        paddingBottom: 14,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#e8edf3', margin: 0 }}>
          Akciový přehled — {formatDate(dataAsOf)}
        </h1>
        <p style={{ fontSize: 10, color: '#556677', marginTop: 4 }}>
          {sources.map((s) => s.replace(/^https?:\/\//, '').replace(/\/$/, '')).join(' · ')}
        </p>
      </div>
      {rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}
    </div>
  );
}
