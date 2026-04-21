import { NextResponse, type NextRequest } from 'next/server';
import { getPayload, type Where } from 'payload';
import config from '@payload-config';
import type { Stock } from '@/payload-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Body = {
  label?: unknown;
  tickers?: unknown;
};

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: req.headers });
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // empty body is fine — defaults to all active
  }

  const label = str(body.label);
  const tickers =
    Array.isArray(body.tickers) && body.tickers.length > 0
      ? body.tickers.filter((t): t is string => typeof t === 'string')
      : null;

  const where: Where = tickers ? { ticker: { in: tickers.map((t) => t.toUpperCase()) } } : { active: { equals: true } };

  const start = Date.now();
  const { docs } = await payload.find({
    collection: 'stocks',
    where,
    limit: 500,
    depth: 0,
    overrideAccess: true,
  });

  const results: Array<{ ticker: string; status: 'ok' | 'error'; id?: string | number; error?: string }> = [];

  for (const doc of docs as Stock[]) {
    try {
      const snap = await payload.create({
        collection: 'stock-snapshots',
        data: {
          stock: doc.id,
          ticker: doc.ticker,
          takenAt: doc.metricsUpdatedAt ?? new Date().toISOString(),
          label,
        },
        overrideAccess: true,
      });
      results.push({ ticker: doc.ticker, status: 'ok', id: snap.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ ticker: doc.ticker, status: 'error', error: message });
    }
  }

  const okCount = results.filter((r) => r.status === 'ok').length;
  return NextResponse.json({
    ok: true,
    total: results.length,
    okCount,
    failed: results.length - okCount,
    durationMs: Date.now() - start,
    results,
  });
}
