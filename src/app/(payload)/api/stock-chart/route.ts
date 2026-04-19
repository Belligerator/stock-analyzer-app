import { NextResponse, type NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

type PeriodKey = '1m' | 'ytd' | '1y' | '3y' | '5y' | 'max';

const TICKER_REGEX = /^[A-Z0-9.^-]{1,10}$/;

function subYears(d: Date, years: number): Date {
  const copy = new Date(d.getTime());
  copy.setUTCFullYear(copy.getUTCFullYear() - years);
  return copy;
}

function subMonths(d: Date, months: number): Date {
  const copy = new Date(d.getTime());
  copy.setUTCMonth(copy.getUTCMonth() - months);
  return copy;
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function resolvePeriod(period: PeriodKey): { intervalValue: 'daily' | 'weekly'; sinceYmd: string } {
  const now = new Date();
  switch (period) {
    case '1m':
      return { intervalValue: 'daily', sinceYmd: toYmd(subMonths(now, 1)) };
    case 'ytd':
      return { intervalValue: 'daily', sinceYmd: `${now.getUTCFullYear()}-01-01` };
    case '3y':
      return { intervalValue: 'daily', sinceYmd: toYmd(subYears(now, 3)) };
    case '5y':
      return { intervalValue: 'daily', sinceYmd: toYmd(subYears(now, 5)) };
    case 'max':
      return { intervalValue: 'weekly', sinceYmd: toYmd(subYears(now, 20)) };
    case '1y':
    default:
      return { intervalValue: 'daily', sinceYmd: toYmd(subYears(now, 1)) };
  }
}

function isPeriodKey(v: string): v is PeriodKey {
  return v === '1m' || v === 'ytd' || v === '1y' || v === '3y' || v === '5y' || v === 'max';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tickerRaw = (searchParams.get('ticker') ?? '').toUpperCase();
  const periodRaw = (searchParams.get('period') ?? '1y').toLowerCase();

  if (!TICKER_REGEX.test(tickerRaw)) {
    return NextResponse.json({ error: 'invalid ticker' }, { status: 400 });
  }
  const period: PeriodKey = isPeriodKey(periodRaw) ? periodRaw : '1y';
  const { intervalValue, sinceYmd } = resolvePeriod(period);

  const payload = await getPayload({ config });

  const stockRes = await payload.find({
    collection: 'stocks',
    where: { ticker: { equals: tickerRaw } },
    limit: 1,
    depth: 0,
  });
  const stock = stockRes.docs[0] as { currency?: string } | undefined;
  const currency = (stock?.currency === 'EUR' ? 'EUR' : 'USD') as 'USD' | 'EUR';

  const { docs } = await payload.find({
    collection: 'price-history',
    where: {
      and: [
        { ticker: { equals: tickerRaw } },
        { interval: { equals: intervalValue } },
        { date: { greater_than_equal: sinceYmd } },
      ],
    },
    sort: 'date',
    limit: 5000,
    depth: 0,
    pagination: false,
  });

  const prices = (docs as unknown as Array<{ date: string; close: number }>).map((d) => ({
    date: d.date,
    close: d.close,
  }));

  return NextResponse.json({
    ticker: tickerRaw,
    period,
    interval: intervalValue,
    currency,
    prices,
  });
}
