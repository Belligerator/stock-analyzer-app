'use client';

import { useState } from 'react';
import { useDocumentInfo } from '@payloadcms/ui';

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
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <button type="button" onClick={() => run('refresh-stocks')} disabled={running} style={buttonStyle(running)}>
        {state.status === 'running' && state.label === 'Refreshing…' ? state.label : 'Refresh metrics'}
      </button>
      <button type="button" onClick={() => run('refresh-notes')} disabled={running} style={buttonStyle(running)}>
        {state.status === 'running' && state.label === 'Generating note…' ? state.label : 'Regenerate AI note'}
      </button>
      {state.status === 'ok' && <span style={{ color: '#22c55e', fontSize: 12 }}>{state.message}</span>}
      {state.status === 'error' && <span style={{ color: '#ef4444', fontSize: 12 }}>{state.message}</span>}
    </div>
  );
}

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    fontSize: 12,
    borderRadius: 4,
    border: '1px solid var(--theme-elevation-150)',
    background: 'var(--theme-elevation-100)',
    color: 'var(--theme-text)',
    cursor: disabled ? 'wait' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}
