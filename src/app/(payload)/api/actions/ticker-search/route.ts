import { NextResponse, type NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import YahooFinance from 'yahoo-finance2';

export const dynamic = 'force-dynamic';

const noop = () => undefined;
const yf = new YahooFinance({
  validation: { logErrors: false, logOptionsErrors: false },
  versionCheck: false,
  logger: { info: noop, warn: noop, error: noop, debug: noop, dir: noop },
});

async function isAuthed(req: NextRequest): Promise<boolean> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: req.headers });
  return Boolean(user);
}

export type TickerSearchQuote = {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  quoteType?: string;
  typeDisp?: string;
};

export async function GET(req: NextRequest) {
  if (!(await isAuthed(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 3) {
    return NextResponse.json({ quotes: [] });
  }

  try {
    const result = await yf.search(q, { quotesCount: 10, newsCount: 0 });
    const quotes: TickerSearchQuote[] = (result.quotes ?? [])
      .map((x) => x as Record<string, unknown>)
      .filter((x): x is Record<string, unknown> & { symbol: string } => typeof x.symbol === 'string' && x.symbol.length > 0)
      .map((x) => ({
        symbol: x.symbol,
        shortname: typeof x.shortname === 'string' ? x.shortname : undefined,
        longname: typeof x.longname === 'string' ? x.longname : undefined,
        exchange: typeof x.exchange === 'string' ? x.exchange : undefined,
        quoteType: typeof x.quoteType === 'string' ? x.quoteType : undefined,
        typeDisp: typeof x.typeDisp === 'string' ? x.typeDisp : undefined,
      }));
    return NextResponse.json({ quotes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[actions:ticker-search] failed for "${q}": ${message}`);
    return NextResponse.json({ quotes: [], error: message }, { status: 500 });
  }
}
