'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { Currency } from '../types/stocks';
import { formatPrice } from '../utils/format';

type Period = '1m' | 'ytd' | '1y' | '3y' | '5y' | 'max';

interface StockChartProps {
  ticker: string;
  currency: Currency;
}

interface PricePoint {
  date: string;
  close: number;
}

const CHART_HEIGHT = 200;

const PERIOD_OPTIONS: Array<{ key: Period; label: string }> = [
  { key: '1m', label: '1M' },
  { key: 'ytd', label: 'YTD' },
  { key: '1y', label: '1R' },
  { key: '3y', label: '3R' },
  { key: '5y', label: '5R' },
  { key: 'max', label: 'MAX' },
];

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: '$', EUR: '€' };

function formatTooltipDate(ymd: string): string {
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatAxisDate(ymd: string, period: Period): string {
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  const [y, m, d] = parts;
  if (period === '1m') return `${parseInt(d, 10)}.${parseInt(m, 10)}.`;
  if (period === 'ytd' || period === '1y') return `${parseInt(m, 10)}/${y.slice(2)}`;
  return y;
}

function formatAxisPrice(v: number, currency: Currency): string {
  const s = CURRENCY_SYMBOL[currency];
  if (v >= 1000) return `${s}${Math.round(v / 100) / 10}k`;
  if (v >= 100) return `${s}${Math.round(v)}`;
  return `${s}${v.toFixed(0)}`;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PricePoint }>;
  currency: Currency;
}

function ChartTooltip({ active, payload, currency }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div
      style={{
        background: 'rgba(10, 18, 28, 0.95)',
        border: '1px solid #223344',
        borderRadius: 4,
        padding: '6px 10px',
        fontSize: 11,
        color: '#cfd8e3',
      }}
    >
      <div style={{ color: '#778899', fontSize: 10 }}>{formatTooltipDate(p.date)}</div>
      <div style={{ color: '#e5ecf5', fontWeight: 500 }}>{formatPrice(p.close, currency)}</div>
    </div>
  );
}

export function StockChart({ ticker, currency }: StockChartProps) {
  const [period, setPeriod] = useState<Period>('1y');
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/stock-chart?ticker=${encodeURIComponent(ticker)}&period=${period}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: { prices?: PricePoint[] }) => {
        if (cancelled) return;
        setData(Array.isArray(j.prices) ? j.prices : []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ticker, period]);

  const { color, gradientId } = useMemo(() => {
    if (data.length < 2) {
      return { color: '#60a5fa', gradientId: `grad-${ticker}-neutral` };
    }
    const first = data[0].close;
    const last = data[data.length - 1].close;
    const up = last >= first;
    return {
      color: up ? '#22c55e' : '#ef4444',
      gradientId: `grad-${ticker}-${up ? 'up' : 'down'}`,
    };
  }, [data, ticker]);

  const xTickCount = period === 'max' ? 6 : period === '5y' || period === '3y' ? 5 : 4;
  const hasData = data.length > 0;
  const canRender = hasData && width > 0;
  const showLoading = loading;
  const showError = !loading && !!error;
  const showEmpty = !loading && !error && !hasData;

  const { currentPrice, deltaAbs, deltaPct, deltaColor } = useMemo(() => {
    if (data.length < 2) {
      return {
        currentPrice: null as number | null,
        deltaAbs: null as number | null,
        deltaPct: null as number | null,
        deltaColor: '#94a3b8',
      };
    }
    const first = data[0].close;
    const last = data[data.length - 1].close;
    const diff = last - first;
    const pct = first !== 0 ? (diff / first) * 100 : 0;
    return {
      currentPrice: last,
      deltaAbs: diff,
      deltaPct: pct,
      deltaColor: diff >= 0 ? '#22c55e' : '#ef4444',
    };
  }, [data]);

  const formatSignedPrice = (v: number) => {
    const sign = v >= 0 ? '+' : '-';
    return `${sign}${formatPrice(Math.abs(v), currency)}`;
  };
  const formatSignedPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

  return (
    <div className="stock-chart" style={{ outline: 'none' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600, color: '#e5ecf5', letterSpacing: '.02em' }}>
          {currentPrice != null ? formatPrice(currentPrice, currency) : '—'}
        </div>
        {deltaAbs != null && deltaPct != null && (
          <div style={{ fontSize: 12, color: deltaColor, fontWeight: 500 }}>
            {formatSignedPrice(deltaAbs)} ({formatSignedPct(deltaPct)})
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {PERIOD_OPTIONS.map((opt) => {
          const active = opt.key === period;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPeriod(opt.key)}
              style={{
                fontSize: 10,
                padding: '4px 10px',
                borderRadius: 4,
                border: `1px solid ${active ? '#3b82f6' : '#22303d'}`,
                background: active ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: active ? '#93c5fd' : '#94a3b8',
                cursor: 'pointer',
                letterSpacing: '.04em',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div
        ref={containerRef}
        style={{
          width: '100%',
          minWidth: 0,
          height: CHART_HEIGHT,
          position: 'relative',
          outline: 'none',
        }}
        tabIndex={-1}
      >
        {showLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: '#556677',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            Načítám…
          </div>
        )}
        {showError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: '#ef4444',
              zIndex: 2,
            }}
          >
            Chyba: {error}
          </div>
        )}
        {showEmpty && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: '#556677',
              zIndex: 2,
            }}
          >
            Žádná data pro tento rozsah.
          </div>
        )}
        {canRender && (
          <AreaChart width={width} height={CHART_HEIGHT} data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1a2433" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#667788', fontSize: 10 }}
              tickFormatter={(v) => formatAxisDate(v, period)}
              stroke="#22303d"
              tickLine={false}
              minTickGap={24}
              tickCount={xTickCount}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: '#667788', fontSize: 10 }}
              tickFormatter={(v) => formatAxisPrice(v, currency)}
              stroke="#22303d"
              tickLine={false}
              width={46}
              orientation="left"
            />
            <Tooltip
              content={<ChartTooltip currency={currency} />}
              cursor={{ stroke: '#334155', strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: color }}
            />
          </AreaChart>
        )}
      </div>
    </div>
  );
}
