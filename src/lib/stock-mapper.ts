import type { Stock as ViewStock, Consensus, Currency, RecentContext } from '@/types/stocks';

type PayloadStockDoc = {
  ticker: string;
  name: string;
  sector: string;
  currency: 'USD' | 'EUR';
  price?: number | null;
  pe?: number | null;
  fwdPe?: number | null;
  gain52w?: number | null;
  avgTarget?: number | null;
  cons?: Consensus | null;
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
    strongBuy?: number | null;
    buy?: number | null;
    hold?: number | null;
    sell?: number | null;
    strongSell?: number | null;
  } | null;
  sources?: Array<{ url?: string | null }> | null;
  note?: string | null;
  metricsUpdatedAt?: string | null;
  analystLastActionDate?: string | null;
  recentContext?: RecentContext | null;
};

const toInt = (v: number | null | undefined): number => (typeof v === 'number' ? v : 0);

function stripCiteTags(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const cleaned = text
    .replace(/<\/?cite\b[^>]*>/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function mapStockDoc(doc: PayloadStockDoc): ViewStock {
  const bd = doc.analystBreakdown;
  const breakdown =
    bd && toInt(bd.strongBuy) + toInt(bd.buy) + toInt(bd.hold) + toInt(bd.sell) + toInt(bd.strongSell) > 0
      ? {
          strongBuy: toInt(bd.strongBuy),
          buy: toInt(bd.buy),
          hold: toInt(bd.hold),
          sell: toInt(bd.sell),
          strongSell: toInt(bd.strongSell),
        }
      : null;

  return {
    ticker: doc.ticker,
    name: doc.name,
    sector: doc.sector,
    currency: doc.currency as Currency,
    price: doc.price ?? 0,
    pe: doc.pe ?? null,
    fwdPe: doc.fwdPe ?? null,
    gain52w: doc.gain52w ?? null,
    avgTarget: doc.avgTarget ?? null,
    cons: (doc.cons ?? 'Hold') as Consensus,
    marketCap: doc.marketCap ?? null,
    revenueGrowthYoY: doc.revenueGrowthYoY ?? null,
    profitMargin: doc.profitMargin ?? null,
    roe: doc.roe ?? null,
    debtToEquity: doc.debtToEquity ?? null,
    peg: doc.peg ?? null,
    targetHigh: doc.targetHigh ?? null,
    targetLow: doc.targetLow ?? null,
    numAnalysts: doc.numAnalysts ?? null,
    analystBreakdown: breakdown,
    note: stripCiteTags(doc.note),
    sources: (doc.sources ?? []).map((s) => s.url).filter((u): u is string => typeof u === 'string' && u.length > 0),
    newsSources: (doc.recentContext?.news ?? [])
      .filter((n) => typeof n.link === 'string' && n.link.length > 0)
      .map((n) => ({
        title: n.title ?? '',
        publisher: n.publisher ?? '',
        link: n.link,
        publishedAt: n.publishedAt ?? '',
      })),
    analystLastActionDate: doc.analystLastActionDate ?? null,
    recommendationTrend: Array.isArray(doc.recentContext?.recommendationTrend)
      ? doc.recentContext!.recommendationTrend
      : [],
    epsRevisions: doc.recentContext?.epsRevisions ?? null,
    updatedAt: doc.metricsUpdatedAt ?? undefined,
  };
}
