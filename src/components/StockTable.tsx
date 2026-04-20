'use client';

import { useState } from 'react';
import type { Stock } from '../types/stocks';
import { upside, formatPrice, formatPe, formatPct, gainColor } from '../utils/format';
import s from './StockTable.module.css';

type SortKey = 'ticker' | 'name' | 'price' | 'fwdPe' | 'gain52w' | 'upside' | 'cons';

interface Column {
  key: SortKey;
  label: string;
  align: 'left' | 'right' | 'center';
}

const columns: Column[] = [
  { key: 'ticker', label: 'Ticker', align: 'left' },
  { key: 'name', label: 'Název', align: 'left' },
  { key: 'price', label: 'Cena', align: 'right' },
  { key: 'fwdPe', label: 'Fwd P/E', align: 'right' },
  { key: 'gain52w', label: '52W', align: 'right' },
  { key: 'upside', label: 'Upside', align: 'right' },
  { key: 'cons', label: 'Rating', align: 'center' },
];

interface StockTableProps {
  stocks: Stock[];
  onSelect: (stock: Stock) => void;
}

export function StockTable({ stocks, onSelect }: StockTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('ticker');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [hoverTicker, setHoverTicker] = useState<string | null>(null);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(1);
    }
  };

  const valueFor = (st: Stock, k: SortKey): string | number | null => {
    if (k === 'upside') return upside(st.price, st.avgTarget);
    return st[k];
  };

  const sorted = [...stocks].sort((a, b) => {
    const va = valueFor(a, sortKey);
    const vb = valueFor(b, sortKey);
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * sortDir;
    return ((va as number) - (vb as number)) * sortDir;
  });

  const ratingStyle = (cons: Stock['cons']): React.CSSProperties => {
    if (cons === 'Strong Buy')
      return { background: 'rgba(34,197,94,.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,.25)' };
    if (cons === 'Hold')
      return { background: 'rgba(148,163,184,.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,.2)' };
    if (cons === 'Sell' || cons === 'Strong Sell')
      return { background: 'rgba(239,68,68,.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,.25)' };
    return { background: 'rgba(250,204,21,.08)', color: '#eab308', border: '1px solid rgba(250,204,21,.2)' };
  };

  return (
    <div className={s.wrap}>
      <table className={s.table}>
        <thead className={s.thead}>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                className={s.th}
                style={{ textAlign: c.align }}
              >
                {c.label}{' '}
                <span style={{ opacity: sortKey === c.key ? 1 : 0.25 }}>
                  {sortKey === c.key ? (sortDir === 1 ? '▲' : '▼') : '↕'}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((st, i) => {
            const u = upside(st.price, st.avgTarget);
            const fwdColor =
              st.fwdPe == null ? '#b8c5d6' : st.fwdPe < 25 ? '#22c55e' : st.fwdPe > 35 ? '#f59e0b' : '#b8c5d6';
            const hovered = hoverTicker === st.ticker;
            const rowBg = hovered ? 'rgba(59,130,246,.08)' : i % 2 === 0 ? 'rgba(17,24,34,.4)' : 'transparent';
            return (
              <tr
                key={st.ticker}
                onClick={() => onSelect(st)}
                onMouseEnter={() => setHoverTicker(st.ticker)}
                onMouseLeave={() => setHoverTicker(null)}
                title={st.note ? 'Klikni pro detail (obsahuje poznámku)' : 'Klikni pro detail'}
                className={s.row}
                style={{ background: rowBg }}
              >
                <td className={s.tdTicker}>
                  {st.ticker}
                  {st.note && <span title="Obsahuje poznámku" className={s.noteDot} />}
                </td>
                <td className={s.tdName}>
                  {st.name}
                  {st.currency === 'EUR' ? ' (€)' : ''}
                </td>
                <td className={s.tdPrice}>{formatPrice(st.price, st.currency)}</td>
                <td className={s.tdNum} style={{ color: fwdColor }}>
                  {formatPe(st.fwdPe)}
                </td>
                <td className={s.tdNum} style={gainColor(st.gain52w)}>
                  {formatPct(st.gain52w)}
                </td>
                <td className={s.tdNum} style={gainColor(u)}>
                  {u != null ? formatPct(u) : '—'}
                </td>
                <td className={s.tdCenter}>
                  <span className={s.badge} style={ratingStyle(st.cons)}>
                    {st.cons}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
