'use client';

import { useState } from 'react';

type Kind = 'refresh-stocks' | 'refresh-notes';

type ActionState =
  | { status: 'idle' }
  | { status: 'running'; kind: Kind; startedAt: number }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string };

type RefreshStocksResponse = {
  ok?: boolean;
  error?: string;
  total?: number;
  okCount?: number;
  failed?: number;
  durationMs?: number;
};

type RefreshNotesResponse = {
  ok?: boolean;
  error?: string;
  total?: number;
  updated?: number;
  skipped?: number;
  failed?: number;
  normalCount?: number;
  highCount?: number;
  durationMs?: number;
  totalUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    webSearchRequests?: number;
    webFetchRequests?: number;
    costUsd?: number;
  };
};

function formatDuration(ms: number | undefined): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(usd: number | undefined): string {
  if (usd == null) return '';
  return `$${usd.toFixed(4)}`;
}

async function callAction(kind: Kind): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`/api/actions/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({}),
  });

  if (kind === 'refresh-stocks') {
    const json = (await res.json()) as RefreshStocksResponse;
    if (!res.ok || json.ok === false) {
      return { ok: false, message: json.error ?? `HTTP ${res.status}` };
    }
    return {
      ok: true,
      message: `Refreshed ${json.okCount ?? 0}/${json.total ?? 0} tickers in ${formatDuration(json.durationMs)} (${json.failed ?? 0} failed).`,
    };
  }

  const json = (await res.json()) as RefreshNotesResponse;
  if (!res.ok || json.ok === false) {
    return { ok: false, message: json.error ?? `HTTP ${res.status}` };
  }
  const u = json.totalUsage;
  const parts = [
    `${json.updated ?? 0} updated`,
    `${json.skipped ?? 0} skipped`,
    `${json.failed ?? 0} failed`,
    `${json.normalCount ?? 0} normal + ${json.highCount ?? 0} high`,
    u ? `${u.inputTokens ?? 0}/${u.outputTokens ?? 0} tokens` : '',
    u ? `${u.webSearchRequests ?? 0}s/${u.webFetchRequests ?? 0}f` : '',
    u ? formatCost(u.costUsd) : '',
    formatDuration(json.durationMs),
  ].filter(Boolean);
  return { ok: true, message: parts.join(' · ') };
}

export function BulkRefreshButtons() {
  const [state, setState] = useState<ActionState>({ status: 'idle' });

  const run = async (kind: Kind) => {
    setState({ status: 'running', kind, startedAt: Date.now() });
    try {
      const result = await callAction(kind);
      setState(
        result.ok
          ? { status: 'ok', message: result.message }
          : { status: 'error', message: result.message }
      );
      if (result.ok) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: 'error', message });
    }
  };

  const running = state.status === 'running';
  const runningStocks = running && state.kind === 'refresh-stocks';
  const runningNotes = running && state.kind === 'refresh-notes';

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 16,
        padding: '12px 14px',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 4,
        background: 'var(--theme-elevation-50)',
      }}
    >
      <strong style={{ fontSize: 12, color: 'var(--theme-text)', marginRight: 4 }}>
        Bulk actions:
      </strong>
      <button
        type="button"
        onClick={() => run('refresh-stocks')}
        disabled={running}
        style={buttonStyle(running)}
        title="Spustí yahoo-finance fetch pro všechny aktivní tickery (trvá ~15–30 s)."
      >
        {runningStocks ? 'Refreshing metrics…' : 'Refresh all metrics'}
      </button>
      <button
        type="button"
        onClick={() => run('refresh-notes')}
        disabled={running}
        style={buttonStyle(running)}
        title="Spustí AI pipeline (Haiku triage → Sonnet/Opus per ticker). Může trvat minuty + stojí $0.10–$2 dle triggerů."
      >
        {runningNotes ? 'Generating AI notes…' : 'Regenerate all AI notes'}
      </button>
      {state.status === 'ok' && (
        <span style={{ color: '#22c55e', fontSize: 11, marginLeft: 4 }}>
          ✓ {state.message}
        </span>
      )}
      {state.status === 'error' && (
        <span style={{ color: '#ef4444', fontSize: 11, marginLeft: 4 }}>
          ✗ {state.message}
        </span>
      )}
      {running && (
        <span style={{ color: 'var(--theme-text-dim)', fontSize: 11, marginLeft: 4 }}>
          Running… ({((Date.now() - state.startedAt) / 1000).toFixed(0)}s elapsed)
        </span>
      )}
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
