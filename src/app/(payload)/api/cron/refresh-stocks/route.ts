import { NextResponse, type NextRequest } from 'next/server';
import { refreshStocks } from '@/lib/refresh-stocks';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  console.log('[cron:refresh-stocks] triggered via HTTP');
  try {
    const summary = await refreshStocks();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[cron:refresh-stocks] fatal: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
