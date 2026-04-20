'use client';

import { useState } from 'react';
import { useDocumentInfo } from '@payloadcms/ui';
import s from './CreateSnapshotButton.module.css';

type State =
  | { status: 'idle' }
  | { status: 'form' }
  | { status: 'saving' }
  | { status: 'ok'; id: string | number }
  | { status: 'error'; message: string };

type CreateResponse = { ok?: boolean; id?: string | number; error?: string };

export function CreateSnapshotButton() {
  const info = useDocumentInfo();
  const doc = (info as unknown as { savedDocumentData?: { ticker?: string } }).savedDocumentData;
  const ticker = doc?.ticker;
  const [state, setState] = useState<State>({ status: 'idle' });
  const [label, setLabel] = useState('');
  const [myPrediction, setMyPrediction] = useState('');
  const [myNote, setMyNote] = useState('');

  if (!ticker) return null;

  const submit = async () => {
    setState({ status: 'saving' });
    try {
      const res = await fetch('/api/actions/create-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ticker, label, myPrediction, myNote }),
      });
      const json = (await res.json()) as CreateResponse;
      if (!res.ok || json.ok === false || !json.id) {
        setState({ status: 'error', message: json.error ?? `HTTP ${res.status}` });
        return;
      }
      setState({ status: 'ok', id: json.id });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  if (state.status === 'ok') {
    return (
      <div className={s.wrap}>
        <span className={s.statusOk}>Snapshot saved.</span>
        <a className={s.link} href={`/admin/collections/stock-snapshots/${state.id}`}>
          Open snapshot →
        </a>
        <a className={s.link} href={`/admin/snapshots/compare?ticker=${ticker}`}>
          Compare →
        </a>
      </div>
    );
  }

  if (state.status === 'form' || state.status === 'saving') {
    const saving = state.status === 'saving';
    return (
      <div className={s.form}>
        <input
          className={s.input}
          placeholder='Label (např. "před Q2 earnings")'
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={saving}
        />
        <textarea
          className={s.textarea}
          placeholder="Moje predikce (volitelné)"
          rows={3}
          value={myPrediction}
          onChange={(e) => setMyPrediction(e.target.value)}
          disabled={saving}
        />
        <textarea
          className={s.textarea}
          placeholder="Dodatečný komentář (volitelné)"
          rows={3}
          value={myNote}
          onChange={(e) => setMyNote(e.target.value)}
          disabled={saving}
        />
        <div className={s.row}>
          <button type="button" className={s.btn} onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save snapshot'}
          </button>
          <button
            type="button"
            className={s.btnSecondary}
            onClick={() => setState({ status: 'idle' })}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <button type="button" className={s.btn} onClick={() => setState({ status: 'form' })}>
        Create snapshot
      </button>
      <a className={s.link} href={`/admin/snapshots/compare?ticker=${ticker}`}>
        Compare snapshots →
      </a>
      {state.status === 'error' && <span className={s.statusError}>{state.message}</span>}
    </div>
  );
}
