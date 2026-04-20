'use client';

import { useField } from '@payloadcms/ui';
import type { RecentContext, RecentContextNews } from '@/types/stocks';

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}

function isValidNews(n: unknown): n is RecentContextNews {
  if (!n || typeof n !== 'object') return false;
  const o = n as Partial<RecentContextNews>;
  return typeof o.link === 'string' && o.link.length > 0;
}

export function NotePreview() {
  const { value: note } = useField<string>({ path: 'note' });
  const { value: updatedAt } = useField<string>({ path: 'noteUpdatedAt' });
  const { value: recentContext } = useField<RecentContext>({ path: 'recentContext' });

  const trimmed =
    typeof note === 'string'
      ? note
          .replace(/<\/?cite\b[^>]*>/gi, '')
          .replace(/[ \t]+/g, ' ')
          .replace(/ *\n */g, '\n')
          .trim()
      : '';
  const news: RecentContextNews[] = (recentContext?.news ?? []).filter(isValidNews);

  return (
    <div
      style={{
        marginBottom: 20,
        padding: 16,
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 6,
        background: 'var(--theme-elevation-50)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: '1px solid var(--theme-elevation-100)',
        }}
      >
        <strong style={{ fontSize: 12, color: 'var(--theme-text)' }}>AI Note preview</strong>
        {updatedAt && (
          <span style={{ fontSize: 10, color: 'var(--theme-text-dim)' }}>Last generated: {formatDate(updatedAt)}</span>
        )}
      </div>
      {trimmed ? (
        <>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.7,
              color: 'var(--theme-text)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {trimmed}
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 10,
              lineHeight: 1.5,
              color: 'var(--theme-text-dim)',
              fontStyle: 'italic',
            }}
          >
            Generováno AI. Nejedná se o investiční doporučení ani nabídku ke koupi či prodeji cenných papírů. Pouze
            informativní účel.
          </div>
        </>
      ) : (
        <div
          style={{
            fontSize: 12,
            color: 'var(--theme-text-dim)',
            fontStyle: 'italic',
          }}
        >
          Poznámka nebyla vygenerována. Klikni "Regenerate AI note" výše.
        </div>
      )}
      {news.length > 0 && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: '1px solid var(--theme-elevation-100)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: 'var(--theme-text-dim)',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '.06em',
            }}
          >
            Zdroje z Yahoo (recent news)
          </div>
          <ol
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 11,
              lineHeight: 1.7,
              color: 'var(--theme-text)',
            }}
          >
            {news.map((n, i) => (
              <li key={`${i}-${n.link}`}>
                <a
                  href={n.link}
                  target="_blank"
                  rel="noreferrer"
                  title={n.title}
                  style={{ color: 'var(--theme-text)', textDecoration: 'underline' }}
                >
                  {n.publisher || 'Zdroj'}
                  {n.publishedAt ? ` (${formatShortDate(n.publishedAt)})` : ''}
                </a>
                {n.title && (
                  <span style={{ color: 'var(--theme-text-dim)', marginLeft: 6 }}>
                    — {n.title.length > 80 ? n.title.slice(0, 80) + '…' : n.title}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
