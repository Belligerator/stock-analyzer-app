import { getPayload, type Payload, type PayloadRequest, type Where } from 'payload';
import config from '@payload-config';
import { fetchFxRates, fetchStockMetrics, fetchTickerContext, sleep, type FxRates } from './yahoo-finance';
import { updatePriceHistory } from './refresh-prices';
import type { RecentContext } from '@/types/stocks';

const DELAY_BETWEEN_TICKERS_MS = 500;

export type RefreshResult = {
  ticker: string;
  status: 'ok' | 'error';
  error?: string;
};

export type RefreshSummary = {
  total: number;
  okCount: number;
  failed: number;
  results: RefreshResult[];
  fxRates: FxRates;
  durationMs: number;
};

export async function refreshStocks(
  options: { tickers?: string[]; req?: PayloadRequest } = {},
): Promise<RefreshSummary> {
  const payload = options.req?.payload ?? (await getPayload({ config }));
  const req = options.req;
  const start = Date.now();

  const where: Where = options.tickers ? { ticker: { in: options.tickers } } : { active: { equals: true } };

  const { docs } = await payload.find({
    collection: 'stocks',
    where,
    limit: 500,
    depth: 0,
    req,
  });

  const currencies = Array.from(new Set(docs.map((d) => (d.currency as string | undefined) ?? 'USD')));

  console.log(
    `[refresh-stocks] start: ${docs.length} tickers${options.tickers ? ` (${options.tickers.join(',')})` : ' (all active)'}, currencies=${JSON.stringify(currencies)}`,
  );

  const fxRates = await fetchFxRates(currencies);
  console.log(
    `[refresh-stocks] fx rates: ${Object.entries(fxRates)
      .map(([k, v]) => `${k}=${v.toFixed(4)}`)
      .join(', ')}`,
  );

  const results: RefreshResult[] = [];
  for (const doc of docs) {
    const ticker = doc.ticker as string;
    const currency = (doc.currency as string) ?? 'USD';
    const yahooSymbol = (doc.yahooSymbol as string) || ticker;
    const tickerStart = Date.now();

    try {
      const metrics = await fetchStockMetrics(yahooSymbol, currency, fxRates);
      let recentContext: RecentContext | null = null;
      let contextStatus = 'skipped';
      try {
        recentContext = await fetchTickerContext(yahooSymbol);
        contextStatus = `ok (${recentContext.news.length}n/${recentContext.sigDevs.length}s/${recentContext.researchReports.length}r/${recentContext.upgrades.length}u)`;
      } catch (ctxErr) {
        contextStatus = `err: ${ctxErr instanceof Error ? ctxErr.message : 'unknown'}`;
      }
      await applyMetrics(payload, doc.id as string | number, metrics, recentContext, req);

      let priceStatus = 'skipped';
      try {
        const priceSummary = await updatePriceHistory(ticker, yahooSymbol, payload, req);
        priceStatus = `d+${priceSummary.daily.added}/-${priceSummary.daily.trimmed} w+${priceSummary.weekly.added}/-${priceSummary.weekly.trimmed}`;
      } catch (priceErr) {
        priceStatus = `err: ${priceErr instanceof Error ? priceErr.message : 'unknown'}`;
      }

      const tickerMs = Date.now() - tickerStart;
      console.log(
        `[refresh-stocks]   ${ticker.padEnd(6)} (${yahooSymbol}) metrics=ok price=${metrics.price ?? 'null'} context=${contextStatus} prices=${priceStatus} ${tickerMs}ms`,
      );
      results.push({ ticker, status: 'ok' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markFailure(payload, doc.id as string | number, message, req);
      const tickerMs = Date.now() - tickerStart;
      console.log(`[refresh-stocks]   ${ticker.padEnd(6)} (${yahooSymbol}) ERROR ${tickerMs}ms: ${message}`);
      results.push({ ticker, status: 'error', error: message });
    }

    await sleep(DELAY_BETWEEN_TICKERS_MS);
  }

  const okCount = results.filter((r) => r.status === 'ok').length;
  const durationMs = Date.now() - start;
  console.log(
    `[refresh-stocks] done in ${durationMs}ms: ${okCount}/${results.length} ok, ${results.length - okCount} failed`,
  );

  return {
    total: results.length,
    okCount,
    failed: results.length - okCount,
    results,
    fxRates,
    durationMs,
  };
}

async function applyMetrics(
  payload: Payload,
  id: string | number,
  metrics: Awaited<ReturnType<typeof fetchStockMetrics>>,
  recentContext: RecentContext | null,
  req?: PayloadRequest,
): Promise<void> {
  const data: Record<string, unknown> = {
    price: metrics.price,
    pe: metrics.pe,
    fwdPe: metrics.fwdPe,
    gain52w: metrics.gain52w,
    avgTarget: metrics.avgTarget,
    cons: metrics.cons,
    marketCap: metrics.marketCap,
    revenueGrowthYoY: metrics.revenueGrowthYoY,
    profitMargin: metrics.profitMargin,
    roe: metrics.roe,
    debtToEquity: metrics.debtToEquity,
    peg: metrics.peg,
    targetHigh: metrics.targetHigh,
    targetLow: metrics.targetLow,
    numAnalysts: metrics.numAnalysts,
    analystBreakdown: metrics.analystBreakdown,
    sources: metrics.sources,
    metricsUpdatedAt: new Date().toISOString(),
    lastFetchError: null,
  };

  if (metrics.name) data.name = metrics.name;
  if (metrics.sector) data.sector = metrics.sector;
  if (recentContext) data.recentContext = recentContext;

  await payload.update({
    collection: 'stocks',
    id,
    data,
    req,
  });
}

async function markFailure(
  payload: Payload,
  id: string | number,
  message: string,
  req?: PayloadRequest,
): Promise<void> {
  await payload.update({
    collection: 'stocks',
    id,
    data: { lastFetchError: message.slice(0, 500) },
    req,
  });
}
