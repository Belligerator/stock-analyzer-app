import { NextResponse, type NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { getAnthropicClient, MODEL_EXPLAIN } from '@/lib/anthropic';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_TERM_LEN = 200;
const MAX_CONTEXT_LEN = 1200;

function normalizeKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function generateExplanation(term: string, context: string): Promise<string> {
  const client = getAnthropicClient();
  const res = await client.messages.create({
    model: MODEL_EXPLAIN,
    max_tokens: 200,
    system:
      'Jsi asistent pro rychlé vysvětlování finančních, technologických a business termínů. Odpovídej vždy česky, 1–3 krátké věty, věcně a bez úvodů typu "Tento termín znamená". Pokud termín je nejednoznačný, interpretuj ho podle kontextu. Pokud kontext chybí a termín je neznámý, řekni to krátce.',
    messages: [
      {
        role: 'user',
        content: `Vysvětli krátce, co znamená: "${term}"${
          context ? `\n\nKontext (pasáž z analýzy akcie, kde se termín objevil):\n${context}` : ''
        }`,
      },
    ],
  });
  const block = res.content[0];
  return block && block.type === 'text' ? block.text.trim() : '';
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const raw = body as { term?: unknown; context?: unknown; refresh?: unknown };
  const term = typeof raw.term === 'string' ? raw.term.trim().slice(0, MAX_TERM_LEN) : '';
  const context = typeof raw.context === 'string' ? raw.context.trim().slice(0, MAX_CONTEXT_LEN) : '';
  const refresh = raw.refresh === true;

  if (term.length < 2) {
    return NextResponse.json({ error: 'term too short' }, { status: 400 });
  }

  const key = normalizeKey(term);
  if (key.length < 2) {
    return NextResponse.json({ error: 'term too short' }, { status: 400 });
  }

  const payload = await getPayload({ config });

  const existing = await payload.find({
    collection: 'explanations',
    where: { term: { equals: key } },
    limit: 1,
    depth: 0,
  });
  const hit = existing.docs[0] as { id: string | number; explanation?: string } | undefined;

  if (!refresh && hit?.explanation) {
    return NextResponse.json({
      explanation: hit.explanation,
      cached: true,
    });
  }

  try {
    const explanation = await generateExplanation(term, context);
    if (!explanation) {
      return NextResponse.json({ error: 'empty response' }, { status: 502 });
    }

    if (hit) {
      await payload.update({
        collection: 'explanations',
        id: hit.id,
        data: { explanation, displayTerm: term, model: MODEL_EXPLAIN },
      });
    } else {
      await payload.create({
        collection: 'explanations',
        data: {
          term: key,
          displayTerm: term,
          explanation,
          model: MODEL_EXPLAIN,
        },
      });
    }

    return NextResponse.json({ explanation, cached: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/explain] failed', {
      term,
      key,
      model: MODEL_EXPLAIN,
      error: msg,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
