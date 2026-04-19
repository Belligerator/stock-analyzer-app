import { NextResponse, type NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { refreshStocks } from '@/lib/refresh-stocks';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function isAuthed(req: NextRequest): Promise<boolean> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: req.headers });
  return Boolean(user);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let tickers: string[] | undefined;
  try {
    const body = (await req.json()) as { tickers?: unknown } | null;
    if (body && Array.isArray(body.tickers)) {
      tickers = body.tickers.filter((t): t is string => typeof t === 'string');
    }
  } catch {
    // no body or invalid JSON — run for all active
  }

  console.log(`[actions:refresh-stocks] triggered${tickers ? ` for [${tickers.join(',')}]` : ' (all active)'}`);
  try {
    const summary = await refreshStocks({ tickers });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[actions:refresh-stocks] fatal: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
