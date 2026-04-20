'use client';

import { useField } from '@payloadcms/ui';
import type { RecentContext } from '@/types/stocks';
import s from './AnalystActivityPanel.module.css';

type Tone = 'fresh' | 'stale' | 'old' | 'unknown';

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' });
}

function staleness(lastAction: string | null | undefined, referenceAt: string | null | undefined): {
  days: number | null;
  tone: Tone;
  label: string;
} {
  if (!lastAction || !referenceAt) return { days: null, tone: 'unknown', label: 'neznámá čerstvost' };
  const last = Date.parse(lastAction);
  const ref = Date.parse(referenceAt);
  if (Number.isNaN(last) || Number.isNaN(ref)) {
    return { days: null, tone: 'unknown', label: 'neznámá čerstvost' };
  }
  const days = Math.round((ref - last) / 86_400_000);
  const abs = Math.abs(days);
  let tone: Tone = 'fresh';
  if (abs > 90) tone = 'old';
  else if (abs > 30) tone = 'stale';
  const label = days >= 0 ? `${abs} dní zpět` : `za ${abs} dní`;
  return { days: abs, tone, label };
}

export function AnalystActivityPanel() {
  const { value: recentContext } = useField<RecentContext>({ path: 'recentContext' });
  const { value: lastAction } = useField<string>({ path: 'analystLastActionDate' });
  const { value: metricsUpdatedAt } = useField<string>({ path: 'metricsUpdatedAt' });

  const trend = Array.isArray(recentContext?.recommendationTrend) ? recentContext!.recommendationTrend : [];
  const revisions = recentContext?.epsRevisions ?? null;
  const st = staleness(lastAction, metricsUpdatedAt ?? new Date().toISOString());

  const hasAny = lastAction || trend.length > 0 || revisions;
  if (!hasAny) {
    return (
      <div className={s.wrap}>
        <div className={s.header}>
          <strong>Aktivita analytiků</strong>
        </div>
        <div className={s.empty}>
          Data se naplní po nejbližším refreshi metrik.
        </div>
      </div>
    );
  }

  const toneCls =
    st.tone === 'fresh'
      ? s.toneFresh
      : st.tone === 'stale'
      ? s.toneStale
      : st.tone === 'old'
      ? s.toneOld
      : s.toneUnknown;
  const toneLabel =
    st.tone === 'fresh'
      ? '● čerstvé'
      : st.tone === 'stale'
      ? '● zastarávající'
      : st.tone === 'old'
      ? '● staré'
      : '○ neznámé';

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <strong>Aktivita analytiků</strong>
        <span className={`${s.tone} ${toneCls}`}>{toneLabel}</span>
      </div>

      <div className={s.row}>
        <div className={s.cell}>
          <span className={s.label}>Nejčerstvější action</span>
          <span className={s.value}>{fmtDate(lastAction)}</span>
        </div>
        <div className={s.cell}>
          <span className={s.label}>Mezera od refreshe</span>
          <span className={s.value}>{st.label}</span>
        </div>
      </div>

      {revisions && (
        <div className={s.revRow}>
          <span className={s.label}>EPS revize</span>
          <RevisionPill label="7d" up={revisions.upLast7days} down={revisions.downLast7days} />
          <RevisionPill label="30d" up={revisions.upLast30days} down={revisions.downLast30days} />
          <span className={s.hint}>↑ = analytik zvýšil EPS odhad (bullish), ↓ = snížil (bearish)</span>
        </div>
      )}

      {trend.length > 0 && (
        <div className={s.trendWrap}>
          <div className={s.label}>Consensus trend (posledních 4 měsíce)</div>
          <TrendChart periods={trend} />
          <div className={s.legend}>
            <LegendDot color="#16a34a" label="Strong Buy" />
            <LegendDot color="#86efac" label="Buy" />
            <LegendDot color="#9ca3af" label="Hold" />
            <LegendDot color="#fca5a5" label="Sell" />
            <LegendDot color="#dc2626" label="Strong Sell" />
          </div>
        </div>
      )}
    </div>
  );
}

function RevisionPill({
  label,
  up,
  down,
}: {
  label: string;
  up: number | null | undefined;
  down: number | null | undefined;
}) {
  const upN = up ?? 0;
  const downN = down ?? 0;
  const empty = up == null && down == null;
  return (
    <span className={s.revPill}>
      <span className={s.revLabel}>{label}</span>
      {empty ? (
        <span className={s.revNone}>—</span>
      ) : (
        <>
          <span className={s.revUp}>↑{upN}</span>
          <span className={s.revDown}>↓{downN}</span>
        </>
      )}
    </span>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className={s.legendItem}>
      <span className={s.legendDot} style={{ background: color }} />
      {label}
    </span>
  );
}

type TrendRow = {
  period?: string;
  strongBuy?: number;
  buy?: number;
  hold?: number;
  sell?: number;
  strongSell?: number;
};

function TrendChart({ periods }: { periods: TrendRow[] }) {
  const sorted = [...periods].sort((a, b) => {
    const av = a.period === '0m' ? 0 : -parseInt(a.period ?? '0', 10);
    const bv = b.period === '0m' ? 0 : -parseInt(b.period ?? '0', 10);
    return av - bv;
  });
  return (
    <div className={s.chart}>
      {sorted.map((p) => {
        const sb = p.strongBuy ?? 0;
        const b = p.buy ?? 0;
        const h = p.hold ?? 0;
        const s1 = p.sell ?? 0;
        const ss = p.strongSell ?? 0;
        const total = sb + b + h + s1 + ss || 1;
        const seg = (n: number) => `${(n / total) * 100}%`;
        return (
          <div key={p.period ?? Math.random()} className={s.barRow}>
            <div className={s.period}>{p.period ?? '—'}</div>
            <div className={s.bar}>
              <span style={{ width: seg(sb), background: '#16a34a' }} title={`Strong Buy ${sb}`} />
              <span style={{ width: seg(b), background: '#86efac' }} title={`Buy ${b}`} />
              <span style={{ width: seg(h), background: '#9ca3af' }} title={`Hold ${h}`} />
              <span style={{ width: seg(s1), background: '#fca5a5' }} title={`Sell ${s1}`} />
              <span style={{ width: seg(ss), background: '#dc2626' }} title={`Strong Sell ${ss}`} />
            </div>
            <div className={s.total}>{sb + b + h + s1 + ss}</div>
          </div>
        );
      })}
    </div>
  );
}
