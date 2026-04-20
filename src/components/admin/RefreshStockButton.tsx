'use client';

import { useState } from 'react';
import { useDocumentInfo } from '@payloadcms/ui';
import s from './RefreshStockButton.module.css';

type ActionState =
  | { status: 'idle' }
  | { status: 'running'; label: string }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string };

type RefreshStocksResponse = {
  ok?: boolean;
  error?: string;
  okCount?: number;
  failed?: number;
};

type RefreshNotesResponse = {
  ok?: boolean;
  error?: string;
  updated?: number;
  failed?: number;
};

async function callAction(
  endpoint: 'refresh-stocks' | 'refresh-notes',
  ticker: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`/api/actions/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tickers: [ticker] }),
  });
  const json = (await res.json()) as RefreshStocksResponse & RefreshNotesResponse;
  if (!res.ok || json.ok === false) {
    return { ok: false, message: json.error ?? `HTTP ${res.status}` };
  }
  if (endpoint === 'refresh-stocks') {
    return {
      ok: true,
      message: `Metrics refreshed (ok: ${json.okCount ?? 0}, failed: ${json.failed ?? 0}).`,
    };
  }
  return {
    ok: true,
    message: `Note regenerated (updated: ${json.updated ?? 0}, failed: ${json.failed ?? 0}).`,
  };
}

export function RefreshStockButton() {
  const info = useDocumentInfo();
  const doc = (info as unknown as { savedDocumentData?: { ticker?: string; id?: string | number } }).savedDocumentData;
  const ticker = doc?.ticker;
  const [state, setState] = useState<ActionState>({ status: 'idle' });

  if (!ticker) return null;

  const run = async (kind: 'refresh-stocks' | 'refresh-notes') => {
    setState({
      status: 'running',
      label: kind === 'refresh-stocks' ? 'Refreshing…' : 'Generating note…',
    });
    try {
      const result = await callAction(kind, ticker);
      setState(result.ok ? { status: 'ok', message: result.message } : { status: 'error', message: result.message });
      if (result.ok) {
        setTimeout(() => window.location.reload(), 900);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: 'error', message });
    }
  };

  const running = state.status === 'running';

  return (
    <div className={s.wrap}>
      <button
        type="button"
        onClick={() => run('refresh-stocks')}
        disabled={running}
        className={s.btn}
        style={{ cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1 }}
      >
        {state.status === 'running' && state.label === 'Refreshing…' ? state.label : 'Refresh metrics'}
      </button>
      <button
        type="button"
        onClick={() => run('refresh-notes')}
        disabled={running}
        className={s.btn}
        style={{ cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1 }}
      >
        {state.status === 'running' && state.label === 'Generating note…' ? state.label : 'Regenerate AI note'}
      </button>
      {state.status === 'ok' && <span className={s.statusOk}>{state.message}</span>}
      {state.status === 'error' && <span className={s.statusError}>{state.message}</span>}
    </div>
  );
}
