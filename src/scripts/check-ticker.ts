/**
 * Usage:
 *   tsx src/scripts/check-ticker.ts AAPL
 *   tsx src/scripts/check-ticker.ts https://finance.yahoo.com/quote/FF/
 *   npm run check-ticker -- DSY.PA
 *
 * Tests whether a Yahoo ticker is reachable via yahoo-finance2
 * and prints key metrics + data points for diagnostics.
 */

import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({
  validation: { logErrors: false, logOptionsErrors: false },
  versionCheck: false,
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
});

function parseInput(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/\/quote\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : trimmed;
}

function log(label: string, data?: unknown): void {
  const ts = new Date().toISOString().slice(11, 23);
  if (data === undefined) {
    console.log(`[${ts}] ${label}`);
  } else {
    console.log(`[${ts}] ${label}`, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
}

function withTiming<T>(label: string, fn: () => Promise<T>): Promise<{ ok: true; ms: number; value: T } | { ok: false; ms: number; error: string }> {
  const t = Date.now();
  log(`▶ ${label} start`);
  return fn()
    .then(value => {
      const ms = Date.now() - t;
      log(`✓ ${label} done ${ms}ms`);
      return { ok: true as const, ms, value };
    })
    .catch((err: unknown) => {
      const ms = Date.now() - t;
      const error = err instanceof Error ? err.message : String(err);
      log(`✗ ${label} FAIL ${ms}ms — ${error}`);
      return { ok: false as const, ms, error };
    });
}

async function main(): Promise<void> {
  const raw = process.argv[2];
  const symbol = parseInput(raw);

  if (!symbol) {
    console.error('Usage: tsx src/scripts/check-ticker.ts <ticker|url>');
    console.error('Example: tsx src/scripts/check-ticker.ts AAPL');
    console.error('Example: tsx src/scripts/check-ticker.ts https://finance.yahoo.com/quote/FF/');
    process.exit(1);
  }

  log(`=== Yahoo Finance check for symbol: ${symbol} ===`);
  if (raw !== symbol) log(`(parsed from input: "${raw}")`);
  console.log('');

  // 1) Quote — quickest sanity check
  const quote = await withTiming(`quote(${symbol})`, () => yf.quote(symbol));
  if (quote.ok) {
    const q = quote.value as {
      symbol?: string;
      longName?: string;
      shortName?: string;
      regularMarketPrice?: number;
      currency?: string;
      quoteType?: string;
      exchange?: string;
      fullExchangeName?: string;
    };
    log('  symbol', q.symbol);
    log('  name', q.longName ?? q.shortName);
    log('  price', q.regularMarketPrice);
    log('  currency', q.currency);
    log('  type', q.quoteType);
    log('  exchange', `${q.exchange} (${q.fullExchangeName})`);
  }
  console.log('');

  // 2) QuoteSummary — used by refresh-stocks for metrics
  const summary = await withTiming(`quoteSummary(${symbol}) modules=[price,summaryDetail,financialData,defaultKeyStatistics,assetProfile]`, () =>
    yf.quoteSummary(symbol, {
      modules: ['price', 'summaryDetail', 'financialData', 'defaultKeyStatistics', 'assetProfile'],
    }),
  );
  if (summary.ok) {
    const s = summary.value;
    const price = (s.price ?? {}) as { regularMarketPrice?: number; longName?: string };
    const sd = (s.summaryDetail ?? {}) as { trailingPE?: number; forwardPE?: number; marketCap?: number };
    const fd = (s.financialData ?? {}) as { targetMedianPrice?: number; recommendationKey?: string; numberOfAnalystOpinions?: number };
    const ap = (s.assetProfile ?? {}) as { sector?: string; industry?: string };
    log('  longName', price.longName);
    log('  regularMarketPrice', price.regularMarketPrice);
    log('  trailingPE', sd.trailingPE);
    log('  forwardPE', sd.forwardPE);
    log('  marketCap', sd.marketCap);
    log('  sector', ap.sector);
    log('  industry', ap.industry);
    log('  targetMedianPrice', fd.targetMedianPrice);
    log('  recommendationKey', fd.recommendationKey);
    log('  numAnalysts', fd.numberOfAnalystOpinions);
  }
  console.log('');

  // 3) Search — news + suggestions
  const search = await withTiming(`search(${symbol})`, () => yf.search(symbol, { newsCount: 3, quotesCount: 0 }));
  if (search.ok) {
    const news = search.value.news ?? [];
    log(`  news count: ${news.length}`);
    news.slice(0, 3).forEach((n, i) => {
      log(`  [${i + 1}]`, { title: n.title, publisher: n.publisher, link: n.link });
    });
  }
  console.log('');

  // 4) Historical — last 30 days daily
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  const hist = await withTiming(`historical(${symbol}) last 30d daily`, () =>
    yf.historical(symbol, { period1: start, period2: end, interval: '1d' }),
  );
  if (hist.ok) {
    const rows = hist.value;
    log(`  rows: ${rows.length}`);
    if (rows.length > 0) {
      const first = rows[0];
      const last = rows[rows.length - 1];
      log('  first', { date: first.date, close: first.close });
      log('  last', { date: last.date, close: last.close });
    }
  }
  console.log('');

  // 5) Insights — used for recentContext (research reports, sigDevs)
  const insights = await withTiming(`insights(${symbol})`, () => yf.insights(symbol, { reportsCount: 2 }));
  if (insights.ok) {
    const ins = insights.value;
    log(`  sigDevs: ${(ins.sigDevs ?? []).length}`);
    log(`  reports: ${(ins.reports ?? []).length}`);
    log(`  recommendation: ${ins.recommendation?.rating ?? 'n/a'}`);
  }
  console.log('');

  // Verdict
  const results = [quote, summary, search, hist, insights];
  const okCount = results.filter(r => r.ok).length;
  const failCount = results.length - okCount;
  log(`=== Result: ${okCount}/${results.length} calls OK, ${failCount} failed ===`);
  if (failCount === 0) {
    log('✓ Ticker is fully supported by yahoo-finance2.');
    process.exit(0);
  } else if (quote.ok) {
    log('⚠ Ticker is partially supported — some endpoints failed but basic quote works.');
    process.exit(0);
  } else {
    log('✗ Ticker not found or blocked. Try another symbol or exchange suffix (e.g. FF.L, FF.F, FF.PA).');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});
