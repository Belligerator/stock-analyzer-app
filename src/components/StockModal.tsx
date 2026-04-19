'use client';

import { useEffect, useRef, useState } from 'react';
import type { Stock } from '../types/stocks';
import { formatDateTime, formatPe, formatPct, formatPrice, upside } from '../utils/format';
import { StockChart } from './StockChart';
import { SelectionLookup } from './SelectionLookup';

interface StockModalProps {
  stock: Stock | null;
  onClose: () => void;
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#778899',
  marginBottom: 3,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#e8edf3',
  fontWeight: 600,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 12,
  color: '#94a3b8',
  fontWeight: 600,
  marginBottom: 10,
  marginTop: 18,
  paddingBottom: 4,
  borderBottom: '1px solid #1c2533',
};

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
  const data = TOOLTIPS[id];
  if (!data) return null;
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 12,
          height: 12,
          borderRadius: '50%',
          border: '1px solid #2a3a4a',
          color: '#556677',
          fontSize: 9,
          cursor: 'help',
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        ?
      </span>
      {show && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            background: '#131e2e',
            border: '1px solid #2a3a4a',
            borderRadius: 4,
            padding: '9px 11px',
            fontSize: 10,
            color: '#b8c5d6',
            lineHeight: 1.55,
            width: 240,
            boxShadow: '0 4px 16px rgba(0,0,0,.5)',
            pointerEvents: 'none',
            whiteSpace: 'normal',
            textAlign: 'left',
          }}
        >
          <div>{data.text}</div>
          {data.scale && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: '1px solid #2a3a4a',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              {data.scale.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: s.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: '#94a3b8' }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </span>
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
      <div style={labelStyle}>
        {label}
        {tooltipId && <TooltipIcon id={tooltipId} />}
      </div>
      <div style={{ ...valueStyle, color: color ?? valueStyle.color }}>{value}</div>
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
    return {
      background: 'rgba(34,197,94,.12)',
      color: '#22c55e',
      border: '1px solid rgba(34,197,94,.3)',
    };
  if (cons === 'Hold')
    return {
      background: 'rgba(148,163,184,.12)',
      color: '#94a3b8',
      border: '1px solid rgba(148,163,184,.25)',
    };
  if (cons === 'Sell' || cons === 'Strong Sell')
    return {
      background: 'rgba(239,68,68,.12)',
      color: '#ef4444',
      border: '1px solid rgba(239,68,68,.25)',
    };
  return {
    background: 'rgba(250,204,21,.1)',
    color: '#eab308',
    border: '1px solid rgba(250,204,21,.22)',
  };
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
    <div style={{ marginTop: 12 }}>
      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 7, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
        {bars.map((b) =>
          b.count > 0 ? (
            <div
              key={b.key}
              title={`${b.label}: ${b.count}`}
              style={{
                flex: b.count,
                background: RATING_COLORS[b.key],
                transition: 'flex .3s',
              }}
            />
          ) : null,
        )}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
        {bars.map((b) =>
          b.count > 0 ? (
            <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
              <div style={{ width: 6, height: 6, borderRadius: 1, background: RATING_COLORS[b.key], flexShrink: 0 }} />
              <span style={{ color: '#778899' }}>{b.label}</span>
              <span style={{ color: '#b8c5d6', fontWeight: 600 }}>{b.count}</span>
            </div>
          ) : null,
        )}
      </div>
      {/* Consensus scale indicator */}
      <div style={{ marginTop: 10 }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#445566', marginBottom: 3 }}
        >
          <span>Strong Buy</span>
          <span>Buy</span>
          <span>Hold</span>
          <span>Sell</span>
          <span>Strong Sell</span>
        </div>
        <div
          style={{
            position: 'relative',
            height: 4,
            borderRadius: 2,
            background: 'linear-gradient(to right, #22c55e, #86efac 25%, #94a3b8 50%, #f87171 75%, #ef4444)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: `${markerPct}%`,
              transform: 'translate(-50%, -50%)',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#e8edf3',
              border: '2px solid #0c1017',
              boxShadow: '0 0 0 1px #778899',
            }}
          />
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
  const grid3: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.65)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px',
        zIndex: 1000,
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 640,
          background: '#0c1017',
          border: '1px solid #1c2533',
          borderRadius: 8,
          padding: 20,
          fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace",
          color: '#b8c5d6',
          boxShadow: '0 20px 60px rgba(0,0,0,.5)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#60a5fa' }}>{stock.ticker}</span>
              <span style={{ fontSize: 14, color: '#d0d8e4' }}>{stock.name}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10, color: '#778899' }}>
              <span>{stock.sector}</span>
              <span>·</span>
              <span>{stock.currency}</span>
              <span>·</span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 3,
                  fontSize: 9,
                  fontWeight: 600,
                  ...ratingBadge(stock.cons),
                }}
              >
                {stock.cons}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Zavřít"
            style={{
              background: 'transparent',
              border: '1px solid #1c2533',
              color: '#778899',
              borderRadius: 4,
              width: 28,
              height: 28,
              cursor: 'pointer',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>

        {/* Vývoj ceny */}
        <div style={{ marginTop: 14, marginBottom: 6 }}>
          <StockChart ticker={stock.ticker} currency={stock.currency} />
        </div>

        {/* Cena & valuace */}
        <div style={sectionTitle}>Cena a valuace</div>
        <div style={grid3}>
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
        <div style={sectionTitle}>Výkonnost</div>
        <div style={grid3}>
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
        <div style={sectionTitle}>Analytici</div>
        <div style={grid3}>
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
            <div style={sectionTitle}>Poznámka</div>
            <div
              ref={noteRef}
              style={{
                background: 'rgba(59,130,246,.06)',
                border: '1px solid rgba(59,130,246,.2)',
                borderRadius: 4,
                padding: 12,
                fontSize: 12,
                lineHeight: 1.6,
                color: '#b8c5d6',
                whiteSpace: 'pre-wrap',
              }}
            >
              {stock.note}
            </div>
            <SelectionLookup containerRef={noteRef} context={stock.note} />
            {stock.newsSources && stock.newsSources.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div
                  style={{
                    fontSize: 9,
                    color: '#556677',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '.06em',
                  }}
                >
                  Zdroje z Yahoo (recent news)
                </div>
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 10.5, lineHeight: 1.7, color: '#94a3b8' }}>
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
                        <a
                          href={n.link}
                          target="_blank"
                          rel="noreferrer"
                          title={n.title}
                          style={{ color: '#60a5fa', textDecoration: 'none' }}
                        >
                          {n.publisher || 'Zdroj'}
                          {date ? ` (${date})` : ''}
                        </a>
                        {n.title && <span style={{ color: '#556677', marginLeft: 6 }}>— {shortTitle}</span>}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </>
        )}

        {/* Metadata */}
        <div style={sectionTitle}>Metadata</div>
        <div style={{ fontSize: 10, color: '#778899', lineHeight: 1.8 }}>
          <div>
            <span style={{ color: '#556677' }}>Aktualizováno:</span> {formatDateTime(stock.updatedAt)}
          </div>
          {stock.sources && stock.sources.length > 0 && (
            <div>
              <span style={{ color: '#556677' }}>Zdroje:</span>{' '}
              {stock.sources.map((s, i) => (
                <span key={s}>
                  {i > 0 ? ', ' : ''}
                  <a href={s} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>
                    {s.replace(/^https?:\/\//, '').replace(/\/$/, '')}
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
