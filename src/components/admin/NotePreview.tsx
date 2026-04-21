'use client';

import { useField } from '@payloadcms/ui';
import type { RecentContext, RecentContextNews } from '@/types/stocks';
import s from './NotePreview.module.css';

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
    <div className={s.wrap}>
      <div className={s.header}>
        <strong className={s.headerTitle}>AI Note preview</strong>
        {updatedAt && <span className={s.headerDate}>Last generated: {formatDate(updatedAt)}</span>}
      </div>
      {trimmed ? (
        <>
          <div className={s.noteContent}>{trimmed}</div>
          <div className={s.disclaimer}>
            Generováno AI. Nejedná se o investiční doporučení ani nabídku ke koupi či prodeji cenných papírů. Pouze
            informativní účel.
          </div>
        </>
      ) : (
        <div className={s.empty}>Poznámka nebyla vygenerována. Klikni &quot;Regenerate AI note&quot; výše.</div>
      )}
      {news.length > 0 && (
        <div className={s.newsSection}>
          <div className={s.newsLabel}>Zdroje z Yahoo (recent news)</div>
          <ol className={s.newsList}>
            {news.map((n, i) => (
              <li key={`${i}-${n.link}`}>
                <a href={n.link} target="_blank" rel="noreferrer" title={n.title} className={s.newsLink}>
                  {n.publisher || 'Zdroj'}
                  {n.publishedAt ? ` (${formatShortDate(n.publishedAt)})` : ''}
                </a>
                {n.title && (
                  <span className={s.newsSnippet}>— {n.title.length > 80 ? n.title.slice(0, 80) + '…' : n.title}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
