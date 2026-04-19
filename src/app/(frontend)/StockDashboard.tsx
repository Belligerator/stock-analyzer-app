'use client';

import { useMemo, useState } from 'react';
import type { Stock, StocksDataset } from '@/types/stocks';
import { Header } from '@/components/Header';
import { SectorFilter } from '@/components/SectorFilter';
import { StockTable } from '@/components/StockTable';
import { Legend } from '@/components/Legend';
import { StockModal } from '@/components/StockModal';

export function StockDashboard({ dataset }: { dataset: StocksDataset }) {
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<Stock | null>(null);

  const sectors = useMemo(() => ['All', ...Array.from(new Set(dataset.stocks.map((s) => s.sector)))], [dataset.stocks]);

  const filtered = useMemo(
    () => (filter === 'All' ? dataset.stocks : dataset.stocks.filter((s) => s.sector === filter)),
    [dataset.stocks, filter],
  );

  return (
    <div style={{ minHeight: '100vh', padding: '20px 12px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Header dataAsOf={dataset.dataAsOf} sources={dataset.sources} />
        <SectorFilter sectors={sectors} value={filter} onChange={setFilter} />
        <StockTable stocks={filtered} onSelect={setSelected} />
        <Legend disclaimer={dataset.disclaimer} />
      </div>
      <StockModal stock={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
