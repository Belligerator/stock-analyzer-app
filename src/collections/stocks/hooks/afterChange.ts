import { after } from 'next/server';
import type { CollectionAfterChangeHook } from 'payload';
import { refreshStocks } from '@/lib/refresh-stocks';

export const afterChangeStock: CollectionAfterChangeHook = ({ operation, doc, req }) => {
  if (operation !== 'create') return doc;
  const ticker = typeof doc?.ticker === 'string' ? doc.ticker : null;
  if (!ticker) return doc;

  const scheduleRefresh = async () => {
    try {
      req.payload.logger.info(`[stocks:afterChange] auto-refresh (bg) triggered for ${ticker}`);
      await refreshStocks({ tickers: [ticker] });
      req.payload.logger.info(`[stocks:afterChange] auto-refresh (bg) done for ${ticker}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      req.payload.logger.error(`[stocks:afterChange] auto-refresh (bg) failed for ${ticker}: ${msg}`);
    }
  };

  try {
    after(scheduleRefresh);
  } catch {
    void scheduleRefresh();
  }

  return doc;
};
