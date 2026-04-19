import type { Payload, PayloadRequest } from 'payload';
import { fetchHistoricalPrices } from './yahoo-finance';

type PriceInterval = 'daily' | 'weekly';

const DAILY_WINDOW_YEARS = 5;
const WEEKLY_WINDOW_YEARS = 20;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function subtractYears(d: Date, years: number): Date {
  const copy = new Date(d.getTime());
  copy.setUTCFullYear(copy.getUTCFullYear() - years);
  return copy;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY);
}

function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface PriceUpdateCounts {
  added: number;
  trimmed: number;
  skipped: boolean;
}

export interface PriceUpdateSummary {
  daily: PriceUpdateCounts;
  weekly: PriceUpdateCounts;
}

async function latestDateFor(
  payload: Payload,
  ticker: string,
  interval: PriceInterval,
  req?: PayloadRequest
): Promise<string | null> {
  const { docs } = await payload.find({
    collection: 'price-history',
    where: { and: [{ ticker: { equals: ticker } }, { interval: { equals: interval } }] },
    sort: '-date',
    limit: 1,
    depth: 0,
    pagination: false,
    req,
  });
  const top = docs[0] as { date?: string } | undefined;
  return top?.date ?? null;
}

async function trimOlderThan(
  payload: Payload,
  ticker: string,
  interval: PriceInterval,
  cutoffYmd: string,
  req?: PayloadRequest
): Promise<number> {
  const res = await payload.delete({
    collection: 'price-history',
    where: {
      and: [
        { ticker: { equals: ticker } },
        { interval: { equals: interval } },
        { date: { less_than: cutoffYmd } },
      ],
    },
    req,
  });
  return (res.docs?.length ?? 0) as number;
}

async function upsertInterval(
  payload: Payload,
  ticker: string,
  yahooSymbol: string,
  interval: PriceInterval,
  req?: PayloadRequest
): Promise<PriceUpdateCounts> {
  const windowYears = interval === 'daily' ? DAILY_WINDOW_YEARS : WEEKLY_WINDOW_YEARS;
  const yahooInterval = interval === 'daily' ? '1d' : '1wk';
  const now = new Date();
  const today = todayYmd();

  const last = await latestDateFor(payload, ticker, interval, req);

  let period1: Date;
  if (last) {
    const next = addDays(ymdToDate(last), 1);
    if (next >= now) {
      const trimmed = await trimOlderThan(payload, ticker, interval, toYmdCutoff(windowYears), req);
      return { added: 0, trimmed, skipped: true };
    }
    period1 = next;
  } else {
    period1 = subtractYears(now, windowYears);
  }

  const prices = await fetchHistoricalPrices(yahooSymbol, period1, now, yahooInterval);
  let added = 0;
  for (const row of prices) {
    if (row.date > today) continue;
    try {
      await payload.create({
        collection: 'price-history',
        data: { ticker, interval, date: row.date, close: row.close },
        req,
      });
      added += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate') && !msg.includes('unique')) {
        throw err;
      }
    }
  }

  const trimmed = await trimOlderThan(payload, ticker, interval, toYmdCutoff(windowYears), req);

  return { added, trimmed, skipped: false };
}

function toYmdCutoff(windowYears: number): string {
  const cutoff = subtractYears(new Date(), windowYears);
  const y = cutoff.getUTCFullYear();
  const m = String(cutoff.getUTCMonth() + 1).padStart(2, '0');
  const day = String(cutoff.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function updatePriceHistory(
  ticker: string,
  yahooSymbol: string,
  payload: Payload,
  req?: PayloadRequest
): Promise<PriceUpdateSummary> {
  const daily = await upsertInterval(payload, ticker, yahooSymbol, 'daily', req);
  const weekly = await upsertInterval(payload, ticker, yahooSymbol, 'weekly', req);
  return { daily, weekly };
}
