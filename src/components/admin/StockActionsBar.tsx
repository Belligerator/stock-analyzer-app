'use client';

import { RefreshStockButton } from './RefreshStockButton';
import { CreateSnapshotButton } from './CreateSnapshotButton';
import s from './StockActionsBar.module.css';

export function StockActionsBar() {
  return (
    <div className={s.bar}>
      <RefreshStockButton />
      <CreateSnapshotButton />
    </div>
  );
}
