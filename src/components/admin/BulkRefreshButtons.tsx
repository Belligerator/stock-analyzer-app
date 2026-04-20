'use client';

import { useState } from 'react';
import s from './BulkRefreshButtons.module.css';

type Kind = 'refresh-stocks' | 'refresh-notes' | 'snapshot-all';

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

type SnapshotAllResponse = {
  ok?: boolean;
  error?: string;
  total?: number;
  okCount?: number;
  failed?: number;
  durationMs?: number;
};

async function callAction(kind: Kind, body?: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`/api/actions/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body ?? {}),
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

  if (kind === 'snapshot-all') {
    const json = (await res.json()) as SnapshotAllResponse;
    if (!res.ok || json.ok === false) {
      return { ok: false, message: json.error ?? `HTTP ${res.status}` };
    }
    return {
      ok: true,
      message: `Created ${json.okCount ?? 0}/${json.total ?? 0} snapshots in ${formatDuration(json.durationMs)} (${json.failed ?? 0} failed).`,
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

  const run = async (kind: Kind, body?: Record<string, unknown>) => {
    setState({ status: 'running', kind, startedAt: Date.now() });
    try {
      const result = await callAction(kind, body);
      setState(result.ok ? { status: 'ok', message: result.message } : { status: 'error', message: result.message });
      if (result.ok && kind !== 'snapshot-all') {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: 'error', message });
    }
  };

  const runSnapshotAll = () => {
    const label = window.prompt(
      'Volitelný label pro všechny snapshoty (např. "Q2 2026"). Nech prázdné pro žádný.',
      '',
    );
    if (label === null) return; // user cancelled
    const body = label.trim().length > 0 ? { label: label.trim() } : {};
    void run('snapshot-all', body);
  };

  const running = state.status === 'running';
  const runningStocks = running && state.kind === 'refresh-stocks';
  const runningNotes = running && state.kind === 'refresh-notes';
  const runningSnapshots = running && state.kind === 'snapshot-all';

  return (
    <div className={s.wrap}>
      <strong className={s.label}>Bulk actions:</strong>
      <button
        type="button"
        onClick={() => run('refresh-stocks')}
        disabled={running}
        className={s.btn}
        style={{ cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1 }}
        title="Spustí yahoo-finance fetch pro všechny aktivní tickery (trvá ~15–30 s)."
      >
        {runningStocks ? 'Refreshing metrics…' : 'Refresh all metrics'}
      </button>
      <button
        type="button"
        onClick={() => run('refresh-notes')}
        disabled={running}
        className={s.btn}
        style={{ cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1 }}
        title="Spustí AI pipeline (Haiku triage → Sonnet/Opus per ticker). Může trvat minuty + stojí $0.10–$2 dle triggerů."
      >
        {runningNotes ? 'Generating AI notes…' : 'Regenerate all AI notes'}
      </button>
      <button
        type="button"
        onClick={runSnapshotAll}
        disabled={running}
        className={s.btn}
        style={{ cursor: running ? 'wait' : 'pointer', opacity: running ? 0.6 : 1 }}
        title="Vytvoří snapshot pro všechny aktivní akcie. Metriky se zkopírují z aktuálního stavu."
      >
        {runningSnapshots ? 'Creating snapshots…' : 'Create snapshots (all active)'}
      </button>
      {state.status === 'ok' && <span className={s.statusOk}>✓ {state.message}</span>}
      {state.status === 'error' && <span className={s.statusError}>✗ {state.message}</span>}
      {running && (
        <span className={s.statusRunning}>
          Running… ({((Date.now() - state.startedAt) / 1000).toFixed(0)}s elapsed)
        </span>
      )}
    </div>
  );
}
