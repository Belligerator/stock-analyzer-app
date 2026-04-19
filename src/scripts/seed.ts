import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPayload } from 'payload';
import config from '../payload.config';
import type { Consensus } from '../types/stocks';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const PROJECT_ROOT = path.resolve(dirname, '..', '..');

type StocksJsonStock = {
  ticker: string;
  name: string;
  sector: string;
  currency: 'USD' | 'EUR';
  price: number;
  pe: number | null;
  fwdPe: number | null;
  gain52w: number | null;
  avgTarget: number | null;
  cons: Consensus;
  marketCap?: number | null;
  revenueGrowthYoY?: number | null;
  profitMargin?: number | null;
  roe?: number | null;
  debtToEquity?: number | null;
  peg?: number | null;
  targetHigh?: number | null;
  targetLow?: number | null;
  numAnalysts?: number | null;
  analystBreakdown?: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  } | null;
  sources?: string[];
  updatedAt?: string;
};

type StocksJson = {
  stocks: StocksJsonStock[];
};

type NotesJson = {
  generatedAt: string | null;
  notes: Record<string, string>;
};

const YAHOO_SYMBOL_OVERRIDE: Record<string, string> = {
  DSY: 'DSY.PA',
};

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  if (!process.env.PAYLOAD_SECRET) throw new Error('PAYLOAD_SECRET is not set');

  const payload = await getPayload({ config });

  const [stocksRaw, notesRaw] = await Promise.all([
    readFile(path.join(PROJECT_ROOT, 'public', 'data', 'stocks.json'), 'utf-8'),
    readFile(path.join(PROJECT_ROOT, 'public', 'data', 'notes.json'), 'utf-8').catch(
      () => '{"generatedAt": null, "notes": {}}',
    ),
  ]);

  const stocksData = JSON.parse(stocksRaw) as StocksJson;
  const notesData = JSON.parse(notesRaw) as NotesJson;

  const noteUpdatedAtIso = notesData.generatedAt ? new Date(notesData.generatedAt).toISOString() : null;

  let upserted = 0;
  for (const s of stocksData.stocks) {
    const note = notesData.notes[s.ticker] ?? null;
    const yahooSymbol = YAHOO_SYMBOL_OVERRIDE[s.ticker];

    const data = {
      ticker: s.ticker,
      yahooSymbol,
      name: s.name,
      sector: s.sector,
      currency: s.currency,
      active: true,
      price: s.price,
      pe: s.pe,
      fwdPe: s.fwdPe,
      gain52w: s.gain52w,
      avgTarget: s.avgTarget,
      cons: s.cons,
      marketCap: s.marketCap ?? null,
      revenueGrowthYoY: s.revenueGrowthYoY ?? null,
      profitMargin: s.profitMargin ?? null,
      roe: s.roe ?? null,
      debtToEquity: s.debtToEquity ?? null,
      peg: s.peg ?? null,
      targetHigh: s.targetHigh ?? null,
      targetLow: s.targetLow ?? null,
      numAnalysts: s.numAnalysts ?? null,
      analystBreakdown: s.analystBreakdown ?? undefined,
      sources: (s.sources ?? []).map((url) => ({ url })),
      metricsUpdatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
      note,
      noteUpdatedAt: note ? noteUpdatedAtIso : null,
    };

    const existing = await payload.find({
      collection: 'stocks',
      where: { ticker: { equals: s.ticker } },
      limit: 1,
    });

    if (existing.docs.length > 0) {
      await payload.update({
        collection: 'stocks',
        id: existing.docs[0].id,
        data,
      });
    } else {
      await payload.create({
        collection: 'stocks',
        data,
      });
    }
    upserted++;
    console.log(`  ${s.ticker.padEnd(6)} upserted`);
  }

  console.log(`\nSeed finished: ${upserted} stocks.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
