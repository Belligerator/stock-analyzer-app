'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useField, FieldLabel, FieldDescription } from '@payloadcms/ui';
import s from './TickerAutocomplete.module.css';

type Quote = {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  quoteType?: string;
  typeDisp?: string;
};

type Props = {
  path: string;
  field?: {
    label?: string;
    required?: boolean;
    admin?: { description?: string };
  };
};

const DEBOUNCE_MS = 500;
const MIN_CHARS = 3;

export function TickerAutocomplete({ path, field }: Props) {
  const { value, setValue, errorMessage, showError } = useField<string>({ path });
  const { setValue: setYahooSymbol } = useField<string>({ path: 'yahooSymbol' });
  const { setValue: setName } = useField<string>({ path: 'name' });

  const [query, setQuery] = useState<string>(typeof value === 'string' ? value : '');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickedRef = useRef(false);

  useEffect(() => {
    const fieldValue = typeof value === 'string' ? value : '';
    if (fieldValue !== query && fieldValue !== '') {
      setQuery(fieldValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const runSearch = useCallback(async (q: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/actions/ticker-search?q=${encodeURIComponent(q)}`, {
        credentials: 'include',
        signal: controller.signal,
      });
      const json = (await res.json()) as { quotes?: Quote[]; error?: string };
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        setQuotes([]);
        return;
      }
      setQuotes(json.quotes ?? []);
      setActiveIndex(-1);
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : String(err));
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (pickedRef.current) {
      pickedRef.current = false;
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < MIN_CHARS) {
      setQuotes([]);
      setError(null);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(trimmed);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = useCallback(
    (quote: Quote) => {
      const symbol = quote.symbol;
      const hasExchangeSuffix = symbol.includes('.');
      const baseTicker = hasExchangeSuffix ? symbol.split('.')[0] : symbol;
      const displayName = quote.longname ?? quote.shortname ?? '';

      pickedRef.current = true;
      setValue(baseTicker.toUpperCase());
      setYahooSymbol(hasExchangeSuffix ? symbol : '');
      if (displayName) setName(displayName);

      setQuery(baseTicker.toUpperCase());
      setQuotes([]);
      setOpen(false);
      setActiveIndex(-1);
    },
    [setName, setValue, setYahooSymbol],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || quotes.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % quotes.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? quotes.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pick(quotes[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const label = field?.label ?? 'Ticker';
  const description = field?.admin?.description;
  const required = field?.required;

  const showDropdown = useMemo(
    () => open && (loading || error !== null || quotes.length > 0),
    [open, loading, error, quotes.length],
  );

  return (
    <div className="field-type text">
      <FieldLabel label={label} required={required} path={path} />
      <div className={s.wrap} ref={wrapRef}>
        <input
          type="text"
          className={s.input}
          style={showError ? { borderColor: '#ef4444' } : undefined}
          value={query}
          onChange={(e) => {
            const v = e.target.value.trim();
            setQuery(v);
            setValue(v.length > 0 ? v.toUpperCase() : '');
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        {showDropdown && (
          <div className={s.dropdown}>
            {loading && <div className={s.status}>Hledám…</div>}
            {error && <div className={`${s.status} ${s.statusError}`}>{error}</div>}
            {!loading && !error && quotes.length === 0 && query.trim().length >= MIN_CHARS && (
              <div className={s.status}>Žádné výsledky.</div>
            )}
            {quotes.map((q, i) => (
              <div
                key={`${q.symbol}-${i}`}
                className={`${s.item} ${i === activeIndex ? s.itemActive : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(q);
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <div className={s.itemTop}>
                  <span className={s.symbol}>{q.symbol}</span>
                  <span className={s.meta}>
                    {[q.typeDisp ?? q.quoteType, q.exchange].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div className={s.name}>{q.longname ?? q.shortname ?? ''}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {description && <FieldDescription path={path} description={description} />}
      {showError && errorMessage && (
        <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{String(errorMessage)}</div>
      )}
    </div>
  );
}
