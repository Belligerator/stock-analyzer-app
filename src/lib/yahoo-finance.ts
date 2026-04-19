import YahooFinance from 'yahoo-finance2';
import type {
  Consensus,
  RecentContext,
  RecentContextNews,
  RecentContextResearchReport,
  RecentContextSigDev,
  RecentContextUpgrade,
} from '@/types/stocks';

const noop = () => undefined;
const yf = new YahooFinance({
  validation: { logErrors: false, logOptionsErrors: false },
  versionCheck: false,
  logger: {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    dir: noop,
  },
});

const RECOMMENDATION_MAP: Record<string, Consensus> = {
  strong_buy: 'Strong Buy',
  buy: 'Buy',
  outperform: 'Buy',
  hold: 'Hold',
  underperform: 'Sell',
  sell: 'Sell',
  strong_sell: 'Strong Sell',
};

function round(v: number | null | undefined, digits = 2): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

function pct(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return round(v * 100, 2);
}

function ratioFromPct(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return round(v / 100, 3);
}

function billions(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return round(v / 1e9, 2);
}

function mapConsensus(key: string | undefined, mean: number | undefined): Consensus {
  if (key) {
    const mapped = RECOMMENDATION_MAP[key.toLowerCase()];
    if (mapped) return mapped;
  }
  if (typeof mean === 'number' && Number.isFinite(mean)) {
    if (mean <= 1.5) return 'Strong Buy';
    if (mean <= 2.5) return 'Buy';
    if (mean <= 3.5) return 'Hold';
    if (mean <= 4.5) return 'Sell';
    return 'Strong Sell';
  }
  return 'Hold';
}

export interface StockMetrics {
  name?: string;
  sector?: string;
  price: number | null;
  pe: number | null;
  fwdPe: number | null;
  gain52w: number | null;
  avgTarget: number | null;
  cons: Consensus;
  marketCap: number | null;
  revenueGrowthYoY: number | null;
  profitMargin: number | null;
  roe: number | null;
  debtToEquity: number | null;
  peg: number | null;
  targetHigh: number | null;
  targetLow: number | null;
  numAnalysts: number | null;
  analystBreakdown: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  } | null;
  sources: Array<{ url: string }>;
}

export type FxRates = Record<string, number>;

export async function fetchFxRate(pair: string): Promise<number | null> {
  try {
    const q = await yf.quote(pair);
    const rate =
      (q as { regularMarketPrice?: number }).regularMarketPrice ??
      (q as { postMarketPrice?: number }).postMarketPrice ??
      (q as { preMarketPrice?: number }).preMarketPrice;
    return typeof rate === 'number' && Number.isFinite(rate) ? rate : null;
  } catch {
    return null;
  }
}

export async function fetchFxRates(currencies: readonly string[]): Promise<FxRates> {
  const rates: FxRates = { USD: 1 };
  for (const c of currencies) {
    if (c === 'USD' || c in rates) continue;
    const rate = await fetchFxRate(`${c}USD=X`);
    rates[c] = rate ?? (c === 'EUR' ? 1.08 : c === 'GBP' ? 1.27 : 1);
    await sleep(200);
  }
  return rates;
}

function pickNum(...vals: Array<number | null | undefined>): number | null {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

export async function fetchStockMetrics(
  yahooSymbol: string,
  currency: string,
  fxRates: FxRates,
): Promise<StockMetrics> {
  const summary = await yf.quoteSummary(yahooSymbol, {
    modules: ['price', 'summaryDetail', 'financialData', 'defaultKeyStatistics', 'assetProfile', 'recommendationTrend'],
  });

  const price = summary.price ?? {};
  const sd = summary.summaryDetail ?? {};
  const fd = summary.financialData ?? {};
  const ks = summary.defaultKeyStatistics ?? {};
  const ap = summary.assetProfile ?? {};
  const rt = summary.recommendationTrend?.trend ?? [];

  const name =
    (price as { longName?: string; shortName?: string }).longName ??
    (price as { longName?: string; shortName?: string }).shortName ??
    undefined;
  const sector =
    (ap as { sector?: string; industry?: string }).sector ??
    (ap as { sector?: string; industry?: string }).industry ??
    undefined;

  const currentPrice = pickNum(
    (fd as { currentPrice?: number }).currentPrice,
    (price as { regularMarketPrice?: number }).regularMarketPrice,
    (sd as { previousClose?: number }).previousClose,
  );

  const marketCapLocal = pickNum((price as { marketCap?: number }).marketCap, (sd as { marketCap?: number }).marketCap);
  const fxToUsd = fxRates[currency] ?? 1;
  const marketCapUsdB =
    marketCapLocal != null && currency !== 'USD' ? billions(marketCapLocal * fxToUsd) : billions(marketCapLocal);

  const gain52w = pickNum(
    (ks as { fiftyTwoWeekChange?: number; '52WeekChange'?: number }).fiftyTwoWeekChange,
    (ks as { fiftyTwoWeekChange?: number; '52WeekChange'?: number })['52WeekChange'],
  );
  const avgTarget = pickNum(
    (fd as { targetMedianPrice?: number; targetMeanPrice?: number }).targetMedianPrice,
    (fd as { targetMedianPrice?: number; targetMeanPrice?: number }).targetMeanPrice,
  );

  const cons = mapConsensus(
    (fd as { recommendationKey?: string }).recommendationKey,
    (fd as { recommendationMean?: number }).recommendationMean,
  );

  type TrendRow = {
    strongBuy?: number;
    buy?: number;
    hold?: number;
    sell?: number;
    strongSell?: number;
  };
  const currentTrend = rt[0] as TrendRow | undefined;
  const breakdown =
    currentTrend &&
    (currentTrend.strongBuy ?? 0) +
      (currentTrend.buy ?? 0) +
      (currentTrend.hold ?? 0) +
      (currentTrend.sell ?? 0) +
      (currentTrend.strongSell ?? 0) >
      0
      ? {
          strongBuy: currentTrend.strongBuy ?? 0,
          buy: currentTrend.buy ?? 0,
          hold: currentTrend.hold ?? 0,
          sell: currentTrend.sell ?? 0,
          strongSell: currentTrend.strongSell ?? 0,
        }
      : null;

  return {
    name,
    sector,
    price: round(currentPrice),
    pe: round((sd as { trailingPE?: number }).trailingPE ?? null),
    fwdPe: round(pickNum((sd as { forwardPE?: number }).forwardPE, (ks as { forwardPE?: number }).forwardPE)),
    gain52w: pct(gain52w),
    avgTarget: round(avgTarget),
    cons,
    marketCap: marketCapUsdB,
    revenueGrowthYoY: pct((fd as { revenueGrowth?: number }).revenueGrowth),
    profitMargin: pct((fd as { profitMargins?: number }).profitMargins),
    roe: pct((fd as { returnOnEquity?: number }).returnOnEquity),
    debtToEquity: ratioFromPct((fd as { debtToEquity?: number }).debtToEquity),
    peg: round(pickNum((ks as { pegRatio?: number }).pegRatio, (ks as { trailingPegRatio?: number }).trailingPegRatio)),
    targetHigh: round((fd as { targetHighPrice?: number }).targetHighPrice ?? null),
    targetLow: round((fd as { targetLowPrice?: number }).targetLowPrice ?? null),
    numAnalysts: (fd as { numberOfAnalystOpinions?: number }).numberOfAnalystOpinions ?? null,
    analystBreakdown: breakdown,
    sources: [{ url: `https://finance.yahoo.com/quote/${yahooSymbol}` }],
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface HistoricalPricePoint {
  date: string;
  close: number;
}

export async function fetchHistoricalPrices(
  yahooSymbol: string,
  period1: Date,
  period2: Date,
  interval: '1d' | '1wk',
): Promise<HistoricalPricePoint[]> {
  const rows = await yf.historical(yahooSymbol, { period1, period2, interval });
  const out: HistoricalPricePoint[] = [];
  for (const row of rows) {
    const close = (row as { close?: number; adjClose?: number }).close ?? (row as { adjClose?: number }).adjClose;
    const date = (row as { date?: Date | string }).date;
    if (typeof close !== 'number' || !Number.isFinite(close)) continue;
    if (!date) continue;
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) continue;
    out.push({ date: toYmd(d), close: Math.round(close * 100) / 100 });
  }
  return out;
}

function stripHtml(html: string | undefined | null): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

function toIsoDate(v: Date | string | number | undefined | null): string {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number') return new Date(v).toISOString();
  return String(v);
}

function readLimit(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function fetchTickerContext(yahooSymbol: string): Promise<RecentContext> {
  const newsLimit = readLimit('YAHOO_NEWS_COUNT', 5);
  const reportsLimit = readLimit('YAHOO_REPORTS_COUNT', 3);
  const upgradesLimit = readLimit('YAHOO_UPGRADES_COUNT', 5);

  const [searchResult, insightsResult, qs] = await Promise.allSettled([
    yf.search(yahooSymbol, { newsCount: newsLimit, quotesCount: 0 }),
    yf.insights(yahooSymbol, { reportsCount: reportsLimit }),
    yf.quoteSummary(yahooSymbol, {
      modules: ['upgradeDowngradeHistory', 'calendarEvents'],
    }),
  ]);

  if (searchResult.status === 'rejected') {
    console.log(`[yahoo-finance] ${yahooSymbol} search failed: ${searchResult.reason}`);
  }
  if (insightsResult.status === 'rejected') {
    console.log(`[yahoo-finance] ${yahooSymbol} insights failed: ${insightsResult.reason}`);
  }
  if (qs.status === 'rejected') {
    console.log(`[yahoo-finance] ${yahooSymbol} quoteSummary failed: ${qs.reason}`);
  }

  const news: RecentContextNews[] =
    searchResult.status === 'fulfilled'
      ? (searchResult.value.news ?? []).slice(0, newsLimit).map((n) => ({
          title: n.title ?? '',
          publisher: n.publisher ?? '',
          link: n.link ?? '',
          publishedAt: toIsoDate(n.providerPublishTime),
        }))
      : [];

  const sigDevs: RecentContextSigDev[] = [];
  const researchReports: RecentContextResearchReport[] = [];
  let recommendation: RecentContext['recommendation'] = null;

  if (insightsResult.status === 'fulfilled') {
    const ins = insightsResult.value;
    for (const dev of ins.sigDevs ?? []) {
      sigDevs.push({
        headline: dev.headline ?? '',
        date: toIsoDate(dev.date),
      });
    }
    for (const report of (ins.reports ?? []).slice(0, reportsLimit)) {
      const r = report as {
        reportTitle?: string;
        title?: string;
        provider?: string;
        investmentRating?: string;
        targetPrice?: number;
        reportDate?: Date;
        headHtml?: string;
      };
      researchReports.push({
        title: r.reportTitle ?? r.title ?? '',
        provider: r.provider ?? '',
        investmentRating: r.investmentRating ?? null,
        targetPrice: typeof r.targetPrice === 'number' ? r.targetPrice : null,
        reportDate: toIsoDate(r.reportDate),
        contentText: stripHtml(r.headHtml),
      });
    }
    if (ins.recommendation) {
      recommendation = {
        rating: ins.recommendation.rating ?? '',
        targetPrice: typeof ins.recommendation.targetPrice === 'number' ? ins.recommendation.targetPrice : null,
        provider: ins.recommendation.provider ?? '',
      };
    }
  }

  const upgrades: RecentContextUpgrade[] = [];
  let nextEarnings: string | null = null;

  if (qs.status === 'fulfilled') {
    const history = (qs.value.upgradeDowngradeHistory?.history ?? []) as Array<{
      firm?: string;
      action?: string;
      fromGrade?: string;
      toGrade?: string;
      epochGradeDate?: Date | number;
    }>;
    const sorted = [...history]
      .filter((h) => h.epochGradeDate)
      .sort((a, b) => {
        const av = a.epochGradeDate instanceof Date ? a.epochGradeDate.getTime() : Number(a.epochGradeDate);
        const bv = b.epochGradeDate instanceof Date ? b.epochGradeDate.getTime() : Number(b.epochGradeDate);
        return bv - av;
      })
      .slice(0, upgradesLimit);
    for (const h of sorted) {
      upgrades.push({
        firm: h.firm ?? '',
        action: h.action ?? '',
        fromGrade: h.fromGrade ?? '',
        toGrade: h.toGrade ?? '',
        date: toIsoDate(h.epochGradeDate),
      });
    }

    const earningsDates = (qs.value.calendarEvents?.earnings?.earningsDate ?? []) as Array<Date>;
    if (earningsDates.length > 0) {
      nextEarnings = toIsoDate(earningsDates[0]);
    }
  }

  return {
    news,
    sigDevs,
    researchReports,
    upgrades,
    recommendation,
    nextEarnings,
    fetchedAt: new Date().toISOString(),
  };
}
