'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import s from './SnapshotCompareClient.module.css';

type SnapshotDoc = {
  id: string | number;
  ticker: string;
  takenAt: string;
  label?: string;
  myPrediction?: string;
  myNote?: string;
  price?: number;
  currency?: string;
  pe?: number;
  fwdPe?: number;
  peg?: number;
  gain52w?: number;
  marketCap?: number;
  evToEbitda?: number;
  revenueGrowthYoY?: number;
  earningsGrowthYoY?: number;
  grossMargin?: number;
  operatingMargin?: number;
  profitMargin?: number;
  roe?: number;
  roa?: number;
  freeCashFlow?: number;
  debtToEquity?: number;
  avgTarget?: number;
  targetHigh?: number;
  targetLow?: number;
  numAnalysts?: number;
  cons?: string;
  analystBreakdown?: {
    strongBuy?: number;
    buy?: number;
    hold?: number;
    sell?: number;
    strongSell?: number;
  };
  insiderActivity?: {
    netPercent?: number;
    buyCount?: number;
    sellCount?: number;
    period?: string;
  };
  sources?: Array<{ url?: string }>;
  note?: string;
  recentContext?: unknown;
  metricsUpdatedAt?: string;
  noteUpdatedAt?: string;
  analystLastActionDate?: string;
};

type StockDoc = SnapshotDoc & { name?: string; sector?: string };

type ListResponse<T> = { docs: T[] };

type Selection = { snapshotId: string | number | 'current' | '' };

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€' };

function fmtMoney(v: number | undefined, currency?: string): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  const sym = currency ? (CURRENCY_SYMBOL[currency] ?? '') : '';
  return `${sym}${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function fmtNum(v: number | undefined, suffix = ''): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function daysBetween(a: string, b: string): number {
  const ma = new Date(a).getTime();
  const mb = new Date(b).getTime();
  if (!Number.isFinite(ma) || !Number.isFinite(mb)) return 0;
  return Math.round(Math.abs(mb - ma) / 86_400_000);
}

function diffPct(a: number | undefined, b: number | undefined): number | null {
  if (typeof a !== 'number' || typeof b !== 'number' || a === 0) return null;
  return ((b - a) / a) * 100;
}

function diffAbs(a: number | undefined, b: number | undefined): number | null {
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  return b - a;
}

function DeltaPill({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return <span className={s.deltaMuted}>—</span>;
  const positive = invert ? pct < 0 : pct > 0;
  const zero = Math.abs(pct) < 0.01;
  const cls = zero ? s.deltaNeutral : positive ? s.deltaPositive : s.deltaNegative;
  const arrow = zero ? '•' : pct > 0 ? '▲' : '▼';
  return (
    <span className={cls}>
      {arrow} {pct > 0 ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  );
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function SnapshotCompareClient() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotDoc[]>([]);
  const [ticker, setTicker] = useState<string>('');
  const [selA, setSelA] = useState<Selection>({ snapshotId: '' });
  const [selB, setSelB] = useState<Selection>({ snapshotId: 'current' });
  const [docA, setDocA] = useState<SnapshotDoc | null>(null);
  const [docB, setDocB] = useState<SnapshotDoc | null>(null);
  const [stock, setStock] = useState<StockDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const tickerParam = url.searchParams.get('ticker');
        const json = await fetchJSON<ListResponse<SnapshotDoc>>('/api/stock-snapshots?limit=500&sort=-takenAt&depth=0');
        setSnapshots(json.docs);
        const uniq = Array.from(new Set(json.docs.map((d) => d.ticker))).sort();
        setTickers(uniq);
        if (tickerParam && uniq.includes(tickerParam.toUpperCase())) {
          setTicker(tickerParam.toUpperCase());
        } else if (uniq.length > 0) {
          setTicker(uniq[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  const tickerSnapshots = useMemo(
    () => snapshots.filter((d) => d.ticker === ticker).sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1)),
    [snapshots, ticker],
  );

  useEffect(() => {
    if (tickerSnapshots.length === 0) {
      setSelA({ snapshotId: '' });
      return;
    }
    const oldest = tickerSnapshots[tickerSnapshots.length - 1];
    setSelA({ snapshotId: oldest.id });
  }, [tickerSnapshots]);

  const loadComparison = useCallback(async () => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    setDocA(null);
    setDocB(null);
    setStock(null);
    try {
      const jobs: Promise<void>[] = [];

      if (selA.snapshotId && selA.snapshotId !== 'current') {
        jobs.push(fetchJSON<SnapshotDoc>(`/api/stock-snapshots/${selA.snapshotId}?depth=0`).then((d) => setDocA(d)));
      }
      if (selB.snapshotId && selB.snapshotId !== 'current') {
        jobs.push(fetchJSON<SnapshotDoc>(`/api/stock-snapshots/${selB.snapshotId}?depth=0`).then((d) => setDocB(d)));
      }
      // Always load the stock for header (name/sector) + current data when needed.
      jobs.push(
        fetchJSON<ListResponse<StockDoc>>(
          `/api/stocks?where[ticker][equals]=${encodeURIComponent(ticker)}&limit=1&depth=0`,
        ).then((json) => {
          const s0 = json.docs[0];
          if (s0) setStock(s0);
        }),
      );

      await Promise.all(jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [ticker, selA, selB]);

  useEffect(() => {
    if (selA.snapshotId && selB.snapshotId && ticker) {
      void loadComparison();
    }
  }, [selA, selB, ticker, loadComparison]);

  const resolvedA: SnapshotDoc | null = selA.snapshotId === 'current' ? stockToSnapshotLike(stock) : docA;
  const resolvedB: SnapshotDoc | null = selB.snapshotId === 'current' ? stockToSnapshotLike(stock) : docB;

  return (
    <div className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>Snapshot compare</h1>
        <p className={s.subtitle}>Porovnej dva snapshoty téhož tickeru, nebo snapshot vs aktuální stav akcie.</p>
      </header>

      <section className={s.controls}>
        <label className={s.field}>
          <span className={s.fieldLabel}>Ticker</span>
          <select
            className={s.select}
            value={ticker}
            onChange={(e) => {
              setTicker(e.target.value);
              setSelA({ snapshotId: '' });
              setSelB({ snapshotId: 'current' });
            }}
          >
            {tickers.length === 0 && <option value="">(žádné snapshoty)</option>}
            {tickers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className={s.field}>
          <span className={s.fieldLabel}>Snapshot A (tehdy)</span>
          <select
            className={s.select}
            value={String(selA.snapshotId)}
            onChange={(e) => setSelA({ snapshotId: e.target.value })}
          >
            <option value="">— vyber —</option>
            {tickerSnapshots.map((snap) => (
              <option key={snap.id} value={String(snap.id)}>
                {fmtDate(snap.takenAt)}
                {snap.label ? ` · ${snap.label}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className={s.field}>
          <span className={s.fieldLabel}>Snapshot B (porovnat s)</span>
          <select
            className={s.select}
            value={String(selB.snapshotId)}
            onChange={(e) => setSelB({ snapshotId: e.target.value as Selection['snapshotId'] })}
          >
            <option value="current">Aktuální stav (live)</option>
            {tickerSnapshots.map((snap) => (
              <option key={snap.id} value={String(snap.id)}>
                {fmtDate(snap.takenAt)}
                {snap.label ? ` · ${snap.label}` : ''}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && <div className={s.error}>Chyba: {error}</div>}
      {loading && <div className={s.loading}>Načítám…</div>}

      {resolvedA && resolvedB && !loading && <ComparisonView a={resolvedA} b={resolvedB} stock={stock} />}

      {!loading && !resolvedA && tickerSnapshots.length === 0 && ticker && (
        <div className={s.empty}>Žádné snapshoty pro {ticker}. Vytvoř jeden ze stránky akcie.</div>
      )}
    </div>
  );
}

function stockToSnapshotLike(stock: StockDoc | null): SnapshotDoc | null {
  if (!stock) return null;
  return {
    id: 'current',
    ticker: stock.ticker,
    takenAt: stock.metricsUpdatedAt ?? new Date().toISOString(),
    metricsUpdatedAt: stock.metricsUpdatedAt,
    noteUpdatedAt: stock.noteUpdatedAt,
    analystLastActionDate: stock.analystLastActionDate,
    label: 'Aktuální',
    price: stock.price,
    currency: stock.currency,
    pe: stock.pe,
    fwdPe: stock.fwdPe,
    peg: stock.peg,
    gain52w: stock.gain52w,
    marketCap: stock.marketCap,
    evToEbitda: stock.evToEbitda,
    revenueGrowthYoY: stock.revenueGrowthYoY,
    earningsGrowthYoY: stock.earningsGrowthYoY,
    grossMargin: stock.grossMargin,
    operatingMargin: stock.operatingMargin,
    profitMargin: stock.profitMargin,
    roe: stock.roe,
    roa: stock.roa,
    freeCashFlow: stock.freeCashFlow,
    debtToEquity: stock.debtToEquity,
    avgTarget: stock.avgTarget,
    targetHigh: stock.targetHigh,
    targetLow: stock.targetLow,
    numAnalysts: stock.numAnalysts,
    cons: stock.cons,
    analystBreakdown: stock.analystBreakdown,
    insiderActivity: stock.insiderActivity,
    sources: stock.sources,
    note: stock.note,
    recentContext: stock.recentContext,
  };
}

function ComparisonView({ a, b, stock }: { a: SnapshotDoc; b: SnapshotDoc; stock: StockDoc | null }) {
  const currency = a.currency ?? b.currency ?? stock?.currency;
  const days = daysBetween(a.takenAt, b.takenAt);
  const priceDiffAbs = diffAbs(a.price, b.price);
  const priceDiffPct = diffPct(a.price, b.price);

  const targetVsActualAbs = diffAbs(a.avgTarget, b.price);
  const targetVsActualPct = diffPct(a.avgTarget, b.price);

  return (
    <div className={s.grid}>
      <section className={s.card}>
        <h2 className={s.cardTitle}>
          {a.ticker}
          {stock?.name ? <span className={s.cardSubtitle}> · {stock.name}</span> : null}
        </h2>
        <div className={s.metaRow}>
          <div>
            <span className={s.metaLabel}>A:</span> {fmtDate(a.takenAt)}
            {a.label ? ` · ${a.label}` : ''}
          </div>
          <div className={s.arrow}>→</div>
          <div>
            <span className={s.metaLabel}>B:</span> {fmtDate(b.takenAt)}
            {b.label ? ` · ${b.label}` : ''}
          </div>
          <div className={s.metaMuted}>{days} dní</div>
        </div>
      </section>

      <section className={s.card}>
        <h3 className={s.sectionTitle}>Cena</h3>
        <div className={s.bigRow}>
          <div className={s.bigValue}>{fmtMoney(a.price, currency)}</div>
          <div className={s.arrowBig}>→</div>
          <div className={s.bigValue}>{fmtMoney(b.price, currency)}</div>
          <div className={s.deltaCol}>
            <div className={s.deltaAbs}>
              {priceDiffAbs === null ? '—' : `${priceDiffAbs > 0 ? '+' : ''}${fmtMoney(priceDiffAbs, currency)}`}
            </div>
            <DeltaPill pct={priceDiffPct} />
          </div>
        </div>
      </section>

      <section className={s.card}>
        <h3 className={s.sectionTitle}>Přesnost analytiků</h3>
        <div className={s.accuracyGrid}>
          <div>
            <div className={s.metaLabel}>Analyst target tehdy (A)</div>
            <div className={s.big}>{fmtMoney(a.avgTarget, currency)}</div>
            <div className={s.sub}>
              range {fmtMoney(a.targetLow, currency)} – {fmtMoney(a.targetHigh, currency)} · {fmtNum(a.numAnalysts)}{' '}
              analytiků
            </div>
          </div>
          <div className={s.arrowBig}>→</div>
          <div>
            <div className={s.metaLabel}>Skutečná cena (B)</div>
            <div className={s.big}>{fmtMoney(b.price, currency)}</div>
          </div>
          <div className={s.deltaCol}>
            <div className={s.deltaAbs}>
              {targetVsActualAbs === null
                ? '—'
                : targetVsActualAbs > 0
                  ? `Analytici podcenili o ${fmtMoney(Math.abs(targetVsActualAbs), currency)}`
                  : `Analytici přestřelili o ${fmtMoney(Math.abs(targetVsActualAbs), currency)}`}
            </div>
            <DeltaPill pct={targetVsActualPct} />
          </div>
        </div>

        <TargetRangeHit targetLow={a.targetLow} targetHigh={a.targetHigh} actual={b.price} currency={currency} />

        <ForecastAccuracyRow
          label="EPS forecast (via fwd P/E → trailing P/E)"
          description="Fwd P/E při A odráží očekávaný EPS. Nižší PE teď (B) = EPS překonal odhad (bullish)."
          forecast={a.fwdPe}
          actual={b.pe}
          suffix="×"
          bullishWhenLower
        />

        <div className={s.consRow}>
          <div className={s.consCell}>
            <span className={s.metaLabel}>Consensus tehdy:</span> <ConsBadge value={a.cons} /> ({fmtNum(a.numAnalysts)})
          </div>
          <div className={s.arrow}>→</div>
          <div className={s.consCell}>
            <span className={s.metaLabel}>Consensus teď:</span> <ConsBadge value={b.cons} /> ({fmtNum(b.numAnalysts)})
          </div>
        </div>

        <BreakdownBars a={a.analystBreakdown} b={b.analystBreakdown} />
      </section>

      <FreshnessPanel a={a} b={b} />

      <section className={s.card}>
        <h3 className={s.sectionTitle}>Fundamentální metriky</h3>
        <div className={s.fundGrid}>
          <FundRow label="P/E (trailing)" a={a.pe} b={b.pe} />
          <FundRow label="Forward P/E" a={a.fwdPe} b={b.fwdPe} />
          <FundRow label="EV / EBITDA" a={a.evToEbitda} b={b.evToEbitda} />
          <FundRow label="PEG" a={a.peg} b={b.peg} />
          <FundRow label="52w change" a={a.gain52w} b={b.gain52w} suffix="%" />
          <FundRow label="Market cap" a={a.marketCap} b={b.marketCap} suffix="B" />
          <FundRow label="Revenue growth YoY" a={a.revenueGrowthYoY} b={b.revenueGrowthYoY} suffix="%" />
          <FundRow label="Earnings growth YoY" a={a.earningsGrowthYoY} b={b.earningsGrowthYoY} suffix="%" />
          <FundRow label="Gross margin" a={a.grossMargin} b={b.grossMargin} suffix="%" />
          <FundRow label="Operating margin" a={a.operatingMargin} b={b.operatingMargin} suffix="%" />
          <FundRow label="Profit margin" a={a.profitMargin} b={b.profitMargin} suffix="%" />
          <FundRow label="ROE" a={a.roe} b={b.roe} suffix="%" />
          <FundRow label="ROA" a={a.roa} b={b.roa} suffix="%" />
          <FundRow label="Free cash flow" a={a.freeCashFlow} b={b.freeCashFlow} suffix="B" />
          <FundRow label="Debt / Equity" a={a.debtToEquity} b={b.debtToEquity} invertColor />
        </div>
      </section>

      {(a.insiderActivity || b.insiderActivity) && (
        <InsiderActivitySection a={a.insiderActivity} b={b.insiderActivity} />
      )}

      <section className={s.card}>
        <h3 className={s.sectionTitle}>Poznámky & predikce</h3>
        <div className={s.narrativeGrid}>
          <NarrativeBlock title="Moje predikce (A)" body={a.myPrediction} highlight />
          <NarrativeBlock title="Moje poznámka (A)" body={a.myNote} />
          <NarrativeBlock
            title="AI note (A)"
            subtitle={a.noteUpdatedAt ? fmtDate(a.noteUpdatedAt) : undefined}
            body={a.note}
          />
          <NarrativeBlock
            title="AI note (B)"
            subtitle={b.noteUpdatedAt ? fmtDate(b.noteUpdatedAt) : undefined}
            body={b.note}
          />
        </div>
      </section>

      <RecentContextPanel a={a.recentContext} b={b.recentContext} />

      <AiDiffPanel aId={String(a.id)} bId={String(b.id)} />
    </div>
  );
}

function TargetRangeHit({
  targetLow,
  targetHigh,
  actual,
  currency,
}: {
  targetLow: number | undefined;
  targetHigh: number | undefined;
  actual: number | undefined;
  currency?: string;
}) {
  if (
    typeof targetLow !== 'number' ||
    typeof targetHigh !== 'number' ||
    typeof actual !== 'number' ||
    targetLow <= 0 ||
    targetHigh <= 0
  ) {
    return null;
  }
  const below = actual < targetLow;
  const above = actual > targetHigh;
  const inside = !below && !above;
  const position = Math.max(0, Math.min(1, (actual - targetLow) / (targetHigh - targetLow)));
  const verdict = below
    ? `Pod i nejnižším targetem (−${(((targetLow - actual) / targetLow) * 100).toFixed(1)}%)`
    : above
      ? `Překonala i nejvyšší target (+${(((actual - targetHigh) / targetHigh) * 100).toFixed(1)}%)`
      : 'Uvnitř analyst range';
  const toneCls = below ? s.verdictBad : above ? s.verdictGood : s.verdictNeutral;

  return (
    <div className={s.rangeRow}>
      <div className={s.rangeHead}>
        <span className={s.metaLabel}>Umístění v A rangi</span>
        <span className={`${s.verdict} ${toneCls}`}>{verdict}</span>
      </div>
      <div className={s.rangeBar}>
        <span className={s.rangeTick}>{fmtMoney(targetLow, currency)}</span>
        <div className={s.rangeTrack}>
          <div
            className={s.rangeMarker}
            style={{ left: `${Math.max(0, Math.min(100, position * 100))}%` }}
            title={`Actual ${fmtMoney(actual, currency)}`}
          />
          {below && (
            <div
              className={s.rangeOutside}
              style={{ left: 0, transform: 'translateX(-100%)', background: '#ef4444' }}
            />
          )}
          {above && (
            <div
              className={s.rangeOutside}
              style={{ right: 0, transform: 'translateX(100%)', background: '#22c55e' }}
            />
          )}
        </div>
        <span className={s.rangeTick}>{fmtMoney(targetHigh, currency)}</span>
      </div>
      <div className={s.rangeSub}>
        actual: <strong>{fmtMoney(actual, currency)}</strong>
        {inside && position >= 0 && position <= 1 && (
          <span className={s.rangeMuted}> · {(position * 100).toFixed(0)}% od low k high</span>
        )}
      </div>
    </div>
  );
}

function ForecastAccuracyRow({
  label,
  description,
  forecast,
  actual,
  suffix = '',
  bullishWhenLower = false,
}: {
  label: string;
  description: string;
  forecast: number | undefined;
  actual: number | undefined;
  suffix?: string;
  bullishWhenLower?: boolean;
}) {
  if (typeof forecast !== 'number' || typeof actual !== 'number') return null;
  const pct = diffPct(forecast, actual);
  const bullish = bullishWhenLower ? actual < forecast : actual > forecast;
  const bearish = bullishWhenLower ? actual > forecast : actual < forecast;
  const zero = Math.abs(actual - forecast) < 0.01;
  const verdict = zero
    ? 'Shoda s forecastem'
    : bullish
      ? 'Forecast překonán (bullish)'
      : bearish
        ? 'Pod forecastem (bearish)'
        : '—';
  const toneCls = zero ? s.verdictNeutral : bullish ? s.verdictGood : s.verdictBad;

  return (
    <div className={s.accuracyRow}>
      <div className={s.accuracyHead}>
        <span className={s.metaLabel}>{label}</span>
        <span className={`${s.verdict} ${toneCls}`}>{verdict}</span>
      </div>
      <div className={s.accuracyBody}>
        <div>
          <div className={s.subTiny}>forecast (A)</div>
          <div className={s.midValue}>{fmtNum(forecast, suffix)}</div>
        </div>
        <div className={s.arrow}>→</div>
        <div>
          <div className={s.subTiny}>actual (B)</div>
          <div className={s.midValue}>{fmtNum(actual, suffix)}</div>
        </div>
        <div className={s.deltaCol}>
          <DeltaPill pct={pct} invert={bullishWhenLower} />
        </div>
      </div>
      <div className={s.accuracyHint}>{description}</div>
    </div>
  );
}

function InsiderActivitySection({ a, b }: { a: SnapshotDoc['insiderActivity']; b: SnapshotDoc['insiderActivity'] }) {
  const netA = a?.netPercent;
  const netB = b?.netPercent;
  const buyA = a?.buyCount ?? 0;
  const buyB = b?.buyCount ?? 0;
  const sellA = a?.sellCount ?? 0;
  const sellB = b?.sellCount ?? 0;
  const period = a?.period ?? b?.period ?? '6m';

  const ppDelta = typeof netA === 'number' && typeof netB === 'number' ? netB - netA : null;
  const hint =
    ppDelta == null
      ? ''
      : ppDelta > 0.5
        ? 'Insideři začali víc nakupovat (bullish posun)'
        : ppDelta < -0.5
          ? 'Insideři začali víc prodávat'
          : 'Beze změny v insider sentimentu';

  return (
    <section className={s.card}>
      <h3 className={s.sectionTitle}>Insider aktivita ({period})</h3>
      <div className={s.fundGrid}>
        <div className={s.fundRow}>
          <div className={s.fundLabel}>Net % insider shares</div>
          <div className={s.fundValue}>{typeof netA === 'number' ? `${netA.toFixed(2)}%` : '—'}</div>
          <div className={s.fundArrow}>→</div>
          <div className={s.fundValue}>{typeof netB === 'number' ? `${netB.toFixed(2)}%` : '—'}</div>
          <div className={s.fundDelta}>
            {ppDelta === null ? (
              <span className={s.deltaMuted}>—</span>
            ) : (
              <span
                className={Math.abs(ppDelta) < 0.05 ? s.deltaNeutral : ppDelta > 0 ? s.deltaPositive : s.deltaNegative}
              >
                {ppDelta > 0 ? '▲' : ppDelta < 0 ? '▼' : '•'} {ppDelta > 0 ? '+' : ''}
                {ppDelta.toFixed(2)} pp
              </span>
            )}
          </div>
        </div>
        <div className={s.fundRow}>
          <div className={s.fundLabel}>Nákupů</div>
          <div className={s.fundValue}>{buyA}</div>
          <div className={s.fundArrow}>→</div>
          <div className={s.fundValue}>{buyB}</div>
          <div className={s.fundDelta}>
            <span className={s.deltaMuted}>
              {buyB - buyA > 0 ? '+' : ''}
              {buyB - buyA}
            </span>
          </div>
        </div>
        <div className={s.fundRow}>
          <div className={s.fundLabel}>Prodejů</div>
          <div className={s.fundValue}>{sellA}</div>
          <div className={s.fundArrow}>→</div>
          <div className={s.fundValue}>{sellB}</div>
          <div className={s.fundDelta}>
            <span className={s.deltaMuted}>
              {sellB - sellA > 0 ? '+' : ''}
              {sellB - sellA}
            </span>
          </div>
        </div>
      </div>
      {hint && <div className={s.accuracyHint}>{hint}</div>}
    </section>
  );
}

function ConsBadge({ value }: { value: string | undefined }) {
  if (!value) return <span className={s.consNone}>—</span>;
  const cls =
    value === 'Strong Buy' || value === 'Buy'
      ? s.consBuy
      : value === 'Strong Sell' || value === 'Sell'
        ? s.consSell
        : s.consHold;
  return <span className={`${s.consBadge} ${cls}`}>{value}</span>;
}

function FundRow({
  label,
  a,
  b,
  suffix = '',
  invertColor = false,
}: {
  label: string;
  a: number | undefined;
  b: number | undefined;
  suffix?: string;
  invertColor?: boolean;
}) {
  const pct = diffPct(a, b);
  return (
    <div className={s.fundRow}>
      <div className={s.fundLabel}>{label}</div>
      <div className={s.fundValue}>{fmtNum(a, suffix)}</div>
      <div className={s.fundArrow}>→</div>
      <div className={s.fundValue}>{fmtNum(b, suffix)}</div>
      <div className={s.fundDelta}>
        <DeltaPill pct={pct} invert={invertColor} />
      </div>
    </div>
  );
}

function NarrativeBlock({
  title,
  subtitle,
  body,
  highlight,
}: {
  title: string;
  subtitle?: string;
  body?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`${s.narrative}`}>
      <div className={s.narrativeHead}>
        <span className={s.narrativeTitle}>{title}</span>
        {subtitle && <span className={s.narrativeSubtitle}>{subtitle}</span>}
      </div>
      <div className={s.narrativeBody}>{body ? body : <span className={s.narrativeEmpty}>(prázdné)</span>}</div>
    </div>
  );
}

function BreakdownBars({ a, b }: { a: SnapshotDoc['analystBreakdown']; b: SnapshotDoc['analystBreakdown'] }) {
  const rows = [
    { key: 'strongBuy', label: 'Strong Buy', color: '#16a34a' },
    { key: 'buy', label: 'Buy', color: '#86efac' },
    { key: 'hold', label: 'Hold', color: '#9ca3af' },
    { key: 'sell', label: 'Sell', color: '#fca5a5' },
    { key: 'strongSell', label: 'Strong Sell', color: '#dc2626' },
  ] as const;
  const sum = (x: SnapshotDoc['analystBreakdown']) => rows.reduce((acc, r) => acc + (x?.[r.key] ?? 0), 0) || 1;
  const totalA = sum(a);
  const totalB = sum(b);
  if (!a && !b) return null;
  return (
    <div className={s.breakdownWrap}>
      <div className={s.breakdownHeader}>Breakdown analytiků</div>
      <div className={s.breakdownCols}>
        <div className={s.breakdownCol}>
          <div className={s.metaLabel}>A</div>
          {rows.map((r) => (
            <div key={`a-${r.key}`} className={s.breakdownRow}>
              <span className={s.breakdownLabel}>{r.label}</span>
              <span className={s.breakdownCount}>{a?.[r.key] ?? 0}</span>
              <span className={s.breakdownBarOuter}>
                <span
                  className={s.breakdownBarInner}
                  style={{
                    width: `${((a?.[r.key] ?? 0) / totalA) * 100}%`,
                    background: r.color,
                  }}
                />
              </span>
            </div>
          ))}
        </div>
        <div className={s.breakdownCol}>
          <div className={s.metaLabel}>B</div>
          {rows.map((r) => (
            <div key={`b-${r.key}`} className={s.breakdownRow}>
              <span className={s.breakdownLabel}>{r.label}</span>
              <span className={s.breakdownCount}>{b?.[r.key] ?? 0}</span>
              <span className={s.breakdownBarOuter}>
                <span
                  className={s.breakdownBarInner}
                  style={{
                    width: `${((b?.[r.key] ?? 0) / totalB) * 100}%`,
                    background: r.color,
                  }}
                />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type TrendPeriod = {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
};

type EpsRev = {
  upLast7days: number | null;
  downLast7days: number | null;
  upLast30days: number | null;
  downLast30days: number | null;
};

function extractRecommendationTrend(ctx: unknown): TrendPeriod[] {
  if (!ctx || typeof ctx !== 'object') return [];
  const arr = (ctx as { recommendationTrend?: unknown }).recommendationTrend;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => {
      const row = (r ?? {}) as Record<string, unknown>;
      return {
        period: typeof row.period === 'string' ? row.period : '',
        strongBuy: typeof row.strongBuy === 'number' ? row.strongBuy : 0,
        buy: typeof row.buy === 'number' ? row.buy : 0,
        hold: typeof row.hold === 'number' ? row.hold : 0,
        sell: typeof row.sell === 'number' ? row.sell : 0,
        strongSell: typeof row.strongSell === 'number' ? row.strongSell : 0,
      };
    })
    .filter((r) => r.period.length > 0);
}

function extractEpsRevisions(ctx: unknown): EpsRev | null {
  if (!ctx || typeof ctx !== 'object') return null;
  const obj = (ctx as { epsRevisions?: unknown }).epsRevisions;
  if (!obj || typeof obj !== 'object') return null;
  const r = obj as Record<string, unknown>;
  const pick = (k: string): number | null => {
    const v = r[k];
    return typeof v === 'number' ? v : null;
  };
  return {
    upLast7days: pick('upLast7days'),
    downLast7days: pick('downLast7days'),
    upLast30days: pick('upLast30days'),
    downLast30days: pick('downLast30days'),
  };
}

function staleness(
  lastAction: string | undefined,
  snapshotAt: string,
): {
  days: number | null;
  tone: 'fresh' | 'stale' | 'old' | 'unknown';
  label: string;
} {
  if (!lastAction) return { days: null, tone: 'unknown', label: 'neznámá čerstvost' };
  const last = Date.parse(lastAction);
  const snap = Date.parse(snapshotAt);
  if (Number.isNaN(last) || Number.isNaN(snap)) {
    return { days: null, tone: 'unknown', label: 'neznámá čerstvost' };
  }
  const days = Math.round((snap - last) / 86_400_000);
  const abs = Math.abs(days);
  let tone: 'fresh' | 'stale' | 'old' = 'fresh';
  if (abs > 90) tone = 'old';
  else if (abs > 30) tone = 'stale';
  const label = days >= 0 ? `${abs} dní před snapshotem` : `${abs} dní po snapshotu`;
  return { days: abs, tone, label };
}

function FreshnessPanel({ a, b }: { a: SnapshotDoc; b: SnapshotDoc }) {
  const trendA = extractRecommendationTrend(a.recentContext);
  const trendB = extractRecommendationTrend(b.recentContext);
  const revA = extractEpsRevisions(a.recentContext);
  const revB = extractEpsRevisions(b.recentContext);
  const stA = staleness(a.analystLastActionDate, a.takenAt);
  const stB = staleness(b.analystLastActionDate, b.takenAt);

  if (
    !a.analystLastActionDate &&
    !b.analystLastActionDate &&
    trendA.length === 0 &&
    trendB.length === 0 &&
    !revA &&
    !revB
  ) {
    return null;
  }

  return (
    <section className={s.card}>
      <h3 className={s.sectionTitle}>Aktivita analytiků (jak staré jsou odhady)</h3>

      <div className={s.freshnessGrid}>
        <FreshnessCell
          header="A"
          snapshotAt={a.takenAt}
          lastAction={a.analystLastActionDate}
          st={stA}
          revisions={revA}
        />
        <FreshnessCell
          header="B"
          snapshotAt={b.takenAt}
          lastAction={b.analystLastActionDate}
          st={stB}
          revisions={revB}
        />
      </div>

      {(trendA.length > 0 || trendB.length > 0) && (
        <div className={s.trendWrap}>
          <div className={s.trendHeader}>Consensus trend (posledních 4 měsíce před snapshotem)</div>
          <div className={s.trendCols}>
            <TrendMini title="A" periods={trendA} />
            <TrendMini title="B" periods={trendB} />
          </div>
        </div>
      )}
    </section>
  );
}

function FreshnessCell({
  header,
  snapshotAt,
  lastAction,
  st,
  revisions,
}: {
  header: string;
  snapshotAt: string;
  lastAction: string | undefined;
  st: ReturnType<typeof staleness>;
  revisions: EpsRev | null;
}) {
  const toneCls =
    st.tone === 'fresh'
      ? s.toneFresh
      : st.tone === 'stale'
        ? s.toneStale
        : st.tone === 'old'
          ? s.toneOld
          : s.toneUnknown;
  return (
    <div className={s.freshCell}>
      <div className={s.freshHeader}>
        <span className={s.metaLabel}>{header}</span>
        <span className={`${s.freshTone} ${toneCls}`}>
          {st.tone === 'fresh'
            ? '● čerstvé'
            : st.tone === 'stale'
              ? '● zastarávající'
              : st.tone === 'old'
                ? '● staré'
                : '○ neznámé'}
        </span>
      </div>
      <div className={s.freshRow}>
        <span className={s.metaLabel}>Snapshot:</span>
        <span className={s.freshValue}>{fmtDate(snapshotAt)}</span>
      </div>
      <div className={s.freshRow}>
        <span className={s.metaLabel}>Nejčerstvější action:</span>
        <span className={s.freshValue}>{lastAction ? fmtDate(lastAction) : '—'}</span>
      </div>
      <div className={s.freshGap}>
        <span className={s.metaLabel}>Mezera:</span> {st.label}
      </div>
      {revisions && (
        <div className={s.revRow}>
          <span className={s.metaLabel}>EPS revize:</span>
          <RevisionPill label="7d" up={revisions.upLast7days} down={revisions.downLast7days} />
          <RevisionPill label="30d" up={revisions.upLast30days} down={revisions.downLast30days} />
        </div>
      )}
    </div>
  );
}

function RevisionPill({ label, up, down }: { label: string; up: number | null; down: number | null }) {
  const upN = up ?? 0;
  const downN = down ?? 0;
  const empty = up == null && down == null;
  return (
    <span className={s.revPill} title={`${label}: ${upN} up / ${downN} down`}>
      <span className={s.revLabel}>{label}</span>
      {empty ? (
        <span className={s.revNone}>—</span>
      ) : (
        <>
          <span className={s.revUp}>↑{upN}</span>
          <span className={s.revDown}>↓{downN}</span>
        </>
      )}
    </span>
  );
}

function TrendMini({ title, periods }: { title: string; periods: TrendPeriod[] }) {
  // Yahoo order is newest-first: 0m, -1m, -2m, -3m → we want oldest-first for left→right reading.
  const sorted = [...periods].sort((a, b) => {
    const av = a.period === '0m' ? 0 : -parseInt(a.period, 10);
    const bv = b.period === '0m' ? 0 : -parseInt(b.period, 10);
    return av - bv;
  });
  if (sorted.length === 0) {
    return (
      <div className={s.trendCol}>
        <div className={s.metaLabel}>{title}</div>
        <div className={s.narrativeEmpty}>(žádná data)</div>
      </div>
    );
  }
  return (
    <div className={s.trendCol}>
      <div className={s.metaLabel}>{title}</div>
      <div className={s.trendChart}>
        {sorted.map((p) => {
          const total = p.strongBuy + p.buy + p.hold + p.sell + p.strongSell || 1;
          const seg = (n: number) => `${(n / total) * 100}%`;
          return (
            <div key={p.period} className={s.trendBarWrap}>
              <div className={s.trendPeriod}>{p.period}</div>
              <div className={s.trendBar}>
                <span style={{ width: seg(p.strongBuy), background: '#16a34a' }} title={`Strong Buy ${p.strongBuy}`} />
                <span style={{ width: seg(p.buy), background: '#86efac' }} title={`Buy ${p.buy}`} />
                <span style={{ width: seg(p.hold), background: '#9ca3af' }} title={`Hold ${p.hold}`} />
                <span style={{ width: seg(p.sell), background: '#fca5a5' }} title={`Sell ${p.sell}`} />
                <span
                  style={{ width: seg(p.strongSell), background: '#dc2626' }}
                  title={`Strong Sell ${p.strongSell}`}
                />
              </div>
              <div className={s.trendCount}>{p.strongBuy + p.buy + p.hold + p.sell + p.strongSell}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type NewsItem = { title?: string; url?: string; publisher?: string; published?: string };

function extractNews(ctx: unknown): NewsItem[] {
  if (!ctx || typeof ctx !== 'object') return [];
  const obj = ctx as Record<string, unknown>;
  const arr = obj.news;
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 5).map((n) => {
    const r = (n ?? {}) as Record<string, unknown>;
    return {
      title: typeof r.title === 'string' ? r.title : undefined,
      url: typeof r.url === 'string' ? r.url : undefined,
      publisher: typeof r.publisher === 'string' ? r.publisher : undefined,
      published: typeof r.published === 'string' ? r.published : undefined,
    };
  });
}

function RecentContextPanel({ a, b }: { a: unknown; b: unknown }) {
  const newsA = extractNews(a);
  const newsB = extractNews(b);
  if (newsA.length === 0 && newsB.length === 0) return null;
  return (
    <section className={s.card}>
      <h3 className={s.sectionTitle}>News tehdy vs teď</h3>
      <div className={s.newsCols}>
        <NewsCol title="A" items={newsA} />
        <NewsCol title="B" items={newsB} />
      </div>
    </section>
  );
}

function NewsCol({ title, items }: { title: string; items: NewsItem[] }) {
  return (
    <div className={s.newsCol}>
      <div className={s.metaLabel}>{title}</div>
      {items.length === 0 && <div className={s.narrativeEmpty}>(žádné)</div>}
      {items.map((it, idx) => (
        <div key={idx} className={s.newsItem}>
          {it.url ? (
            <a href={it.url} target="_blank" rel="noreferrer" className={s.newsTitle}>
              {it.title ?? it.url}
            </a>
          ) : (
            <span className={s.newsTitle}>{it.title ?? '—'}</span>
          )}
          <div className={s.newsMeta}>
            {it.publisher ?? ''} {it.published ? `· ${it.published}` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

function AiDiffPanel({ aId, bId }: { aId: string; bId: string }) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [cached, setCached] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const bothReal = aId !== 'current' && bId !== 'current';

  // On A/B change: reset + attempt cache lookup (only for real↔real pairs).
  useEffect(() => {
    setExplanation(null);
    setModel(null);
    setGeneratedAt(null);
    setCached(false);
    setError(null);
    if (!bothReal || !aId || !bId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/actions/explain-snapshot-diff?snapshotAId=${encodeURIComponent(aId)}&snapshotBId=${encodeURIComponent(bId)}`,
          { credentials: 'include' },
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          exists?: boolean;
          explanation?: string;
          model?: string;
          generatedAt?: string;
        };
        if (cancelled) return;
        if (json.exists && typeof json.explanation === 'string') {
          setExplanation(json.explanation);
          setModel(json.model ?? null);
          setGeneratedAt(json.generatedAt ?? null);
          setCached(true);
        }
      } catch {
        // Ignore — user can still click Generate.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aId, bId, bothReal]);

  const generate = useCallback(
    async (force: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/actions/explain-snapshot-diff', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshotAId: aId, snapshotBId: bId, force }),
        });
        const json = (await res.json()) as {
          explanation?: string;
          model?: string;
          generatedAt?: string;
          cached?: boolean;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        setExplanation(json.explanation ?? '');
        setModel(json.model ?? null);
        setGeneratedAt(json.generatedAt ?? null);
        setCached(Boolean(json.cached));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [aId, bId],
  );

  const buttonLabel = explanation
    ? loading
      ? 'Generuji…'
      : 'Přegenerovat'
    : loading
      ? 'Generuji…'
      : 'Vygenerovat AI shrnutí změn';

  return (
    <section className={s.card}>
      <div className={s.aiHeader}>
        <h3 className={s.sectionTitle} style={{ margin: 0 }}>
          AI shrnutí změn
          {cached && <span className={s.aiCacheBadge}>cache</span>}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {generatedAt && (
            <span className={s.aiMeta}>
              {model ? `${model} · ` : ''}
              {fmtDate(generatedAt)}
            </span>
          )}
          <button
            type="button"
            className={s.aiButton}
            disabled={loading}
            onClick={() => generate(Boolean(explanation))}
          >
            {buttonLabel}
          </button>
        </div>
      </div>

      {error && <div className={s.aiError}>Chyba: {error}</div>}

      {explanation ? (
        <div className={s.aiBody}>{explanation}</div>
      ) : (
        <div className={s.aiEmpty}>
          {bothReal
            ? 'Zatím nevygenerováno. Klikni na "Vygenerovat" — AI porovná oba snapshoty a popíše co se změnilo.'
            : 'Porovnání se snapshotem „Aktuální stav (live)" se nekešuje — klikni na "Vygenerovat" pro nové shrnutí.'}
        </div>
      )}
    </section>
  );
}
