import { NextResponse, type NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { Stock } from '@/payload-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Body = {
  ticker?: unknown;
  label?: unknown;
  myPrediction?: unknown;
  myNote?: unknown;
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
    // allow empty body — but require ticker
  }

  const tickerRaw = str(body.ticker);
  if (!tickerRaw) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  }
  const ticker = tickerRaw.toUpperCase();

  const { docs } = await payload.find({
    collection: 'stocks',
    where: { ticker: { equals: ticker } },
    limit: 1,
    depth: 0,
  });
  const stock = docs[0] as Stock | undefined;
  if (!stock) {
    return NextResponse.json({ error: 'stock not found' }, { status: 404 });
  }

  // The beforeValidate hook on stock-snapshots copies all frozen metrics
  // from the linked stock when they're empty — we only set user inputs.
  const snapshot = await payload.create({
    collection: 'stock-snapshots',
    data: {
      stock: stock.id,
      ticker: stock.ticker,
      takenAt: stock.metricsUpdatedAt ?? new Date().toISOString(),
      label: str(body.label),
      myPrediction: str(body.myPrediction),
      myNote: str(body.myNote),
    },
  });

  return NextResponse.json({ ok: true, id: snapshot.id });
}
