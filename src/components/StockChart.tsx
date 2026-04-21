'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceArea, Tooltip, XAxis, YAxis } from 'recharts';
import type { Currency } from '../types/stocks';
import { formatPrice } from '../utils/format';
import s from './StockChart.module.css';

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
  const sym = CURRENCY_SYMBOL[currency];
  if (v >= 1000) return `${sym}${Math.round(v / 100) / 10}k`;
  if (v >= 100) return `${sym}${Math.round(v)}`;
  return `${sym}${v.toFixed(0)}`;
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
    <div className={s.tooltipBox}>
      <div className={s.tooltipDate}>{formatTooltipDate(p.date)}</div>
      <div className={s.tooltipPrice}>{formatPrice(p.close, currency)}</div>
    </div>
  );
}

function RangeSlider({
  max,
  defaultStart,
  defaultEnd,
  onChange,
}: {
  max: number;
  defaultStart: number;
  defaultEnd: number;
  onChange: (start: number, end: number) => void;
}) {
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  // always call the latest onChange without RAF capturing a stale closure
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const readValues = () => {
    const a = Number(startRef.current?.value ?? defaultStart);
    const b = Number(endRef.current?.value ?? defaultEnd);
    return { start: Math.min(a, b), end: Math.max(a, b) };
  };

  const handleInput = () => {
    // 1. Update fill synchronously via DOM — zero re-renders
    if (fillRef.current && max > 0) {
      const { start, end } = readValues();
      fillRef.current.style.left = `${(start / max) * 100}%`;
      fillRef.current.style.right = `${100 - (end / max) * 100}%`;
    }
    // 2. Throttle React state update to one per animation frame (~60fps)
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const { start, end } = readValues();
      onChangeRef.current(start, end);
    });
  };

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const startPct = max > 0 ? (defaultStart / max) * 100 : 0;
  const endPct = max > 0 ? (defaultEnd / max) * 100 : 100;

  return (
    <div className={s.sliderTrack}>
      <div ref={fillRef} className={s.sliderFill} style={{ left: `${startPct}%`, right: `${100 - endPct}%` }} />
      <input
        ref={startRef}
        type="range"
        className={s.sliderInput}
        min={0}
        max={max}
        defaultValue={defaultStart}
        style={{ zIndex: defaultStart > max / 2 ? 4 : 3 }}
        onInput={handleInput}
      />
      <input
        ref={endRef}
        type="range"
        className={s.sliderInput}
        min={0}
        max={max}
        defaultValue={defaultEnd}
        style={{ zIndex: defaultEnd < max / 2 ? 4 : 3 }}
        onInput={handleInput}
      />
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
    if (data.length < 2) return { color: '#60a5fa', gradientId: `grad-${ticker}-neutral` };
    const first = data[0].close;
    const last = data[data.length - 1].close;
    const up = last >= first;
    return { color: up ? '#22c55e' : '#ef4444', gradientId: `grad-${ticker}-${up ? 'up' : 'down'}` };
  }, [data, ticker]);

  const xTickCount = period === 'max' ? 6 : period === '5y' || period === '3y' ? 5 : 4;
  const hasData = data.length > 0;
  const canRender = hasData && width > 0;
  const showLoading = loading;
  const showError = !loading && !!error;
  const showEmpty = !loading && !error && !hasData;

  const [selection, setSelection] = useState<{ startIdx: number; endIdx: number } | null>(null);
  const [sliderOpen, setSliderOpen] = useState(false);
  const [sliderKey, setSliderKey] = useState(0);
  const [sliderDefaults, setSliderDefaults] = useState({ start: 0, end: 0 });
  const isDraggingRef = useRef(false);

  useEffect(() => {
    setSelection(null);
    setSliderOpen(false);
  }, [period, ticker]);

  const openSlider = () => {
    if (data.length < 2) return;
    const n = data.length;
    const start = Math.floor(n * 0.25);
    const end = Math.floor(n * 0.75);
    setSliderDefaults({ start, end });
    setSliderKey((k) => k + 1);
    setSelection({ startIdx: start, endIdx: end });
    setSliderOpen(true);
  };

  const closeSlider = () => {
    setSliderOpen(false);
    setSelection(null);
  };

  const handleSliderChange = (start: number, end: number) => {
    if (start !== end) setSelection({ startIdx: start, endIdx: end });
  };

  const normalizedSelection = useMemo(() => {
    if (!selection) return null;
    const a = Math.min(selection.startIdx, selection.endIdx);
    const b = Math.max(selection.startIdx, selection.endIdx);
    if (a === b) return null;
    if (a < 0 || b < 0 || a >= data.length || b >= data.length) return null;
    return { startIdx: a, endIdx: b };
  }, [selection, data.length]);

  const selectionStats = useMemo(() => {
    if (!normalizedSelection || data.length < 2) return null;
    const start = data[normalizedSelection.startIdx];
    const end = data[normalizedSelection.endIdx];
    if (!start || !end) return null;
    const diff = end.close - start.close;
    const pct = start.close !== 0 ? (diff / start.close) * 100 : 0;
    return {
      startDate: start.date,
      endDate: end.date,
      startPrice: start.close,
      endPrice: end.close,
      diff,
      pct,
      color: diff >= 0 ? '#22c55e' : '#ef4444',
    };
  }, [normalizedSelection, data]);

  type ChartMouseEvent = { activeTooltipIndex?: number | string | null } | null | undefined;
  const toIdx = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  const handleChartDown = (state: ChartMouseEvent) => {
    const idx = toIdx(state?.activeTooltipIndex);
    if (idx == null) return;
    isDraggingRef.current = true;
    setSelection({ startIdx: idx, endIdx: idx });
  };
  const handleChartMove = (state: ChartMouseEvent) => {
    if (!isDraggingRef.current) return;
    const idx = toIdx(state?.activeTooltipIndex);
    if (idx == null) return;
    setSelection((prev) => (prev ? { ...prev, endIdx: idx } : { startIdx: idx, endIdx: idx }));
  };
  const handleChartUp = () => {
    isDraggingRef.current = false;
  };

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
    return { currentPrice: last, deltaAbs: diff, deltaPct: pct, deltaColor: diff >= 0 ? '#22c55e' : '#ef4444' };
  }, [data]);

  const formatSignedPrice = (v: number) => `${v >= 0 ? '+' : '-'}${formatPrice(Math.abs(v), currency)}`;
  const formatSignedPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

  return (
    <div className={s.chart}>
      <div className={s.priceHeader}>
        <div className={s.currentPrice}>{currentPrice != null ? formatPrice(currentPrice, currency) : '—'}</div>
        {deltaAbs != null && deltaPct != null && (
          <div style={{ fontSize: 12, color: deltaColor, fontWeight: 500 }}>
            {formatSignedPrice(deltaAbs)} ({formatSignedPct(deltaPct)})
          </div>
        )}
      </div>

      <div className={s.periodButtons}>
        {PERIOD_OPTIONS.map((opt) => {
          const active = opt.key === period;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPeriod(opt.key)}
              className={s.periodBtn}
              style={{
                border: `1px solid ${active ? '#3b82f6' : '#22303d'}`,
                background: active ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: active ? '#93c5fd' : '#94a3b8',
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {selectionStats && (
        <div className={s.selectionBox} style={{ border: `1px solid ${selectionStats.color}` }}>
          <div className={s.selectionHeader}>
            <span className={s.selectionDate}>
              {formatTooltipDate(selectionStats.startDate)} → {formatTooltipDate(selectionStats.endDate)}
            </span>
            <button type="button" onClick={closeSlider} aria-label="Zavřít výběr" className={s.selectionCloseBtn}>
              ×
            </button>
          </div>
          <div style={{ color: selectionStats.color, fontWeight: 600 }}>
            {selectionStats.diff >= 0 ? '+' : '−'}
            {formatPrice(Math.abs(selectionStats.diff), currency)} ({selectionStats.pct >= 0 ? '+' : ''}
            {selectionStats.pct.toFixed(2)}%)
          </div>
          <div className={s.selectionRange}>
            {formatPrice(selectionStats.startPrice, currency)} → {formatPrice(selectionStats.endPrice, currency)}
          </div>
        </div>
      )}

      <div ref={containerRef} className={s.chartContainer} tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
        {showLoading && <div className={`${s.stateOverlay} ${s.stateOverlayLoading}`}>Načítám…</div>}
        {showError && <div className={`${s.stateOverlay} ${s.stateOverlayError}`}>Chyba: {error}</div>}
        {showEmpty && <div className={`${s.stateOverlay} ${s.stateOverlayEmpty}`}>Žádná data pro tento rozsah.</div>}
        {canRender && (
          <div className={s.chartTouch}>
            <AreaChart
              width={width}
              height={CHART_HEIGHT}
              data={data}
              margin={{ top: 6, right: 8, left: 0, bottom: 0 }}
              onMouseDown={handleChartDown}
              onMouseMove={handleChartMove}
              onMouseUp={handleChartUp}
              onMouseLeave={handleChartUp}
            >
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
              {!normalizedSelection && (
                <Tooltip
                  content={<ChartTooltip currency={currency} />}
                  cursor={{ stroke: '#334155', strokeDasharray: '3 3' }}
                />
              )}
              <Area
                type="monotone"
                dataKey="close"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                activeDot={normalizedSelection ? false : { r: 3, strokeWidth: 0, fill: color }}
              />
              {normalizedSelection && selectionStats && (
                <ReferenceArea
                  x1={data[normalizedSelection.startIdx].date}
                  x2={data[normalizedSelection.endIdx].date}
                  strokeOpacity={0}
                  fill={selectionStats.color}
                  fillOpacity={0.12}
                />
              )}
            </AreaChart>
          </div>
        )}
      </div>

      {/* Mobile range slider — hidden on desktop via CSS */}
      <div className={s.sliderSection}>
        {sliderOpen ? (
          <div className={s.sliderWrap}>
            <div className={s.sliderHeader}>
              <span>Vybrat rozsah</span>
              <button type="button" onClick={closeSlider} className={s.sliderCloseBtn}>
                Zrušit
              </button>
            </div>
            <RangeSlider
              key={sliderKey}
              max={data.length - 1}
              defaultStart={sliderDefaults.start}
              defaultEnd={sliderDefaults.end}
              onChange={handleSliderChange}
            />
          </div>
        ) : (
          <button type="button" onClick={openSlider} disabled={!hasData} className={s.sliderToggleBtn}>
            Vybrat rozsah
          </button>
        )}
      </div>
    </div>
  );
}
