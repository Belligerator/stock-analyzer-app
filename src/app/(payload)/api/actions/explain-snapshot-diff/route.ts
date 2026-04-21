import { NextResponse, type NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { Stock, StockSnapshot } from '@/payload-types';
import { getAnthropicClient, MODEL_ANALYZE_NORMAL } from '@/lib/anthropic';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_TOKENS = 1200;

const SYSTEM_PROMPT = `Jsi finanční analytik. Dostaneš dva snapshoty téže akcie — A (starší / referenční) a B (novější / aktuální). Napiš v češtině (4–8 vět) srozumitelné shrnutí toho, co se mezi A a B změnilo a co to znamená pro kvalitu firmy a valuaci. Cíl: aby se uživatel z každé změny **něco naučil**.

# Pravidla

1. **Propojuj metriky, nečti výčet.** Místo "P/E 25 → 30" napiš "P/E vzrostlo z 25 na 30, což je 20% multiple expansion — akcie zdražila relativně rychleji, než rostl zisk. Trh začal oceňovat budoucí růst agresivněji."
2. **Jaký to má smysl?** U každé významné změny popiš co to znamená pro byznys (klesající gross margin = ztráta cenové síly; vyšší insider buying = bullish signál; atd.).
3. **Propojuj s kontextem.** Pokud A nebo B mají recent news / upgrades / sigDevs, použij je k vysvětlení proč se metrika pohnula.
4. **Nezahrnuj vše.** Vyber 3–5 nejdůležitějších posunů a ty popiš. Drobné změny v rámci šumu (< 5% pohyb u valuation multiples, < 2pp u marginů) přeskoč.
5. **Závěr.** Poslední věta: je firma teď v LEPŠÍ, HORŠÍ nebo PODOBNÉ kondici než při A? Stručně proč.
6. **Formát.** Čistý plain text, bez nadpisů, bez bullet pointů, bez markdown. 4–8 vět v prostém odstavci. Pokud je text delší, oddělovej odstavce prázdným řádkem.
7. **Zakázané preambule.** Nepiš "Napíšu shrnutí…", "Analyzuji…", "Podívám se…". První věta musí být přímo faktická.
8. **Když se reálně nic nezměnilo** (všechny metriky v šumu) → napiš 1–2 věty že pozice je stabilní a co za to může (např. žádné material events).

# Cílová skupina
Smíšená (laik + zkušený investor). Obecné pojmy (P/E, margin, ROE) nevysvětluj, ale **vysvětli důsledek konkrétního pohybu** pro firmu.`;

type Body = {
  snapshotAId?: unknown;
  snapshotBId?: unknown;
  force?: unknown;
};

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

function isoOrEmpty(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  return '';
}

function recentContextSummary(ctx: unknown): unknown {
  if (!ctx || typeof ctx !== 'object') return null;
  const c = ctx as Record<string, unknown>;
  const pickArr = (key: string, limit: number): unknown[] => {
    const arr = c[key];
    return Array.isArray(arr) ? arr.slice(0, limit) : [];
  };
  return {
    news: pickArr('news', 5),
    sigDevs: pickArr('sigDevs', 5),
    upgrades: pickArr('upgrades', 5),
    researchReports: (pickArr('researchReports', 3) as Array<Record<string, unknown>>).map((r) => ({
      title: r.title,
      provider: r.provider,
      investmentRating: r.investmentRating,
      targetPrice: r.targetPrice,
      reportDate: r.reportDate,
    })),
    nextEarnings: c.nextEarnings,
  };
}

function snapshotPayload(source: StockSnapshot | (Stock & { takenAt?: string })): unknown {
  const s = source as unknown as Record<string, unknown>;
  return {
    takenAt: isoOrEmpty(s.takenAt ?? s.metricsUpdatedAt),
    label: s.label ?? null,
    metricsUpdatedAt: isoOrEmpty(s.metricsUpdatedAt),
    noteUpdatedAt: isoOrEmpty(s.noteUpdatedAt),
    analystLastActionDate: isoOrEmpty(s.analystLastActionDate),
    metrics: {
      price: s.price,
      currency: s.currency,
      pe: s.pe,
      fwdPe: s.fwdPe,
      peg: s.peg,
      evToEbitda: s.evToEbitda,
      gain52w: s.gain52w,
      marketCap: s.marketCap,
      revenueGrowthYoY: s.revenueGrowthYoY,
      earningsGrowthYoY: s.earningsGrowthYoY,
      grossMargin: s.grossMargin,
      operatingMargin: s.operatingMargin,
      profitMargin: s.profitMargin,
      roe: s.roe,
      roa: s.roa,
      freeCashFlowUsdB: s.freeCashFlow,
      debtToEquity: s.debtToEquity,
      avgTarget: s.avgTarget,
      targetHigh: s.targetHigh,
      targetLow: s.targetLow,
      numAnalysts: s.numAnalysts,
      cons: s.cons,
      analystBreakdown: s.analystBreakdown,
      insiderActivity: s.insiderActivity,
    },
    note: s.note ?? null,
    recentContext: recentContextSummary(s.recentContext),
  };
}

export async function GET(req: NextRequest) {
  const payload = await getPayload({ config });
  const url = new URL(req.url);
  const aId = str(url.searchParams.get('snapshotAId') ?? undefined);
  const bId = str(url.searchParams.get('snapshotBId') ?? undefined);
  if (!aId || !bId) {
    return NextResponse.json({ error: 'snapshotAId and snapshotBId are required' }, { status: 400 });
  }
  if (aId === 'current' || bId === 'current') {
    return NextResponse.json({ ok: true, exists: false });
  }
  const { docs } = await payload.find({
    collection: 'snapshot-comparisons',
    where: {
      and: [{ snapshotA: { equals: aId } }, { snapshotB: { equals: bId } }],
    },
    limit: 1,
    depth: 0,
  });
  const cached = docs[0];
  if (!cached) {
    return NextResponse.json({ ok: true, exists: false });
  }
  return NextResponse.json({
    ok: true,
    exists: true,
    explanation: cached.explanation,
    model: cached.model,
    generatedAt: cached.generatedAt,
  });
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: req.headers });
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const aId = str(body.snapshotAId);
  const bId = str(body.snapshotBId);
  const force = body.force === true;

  if (!aId || !bId) {
    return NextResponse.json({ error: 'snapshotAId and snapshotBId are required' }, { status: 400 });
  }
  if (aId === bId) {
    return NextResponse.json({ error: 'snapshotA and snapshotB must differ' }, { status: 400 });
  }

  const aIsCurrent = aId === 'current';
  const bIsCurrent = bId === 'current';

  let docA: StockSnapshot | (Stock & { takenAt?: string }) | null = null;
  let docB: StockSnapshot | (Stock & { takenAt?: string }) | null = null;
  let ticker = '';

  try {
    if (aIsCurrent || bIsCurrent) {
      // 'current' side needs a ticker context → take it from the other side.
      const realId = aIsCurrent ? bId : aId;
      const realSnap = await payload.findByID({
        collection: 'stock-snapshots',
        id: realId,
        depth: 0,
      });
      ticker = (realSnap as { ticker?: string }).ticker ?? '';
      const { docs } = await payload.find({
        collection: 'stocks',
        where: { ticker: { equals: ticker } },
        limit: 1,
        depth: 0,
      });
      const stock = docs[0] as Stock | undefined;
      if (!stock) {
        return NextResponse.json({ error: 'stock not found for current' }, { status: 404 });
      }
      if (aIsCurrent) {
        docA = { ...stock, takenAt: stock.metricsUpdatedAt ?? new Date().toISOString() };
        docB = realSnap as StockSnapshot;
      } else {
        docA = realSnap as StockSnapshot;
        docB = { ...stock, takenAt: stock.metricsUpdatedAt ?? new Date().toISOString() };
      }
    } else {
      const [a, b] = await Promise.all([
        payload.findByID({ collection: 'stock-snapshots', id: aId, depth: 0 }),
        payload.findByID({ collection: 'stock-snapshots', id: bId, depth: 0 }),
      ]);
      docA = a as StockSnapshot;
      docB = b as StockSnapshot;
      ticker = (a as { ticker?: string }).ticker ?? (b as { ticker?: string }).ticker ?? '';
    }
  } catch {
    return NextResponse.json({ error: 'snapshot not found' }, { status: 404 });
  }

  if (!docA || !docB) {
    return NextResponse.json({ error: 'snapshot data missing' }, { status: 404 });
  }

  // Check cache (only for snapshot↔snapshot pairs; 'current' is never cached).
  const cacheable = !aIsCurrent && !bIsCurrent;
  if (cacheable && !force) {
    const { docs } = await payload.find({
      collection: 'snapshot-comparisons',
      where: {
        and: [{ snapshotA: { equals: aId } }, { snapshotB: { equals: bId } }],
      },
      limit: 1,
      depth: 0,
    });
    const cached = docs[0];
    if (cached) {
      return NextResponse.json({
        ok: true,
        cached: true,
        explanation: cached.explanation,
        model: cached.model,
        generatedAt: cached.generatedAt,
      });
    }
  }

  const userMessage = JSON.stringify(
    {
      ticker,
      A: snapshotPayload(docA),
      B: snapshotPayload(docB),
    },
    null,
    2,
  );

  const client = getAnthropicClient();
  let text: string;
  try {
    const response = await client.messages.create({
      model: MODEL_ANALYZE_NORMAL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    text = response.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'anthropic call failed' },
      { status: 502 },
    );
  }

  const generatedAt = new Date().toISOString();

  if (cacheable) {
    try {
      await payload.create({
        collection: 'snapshot-comparisons',
        data: {
          ticker,
          snapshotA: aId,
          snapshotB: bId,
          explanation: text,
          model: MODEL_ANALYZE_NORMAL,
          generatedAt,
        },
      });
    } catch {
      // Race condition: another request cached it first. Fetch and return.
      const { docs } = await payload.find({
        collection: 'snapshot-comparisons',
        where: {
          and: [{ snapshotA: { equals: aId } }, { snapshotB: { equals: bId } }],
        },
        limit: 1,
        depth: 0,
      });
      const cached = docs[0];
      if (cached) {
        return NextResponse.json({
          ok: true,
          cached: true,
          explanation: cached.explanation,
          model: cached.model,
          generatedAt: cached.generatedAt,
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    cached: false,
    explanation: text,
    model: MODEL_ANALYZE_NORMAL,
    generatedAt,
  });
}
