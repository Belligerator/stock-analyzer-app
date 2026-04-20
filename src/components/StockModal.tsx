'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Stock } from '../types/stocks';
import { formatDateTime, formatPe, formatPct, formatPrice, upside } from '../utils/format';
import { StockChart } from './StockChart';
import { SelectionLookup } from './SelectionLookup';
import s from './StockModal.module.css';

interface StockModalProps {
  stock: Stock | null;
  onClose: () => void;
}

const GOOD = '#22c55e';
const WARN = '#f59e0b';
const BAD = '#ef4444';

function colorPe(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v < 15) return GOOD;
  if (v < 30) return undefined;
  if (v < 50) return WARN;
  return BAD;
}

function colorFwdPe(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v < 20) return GOOD;
  if (v < 30) return undefined;
  if (v < 40) return WARN;
  return BAD;
}

function colorPeg(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v < 1) return GOOD;
  if (v < 2) return undefined;
  if (v < 3) return WARN;
  return BAD;
}

function colorDe(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v < 0.5) return GOOD;
  if (v < 1.5) return undefined;
  if (v < 2.5) return WARN;
  return BAD;
}

function colorMargin(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v >= 20) return GOOD;
  if (v >= 10) return undefined;
  if (v >= 0) return WARN;
  return BAD;
}

function colorRoe(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v >= 20) return GOOD;
  if (v >= 10) return undefined;
  if (v >= 0) return WARN;
  return BAD;
}

function colorRevenueGrowth(v: number | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v >= 15) return GOOD;
  if (v >= 0) return undefined;
  if (v >= -10) return WARN;
  return BAD;
}

function colorAnalysts(n: number | null | undefined): string | undefined {
  if (n == null) return undefined;
  if (n >= 15) return GOOD;
  if (n >= 5) return undefined;
  return WARN;
}

function colorTargetRange(ratio: number | null): string | undefined {
  if (ratio == null) return undefined;
  if (ratio < 1.5) return GOOD;
  if (ratio < 2) return undefined;
  if (ratio < 3) return WARN;
  return BAD;
}

function colorGain52w(v: number | null): string | undefined {
  if (v == null) return undefined;
  if (v >= 20) return GOOD;
  if (v >= 0) return undefined;
  if (v >= -20) return WARN;
  return BAD;
}

function colorUpside(v: number | null): string | undefined {
  if (v == null) return undefined;
  if (v >= 15) return GOOD;
  if (v >= 0) return undefined;
  if (v >= -10) return WARN;
  return BAD;
}

const NEUTRAL = '#e8edf3';

type ScaleItem = { color: string; label: string };
type TooltipData = { text: string; scale?: ScaleItem[] };

const TOOLTIPS: Record<string, TooltipData> = {
  price: { text: 'Aktuální tržní cena akcie.' },
  pe: {
    text: 'Poměr ceny k zisku za posledních 12 měsíců (TTM). Říká, kolik platíš za 1 dolar zisku. Nižší = levnější, ale může značit problémy.',
    scale: [
      { color: GOOD, label: '< 15 levné' },
      { color: NEUTRAL, label: '15–30 fér' },
      { color: WARN, label: '30–50 drahé' },
      { color: BAD, label: '> 50 velmi drahé' },
    ],
  },
  fwdPe: {
    text: 'P/E počítané z odhadovaného zisku v příštích 12 měsících. Lépe odráží budoucí valuaci než historické P/E.',
    scale: [
      { color: GOOD, label: '< 20 levné' },
      { color: NEUTRAL, label: '20–30 fér' },
      { color: WARN, label: '30–40 drahé' },
      { color: BAD, label: '> 40 velmi drahé' },
    ],
  },
  marketCap: { text: 'Celková tržní hodnota firmy = cena × počet akcií. Zobrazeno v miliardách USD.' },
  peg: {
    text: 'P/E dělené očekávaným ročním růstem zisku. Bere v potaz růst. PEG < 1 = potenciálně podhodnoceno.',
    scale: [
      { color: GOOD, label: '< 1 podhodnoceno' },
      { color: NEUTRAL, label: '1–2 fér' },
      { color: WARN, label: '2–3 drahé' },
      { color: BAD, label: '> 3 předražené' },
    ],
  },
  de: {
    text: 'Dluh dělený vlastním kapitálem. Kolik dluhu firma nese na 1 dolar vlastního kapitálu. Nad 2 = výrazné zadlužení.',
    scale: [
      { color: GOOD, label: '< 0,5 nízký dluh' },
      { color: NEUTRAL, label: '0,5–1,5 v pořádku' },
      { color: WARN, label: '1,5–2,5 vyšší dluh' },
      { color: BAD, label: '> 2,5 rizikové' },
    ],
  },
  gain52w: {
    text: 'Procentuální změna ceny akcie za posledních 52 týdnů (1 rok). Kladné číslo = akcie za rok zdražila.',
    scale: [
      { color: GOOD, label: '≥ +20 % silný růst' },
      { color: NEUTRAL, label: '0 až +20 %' },
      { color: WARN, label: '−20 až 0 %' },
      { color: BAD, label: '< −20 % propad' },
    ],
  },
  revenueYoY: {
    text: 'Meziroční změna tržeb (příjmů firmy). Kladné = firma roste, záporné = tržby klesají.',
    scale: [
      { color: GOOD, label: '≥ +15 % rychlý růst' },
      { color: NEUTRAL, label: '0 až +15 %' },
      { color: WARN, label: '−10 až 0 % pokles' },
      { color: BAD, label: '< −10 % výrazný pokles' },
    ],
  },
  profitMargin: {
    text: 'Čistý zisk jako procento tržeb. Kolik centů zisku zbyde z každého dolaru příjmu. Vyšší = efektivnější firma.',
    scale: [
      { color: GOOD, label: '≥ 20 % výborná' },
      { color: NEUTRAL, label: '10–20 % slušná' },
      { color: WARN, label: '0–10 % slabá' },
      { color: BAD, label: '< 0 % ztráta' },
    ],
  },
  roe: {
    text: 'Výnosnost vlastního kapitálu. Kolik čistého zisku firma generuje na 1 dolar kapitálu akcionářů. Vyšší = lepší.',
    scale: [
      { color: GOOD, label: '≥ 20 % výborná' },
      { color: NEUTRAL, label: '10–20 % slušná' },
      { color: WARN, label: '0–10 % slabá' },
      { color: BAD, label: '< 0 % ztráta' },
    ],
  },
  avgTarget: { text: 'Průměrný (mediánový) cílový kurz akcie podle analytiků Wall Street na příštích 12 měsíců.' },
  upside: {
    text: 'Potenciál růstu od aktuální ceny k cílovému kurzu analytiků. Kladné = analytici čekají zdražení.',
    scale: [
      { color: GOOD, label: '≥ +15 % velký prostor' },
      { color: NEUTRAL, label: '0 až +15 %' },
      { color: WARN, label: '−10 až 0 % nadhodnoceno' },
      { color: BAD, label: '< −10 % výrazně nad cílem' },
    ],
  },
  numAnalysts: {
    text: 'Počet analytiků Wall Street, kteří aktivně sledují a hodnotí tuto akcii.',
    scale: [
      { color: GOOD, label: '≥ 15 široké pokrytí' },
      { color: NEUTRAL, label: '5–15 průměrné' },
      { color: WARN, label: '< 5 málo dat' },
    ],
  },
  targetLow: { text: 'Nejnižší cílový kurz ze všech analytiků. Představuje pesimistický scénář.' },
  targetHigh: { text: 'Nejvyšší cílový kurz ze všech analytiků. Představuje optimistický scénář.' },
  targetRange: {
    text: 'Poměr Target High / Target Low. Čím vyšší, tím větší neshoda mezi analytiky — větší nejistota ohledně vývoje akcie.',
    scale: [
      { color: GOOD, label: '< 1,5× shoda' },
      { color: NEUTRAL, label: '1,5–2× mírná neshoda' },
      { color: WARN, label: '2–3× velká neshoda' },
      { color: BAD, label: '> 3× extrémní nejistota' },
    ],
  },
};

function TooltipIcon({ id }: { id: string }) {
  const [show, setShow] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const data = TOOLTIPS[id];

  const openTip = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setAnchor({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
    setShow(true);
  };

  useEffect(() => {
    if (!show) return;
    let active = false;
    const arm = setTimeout(() => {
      active = true;
    }, 120);
    const onDown = (e: Event) => {
      if (!active) return;
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (tipRef.current?.contains(target)) return;
      setShow(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShow(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(arm);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [show]);

  if (!data) return null;

  const TIP_W = 240;
  const MARGIN = 8;
  const TIP_H_ESTIMATE = data.scale ? 200 : 110;
  let tipLeft = 0;
  let tipTop = 0;
  if (anchor && typeof window !== 'undefined') {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    tipLeft = Math.min(Math.max(MARGIN, anchor.x - TIP_W / 2), vw - TIP_W - MARGIN);
    tipTop = anchor.y;
    if (tipTop + TIP_H_ESTIMATE > vh - MARGIN) {
      tipTop = Math.max(MARGIN, anchor.y - TIP_H_ESTIMATE - 18);
    }
  }

  return (
    <>
      <span
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          if (show) setShow(false);
          else openTip();
        }}
        className={s.tipIcon}
      >
        ?
      </span>
      {show &&
        anchor &&
        typeof document !== 'undefined' &&
        createPortal(
          <div ref={tipRef} className={s.tipPopup} style={{ left: tipLeft, top: tipTop }}>
            <div>{data.text}</div>
            {data.scale && (
              <div className={s.tipScale}>
                {data.scale.map((item) => (
                  <div key={item.label} className={s.tipScaleItem}>
                    <span className={s.tipScaleDot} style={{ background: item.color }} />
                    <span className={s.tipScaleLabel}>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function Metric({
  label,
  value,
  color,
  tooltipId,
}: {
  label: string;
  value: string;
  color?: string;
  tooltipId?: string;
}) {
  return (
    <div>
      <div className={s.metricLabel}>
        {label}
        {tooltipId && <TooltipIcon id={tooltipId} />}
      </div>
      <div className={s.metricValue} style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function formatMarketCap(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v >= 1000) return `$${(v / 1000).toFixed(2)}T`;
  return `$${v.toFixed(2)}B`;
}

function formatRatio(v: number | null | undefined): string {
  return v == null ? '—' : v.toFixed(2);
}

function ratingBadge(cons: Stock['cons']): React.CSSProperties {
  if (cons === 'Strong Buy')
    return { background: 'rgba(34,197,94,.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,.3)' };
  if (cons === 'Hold')
    return { background: 'rgba(148,163,184,.12)', color: '#94a3b8', border: '1px solid rgba(148,163,184,.25)' };
  if (cons === 'Sell' || cons === 'Strong Sell')
    return { background: 'rgba(239,68,68,.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,.25)' };
  return { background: 'rgba(250,204,21,.1)', color: '#eab308', border: '1px solid rgba(250,204,21,.22)' };
}

const RATING_COLORS = {
  strongBuy: '#22c55e',
  buy: '#86efac',
  hold: '#94a3b8',
  sell: '#f87171',
  strongSell: '#ef4444',
};

function AnalystBreakdown({ bd }: { bd: NonNullable<Stock['analystBreakdown']> }) {
  const total = bd.strongBuy + bd.buy + bd.hold + bd.sell + bd.strongSell;
  if (total === 0) return null;

  const weightedMean = (bd.strongBuy * 1 + bd.buy * 2 + bd.hold * 3 + bd.sell * 4 + bd.strongSell * 5) / total;
  const markerPct = ((weightedMean - 1) / 4) * 100;

  const bars = [
    { key: 'strongBuy' as const, label: 'Strong Buy', count: bd.strongBuy },
    { key: 'buy' as const, label: 'Buy', count: bd.buy },
    { key: 'hold' as const, label: 'Hold', count: bd.hold },
    { key: 'sell' as const, label: 'Sell', count: bd.sell },
    { key: 'strongSell' as const, label: 'Strong Sell', count: bd.strongSell },
  ];

  return (
    <div className={s.analystWrap}>
      <div className={s.analystStacked}>
        {bars.map((b) =>
          b.count > 0 ? (
            <div
              key={b.key}
              title={`${b.label}: ${b.count}`}
              style={{ flex: b.count, background: RATING_COLORS[b.key], transition: 'flex .3s' }}
            />
          ) : null,
        )}
      </div>
      <div className={s.analystLegend}>
        {bars.map((b) =>
          b.count > 0 ? (
            <div key={b.key} className={s.analystLegendItem}>
              <div className={s.analystLegendDot} style={{ background: RATING_COLORS[b.key] }} />
              <span className={s.analystLegendName}>{b.label}</span>
              <span className={s.analystLegendCount}>{b.count}</span>
            </div>
          ) : null,
        )}
      </div>
      <div className={s.analystScale}>
        <div className={s.analystScaleLabels}>
          <span>Strong Buy</span>
          <span>Buy</span>
          <span>Hold</span>
          <span>Sell</span>
          <span>Strong Sell</span>
        </div>
        <div className={s.analystScaleBar}>
          <div className={s.analystMarker} style={{ left: `${markerPct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function StockModal({ stock, onClose }: StockModalProps) {
  const noteRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!stock) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [stock, onClose]);

  if (!stock) return null;

  const u = upside(stock.price, stock.avgTarget);

  return (
    <div onClick={onClose} className={s.overlay}>
      <div onClick={(e) => e.stopPropagation()} className={s.panel}>
        {/* Header */}
        <div className={s.header}>
          <div>
            <div className={s.titleRow}>
              <span className={s.ticker}>{stock.ticker}</span>
              <span className={s.name}>{stock.name}</span>
            </div>
            <div className={s.subRow}>
              <span>{stock.sector}</span>
              <span>·</span>
              <span>{stock.currency}</span>
              <span>·</span>
              <span className={s.badge} style={ratingBadge(stock.cons)}>
                {stock.cons}
              </span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Zavřít" className={s.closeBtn}>
            ×
          </button>
        </div>

        {/* Vývoj ceny */}
        <div className={s.chartWrap}>
          <StockChart ticker={stock.ticker} currency={stock.currency} />
        </div>

        {/* Cena & valuace */}
        <div className={s.sectionTitle}>Cena a valuace</div>
        <div className={s.grid3}>
          <Metric label="Cena" value={formatPrice(stock.price, stock.currency)} tooltipId="price" />
          <Metric label="P/E (TTM)" value={formatPe(stock.pe)} tooltipId="pe" color={colorPe(stock.pe)} />
          <Metric label="Fwd P/E" value={formatPe(stock.fwdPe)} tooltipId="fwdPe" color={colorFwdPe(stock.fwdPe)} />
          <Metric label="Market Cap" value={formatMarketCap(stock.marketCap)} tooltipId="marketCap" />
          <Metric label="PEG" value={formatRatio(stock.peg)} tooltipId="peg" color={colorPeg(stock.peg)} />
          <Metric
            label="D/E"
            value={formatRatio(stock.debtToEquity)}
            tooltipId="de"
            color={colorDe(stock.debtToEquity)}
          />
        </div>

        {/* Výkonnost */}
        <div className={s.sectionTitle}>Výkonnost</div>
        <div className={s.grid3}>
          <Metric
            label="52W"
            value={formatPct(stock.gain52w)}
            color={colorGain52w(stock.gain52w)}
            tooltipId="gain52w"
          />
          <Metric
            label="Revenue YoY"
            value={formatPct(stock.revenueGrowthYoY ?? null)}
            color={colorRevenueGrowth(stock.revenueGrowthYoY)}
            tooltipId="revenueYoY"
          />
          <Metric
            label="Profit Margin"
            value={formatPct(stock.profitMargin ?? null)}
            color={colorMargin(stock.profitMargin)}
            tooltipId="profitMargin"
          />
          <Metric label="ROE" value={formatPct(stock.roe ?? null)} color={colorRoe(stock.roe)} tooltipId="roe" />
        </div>

        {/* Analytici */}
        <div className={s.sectionTitle}>Analytici</div>
        <div className={s.grid3}>
          <Metric
            label="Avg Target"
            value={formatPrice(stock.avgTarget ?? null, stock.currency)}
            tooltipId="avgTarget"
          />
          <Metric label="Upside" value={u != null ? formatPct(u) : '—'} color={colorUpside(u)} tooltipId="upside" />
          <Metric
            label="Počet analytiků"
            value={stock.numAnalysts != null ? String(stock.numAnalysts) : '—'}
            color={colorAnalysts(stock.numAnalysts)}
            tooltipId="numAnalysts"
          />
          <Metric
            label="Target Low"
            value={formatPrice(stock.targetLow ?? null, stock.currency)}
            tooltipId="targetLow"
          />
          <Metric
            label="Target High"
            value={formatPrice(stock.targetHigh ?? null, stock.currency)}
            tooltipId="targetHigh"
          />
          <Metric
            label="Rozpětí"
            value={
              stock.targetHigh != null && stock.targetLow != null && stock.targetLow > 0
                ? `${(stock.targetHigh / stock.targetLow).toFixed(2)}×`
                : '—'
            }
            tooltipId="targetRange"
            color={colorTargetRange(
              stock.targetHigh != null && stock.targetLow != null && stock.targetLow > 0
                ? stock.targetHigh / stock.targetLow
                : null,
            )}
          />
        </div>
        {stock.analystBreakdown && <AnalystBreakdown bd={stock.analystBreakdown} />}

        {/* Poznámka */}
        {stock.note && (
          <>
            <div className={s.sectionTitle}>Poznámka</div>
            <div ref={noteRef} className={s.noteBox}>
              {stock.note}
            </div>
            <SelectionLookup containerRef={noteRef} context={stock.note} />
            <div className={s.noteDisclaimer}>
              Generováno AI. Nejedná se o investiční doporučení ani nabídku ke koupi či prodeji cenných papírů. Pouze
              informativní účel.
            </div>
            {stock.newsSources && stock.newsSources.length > 0 && (
              <div className={s.newsSection}>
                <div className={s.newsLabel}>Zdroje z Yahoo (recent news)</div>
                <ol className={s.newsList}>
                  {stock.newsSources.map((n, i) => {
                    const date = n.publishedAt
                      ? new Date(n.publishedAt).toLocaleDateString('cs-CZ', {
                          day: 'numeric',
                          month: 'numeric',
                          year: 'numeric',
                        })
                      : '';
                    const shortTitle = n.title.length > 70 ? n.title.slice(0, 70) + '…' : n.title;
                    return (
                      <li key={`${i}-${n.link}`}>
                        <a href={n.link} target="_blank" rel="noreferrer" title={n.title} className={s.newsLink}>
                          {n.publisher || 'Zdroj'}
                          {date ? ` (${date})` : ''}
                        </a>
                        {n.title && <span className={s.newsSnippet}>— {shortTitle}</span>}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </>
        )}

        {/* Metadata */}
        <div className={s.sectionTitle}>Metadata</div>
        <div className={s.meta}>
          <div>
            <span className={s.metaKey}>Aktualizováno:</span> {formatDateTime(stock.updatedAt)}
          </div>
          {stock.sources && stock.sources.length > 0 && (
            <div>
              <span className={s.metaKey}>Zdroje:</span>{' '}
              {stock.sources.map((src, i) => (
                <span key={src}>
                  {i > 0 ? ', ' : ''}
                  <a href={src} target="_blank" rel="noreferrer" className={s.metaLink}>
                    {src.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
