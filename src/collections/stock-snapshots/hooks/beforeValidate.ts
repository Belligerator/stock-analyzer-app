import type { CollectionBeforeValidateHook } from 'payload';
import type { Stock } from '@/payload-types';

const FROZEN_KEYS = [
  'price',
  'currency',
  'pe',
  'fwdPe',
  'peg',
  'gain52w',
  'marketCap',
  'evToEbitda',
  'revenueGrowthYoY',
  'earningsGrowthYoY',
  'profitMargin',
  'grossMargin',
  'operatingMargin',
  'roe',
  'roa',
  'freeCashFlow',
  'debtToEquity',
  'avgTarget',
  'targetHigh',
  'targetLow',
  'numAnalysts',
  'cons',
  'analystBreakdown',
  'insiderActivity',
  'sources',
  'note',
  'recentContext',
  'metricsUpdatedAt',
  'noteUpdatedAt',
  'analystLastActionDate',
] as const;

type FrozenKey = (typeof FROZEN_KEYS)[number];

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.length === 0;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') {
    const vals = Object.values(v as Record<string, unknown>);
    return vals.length === 0 || vals.every((x) => x == null);
  }
  return false;
}

export const beforeValidateSnapshot: CollectionBeforeValidateHook = async ({ data, req, operation }) => {
  if (!data) return data;
  if (operation !== 'create') return data;

  const stockRef = data.stock as unknown;
  const stockId =
    typeof stockRef === 'number' || typeof stockRef === 'string'
      ? stockRef
      : stockRef && typeof stockRef === 'object' && 'id' in stockRef
        ? (stockRef as { id: number | string }).id
        : null;
  if (stockId == null) return data;

  let stock: Stock | null = null;
  try {
    stock = (await req.payload.findByID({
      collection: 'stocks',
      id: stockId,
      depth: 0,
    })) as Stock | null;
  } catch {
    return data;
  }
  if (!stock) return data;

  if (!data.ticker) data.ticker = stock.ticker;
  if (!data.takenAt) {
    data.takenAt = stock.metricsUpdatedAt ?? new Date().toISOString();
  }

  for (const key of FROZEN_KEYS) {
    const k = key as FrozenKey;
    const current = (data as Record<string, unknown>)[k];
    const fromStock = (stock as unknown as Record<string, unknown>)[k];
    if (!isEmpty(current) || isEmpty(fromStock)) continue;

    if (k === 'sources' && Array.isArray(fromStock)) {
      (data as Record<string, unknown>)[k] = (fromStock as Array<{ url?: string | null }>).map((src) => ({
        url: src?.url ?? undefined,
      }));
    } else {
      (data as Record<string, unknown>)[k] = fromStock;
    }
  }

  return data;
};
