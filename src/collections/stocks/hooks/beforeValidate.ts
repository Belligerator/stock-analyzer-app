import { ValidationError, type CollectionBeforeValidateHook } from 'payload';

export const beforeValidateStock: CollectionBeforeValidateHook = async ({ data, operation, req, originalDoc }) => {
  if (operation !== 'create' && operation !== 'update') return data;
  if (!data) return data;

  if (typeof data.ticker === 'string') {
    data.ticker = data.ticker.trim().toUpperCase();
  }
  if (typeof data.yahooSymbol === 'string') {
    const raw = data.yahooSymbol.trim();
    const match = raw.match(/\/quote\/([^/?#]+)/i);
    data.yahooSymbol = match ? decodeURIComponent(match[1]) : raw;
  }

  if (typeof data.ticker === 'string' && data.ticker.length > 0) {
    const currentId = originalDoc?.id;
    const existing = await req.payload.find({
      collection: 'stocks',
      where: { ticker: { equals: data.ticker } },
      limit: 1,
      depth: 0,
    });
    const duplicate = existing.docs.find((d) => d.id !== currentId);
    if (duplicate) {
      throw new ValidationError({
        collection: 'stocks',
        errors: [
          {
            path: 'ticker',
            message: `Ticker "${data.ticker}" už existuje (stock ID ${duplicate.id}).`,
          },
        ],
      });
    }
  }

  return data;
};
