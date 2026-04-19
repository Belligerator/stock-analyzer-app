import { NextResponse, type NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { enrichNotes } from '@/lib/enrich-notes';

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
    // no body
  }

  console.log(`[actions:refresh-notes] triggered${tickers ? ` for [${tickers.join(',')}]` : ' (all active)'}`);
  try {
    const summary = await enrichNotes({ tickers });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[actions:refresh-notes] fatal: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
