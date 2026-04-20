'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import s from './SelectionLookup.module.css';

interface SelectionLookupProps {
  containerRef: React.RefObject<HTMLElement | null>;
  context?: string;
}

interface PopoverState {
  term: string;
  anchorX: number;
  anchorY: number;
}

export function SelectionLookup({ containerRef, context }: SelectionLookupProps) {
  const [button, setButton] = useState<PopoverState | null>(null);
  const [popover, setPopover] = useState<
    (PopoverState & { explanation: string | null; loading: boolean; error: string | null; cached: boolean }) | null
  >(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setButton(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const container = containerRef.current;
      if (!container) return;
      const anchorNode = sel.anchorNode;
      const focusNode = sel.focusNode;
      if (!anchorNode || !focusNode) return;
      if (!container.contains(anchorNode) || !container.contains(focusNode)) {
        setButton(null);
        return;
      }
      const term = sel.toString().trim();
      if (term.length < 2 || term.length > 200) {
        setButton(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setButton(null);
        return;
      }
      setButton({ term, anchorX: rect.right, anchorY: rect.top });
    }

    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [containerRef]);

  useEffect(() => {
    if (!popover) return;
    let active = false;
    const armTimer = setTimeout(() => {
      active = true;
    }, 150);
    function onDown(e: MouseEvent) {
      if (!active) return;
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target as Node)) setPopover(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPopover(null);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(armTimer);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [popover]);

  async function openLookup() {
    if (!button) return;
    const { term, anchorX, anchorY } = button;
    setPopover({ term, anchorX, anchorY, explanation: null, loading: true, error: null, cached: false });
    setButton(null);
    await fetchExplanation(term, false);
  }

  async function fetchExplanation(term: string, refresh: boolean) {
    setPopover((prev) =>
      prev ? { ...prev, loading: true, error: null, explanation: refresh ? prev.explanation : null } : prev,
    );
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, context: context ?? '', refresh }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { explanation?: string; cached?: boolean };
      setPopover((prev) =>
        prev ? { ...prev, loading: false, explanation: j.explanation ?? '', cached: j.cached === true } : prev,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'chyba';
      setPopover((prev) => (prev ? { ...prev, loading: false, error: msg } : prev));
    }
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const MARGIN = 8;
  const BTN_SIZE = 22;
  const POP_W = 340;
  const POP_H_ESTIMATE = 160;

  let btnTop = 0;
  let btnLeft = 0;
  if (button) {
    btnTop = Math.min(Math.max(MARGIN, button.anchorY - 2), vh - BTN_SIZE - MARGIN);
    btnLeft = Math.min(button.anchorX + 6, vw - BTN_SIZE - MARGIN);
    if (btnLeft < MARGIN) btnLeft = MARGIN;
  }

  let popTop = 0;
  let popLeft = 0;
  if (popover) {
    const preferBelow = popover.anchorY + 22 + POP_H_ESTIMATE <= vh - MARGIN;
    popTop = preferBelow ? popover.anchorY + 22 : Math.max(MARGIN, popover.anchorY - POP_H_ESTIMATE - 6);
    if (popTop + POP_H_ESTIMATE > vh - MARGIN) popTop = Math.max(MARGIN, vh - POP_H_ESTIMATE - MARGIN);
    const rawLeft = popover.anchorX - POP_W / 2;
    popLeft = Math.min(Math.max(MARGIN, rawLeft), vw - POP_W - MARGIN);
  }

  return createPortal(
    <>
      {button && !popover && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openLookup();
          }}
          title={`Vysvětlit: ${button.term}`}
          className={s.btn}
          style={{ top: btnTop, left: btnLeft }}
        >
          ?
        </button>
      )}
      {popover && (
        <div
          ref={popoverRef}
          onMouseDown={(e) => e.stopPropagation()}
          className={s.popover}
          style={{ top: popTop, left: popLeft }}
        >
          <div className={s.popoverHeader}>
            <div className={s.popoverTerm} title={popover.term}>
              {popover.term}
            </div>
            <button type="button" onClick={() => setPopover(null)} className={s.popoverClose} aria-label="Zavřít">
              ×
            </button>
          </div>
          {popover.loading && !popover.explanation && (
            <div className={s.loading}>Generuji vysvětlení…</div>
          )}
          {!popover.loading && popover.error && (
            <div className={s.error}>Chyba: {popover.error}</div>
          )}
          {popover.explanation && (
            <div style={{ whiteSpace: 'pre-wrap', color: '#e5ecf5', opacity: popover.loading ? 0.5 : 1 }}>
              {popover.explanation}
            </div>
          )}
          {(popover.explanation || popover.error) && (
            <div className={s.popoverFooter}>
              <span>{popover.cached ? 'Z cache' : 'Čerstvě vygenerováno'}</span>
              <button
                type="button"
                onClick={() => fetchExplanation(popover.term, true)}
                disabled={popover.loading}
                className={s.regenBtn}
                style={{ cursor: popover.loading ? 'default' : 'pointer', opacity: popover.loading ? 0.5 : 1 }}
              >
                {popover.loading ? '…' : 'Regenerovat'}
              </button>
            </div>
          )}
        </div>
      )}
    </>,
    document.body,
  );
}
