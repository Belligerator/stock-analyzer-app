import { getPayload } from 'payload';
import config from '@payload-config';
import { mapStockDoc } from '@/lib/stock-mapper';
import type { StocksDataset } from '@/types/stocks';
import { StockDashboard } from './StockDashboard';

export const dynamic = 'force-dynamic';

export default async function FrontendPage() {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: 'stocks',
    where: { active: { equals: true } },
    limit: 500,
    sort: 'ticker',
    depth: 0,
  });

  const stocks = result.docs.map(doc => mapStockDoc(doc as unknown as Parameters<typeof mapStockDoc>[0]));

  const latestUpdate = stocks
    .map(s => s.updatedAt)
    .filter((d): d is string => typeof d === 'string')
    .sort()
    .at(-1);

  const dataset: StocksDataset = {
    dataAsOf: latestUpdate ?? new Date().toISOString().slice(0, 10),
    sources: ['https://finance.yahoo.com (via yahoo-finance2)'],
    disclaimer: 'Není investiční doporučení. Data jsou informativní, ceny se mění v reálném čase.',
    stocks,
  };

  return <StockDashboard dataset={dataset} />;
}
