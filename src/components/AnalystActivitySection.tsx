'use client';

import type { RecentContextEpsRevisions, RecentContextRecommendationTrend } from '../types/stocks';
import s from './AnalystActivitySection.module.css';

type Tone = 'fresh' | 'stale' | 'old' | 'unknown';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function staleness(
  lastAction: string | null | undefined,
  referenceAt: string | null | undefined,
): { days: number | null; tone: Tone; label: string } {
  if (!lastAction) return { days: null, tone: 'unknown', label: 'neznámá čerstvost' };
  const last = Date.parse(lastAction);
  const ref = referenceAt ? Date.parse(referenceAt) : Date.now();
  if (Number.isNaN(last) || Number.isNaN(ref)) {
    return { days: null, tone: 'unknown', label: 'neznámá čerstvost' };
  }
  const days = Math.round((ref - last) / 86_400_000);
  const abs = Math.abs(days);
  let tone: Tone = 'fresh';
  if (abs > 90) tone = 'old';
  else if (abs > 30) tone = 'stale';
  const label = `${abs} dní zpět`;
  return { days: abs, tone, label };
}

interface Props {
  lastAction: string | null | undefined;
  metricsUpdatedAt: string | null | undefined;
  revisions: RecentContextEpsRevisions | null | undefined;
  trend: RecentContextRecommendationTrend[] | undefined;
}

export function AnalystActivitySection({ lastAction, metricsUpdatedAt, revisions, trend }: Props) {
  const hasTrend = Array.isArray(trend) && trend.length > 0;
  const hasRev = !!revisions;
  if (!lastAction && !hasTrend && !hasRev) return null;

  const st = staleness(lastAction, metricsUpdatedAt);
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
      <div className={s.topRow}>
        <div className={s.freshBlock}>
          <div className={s.freshHead}>
            <span className={s.freshTitle}>Nejčerstvější analyst action</span>
            <span className={`${s.tone} ${toneCls}`}>{toneLabel}</span>
          </div>
          <div className={s.freshValue}>
            {fmtDate(lastAction)}
            {st.days !== null && <span className={s.freshGap}> · {st.label}</span>}
          </div>
          <div className={s.freshHint}>
            Max datum z upgrades a research reportů — jak dávno se někdo pohnul na této akcii.
          </div>
        </div>

        {revisions && (
          <div className={s.revBlock}>
            <div className={s.revTitle}>EPS revize (počet analytiků)</div>
            <div className={s.revPills}>
              <RevisionPill label="7d" up={revisions.upLast7days} down={revisions.downLast7days} />
              <RevisionPill label="30d" up={revisions.upLast30days} down={revisions.downLast30days} />
            </div>
            <div className={s.revHint}>↑ analytik zvýšil odhad zisku (bullish), ↓ snížil (bearish).</div>
          </div>
        )}
      </div>

      {hasTrend && (
        <div className={s.trendWrap}>
          <div className={s.trendTitle}>Consensus trend (poslední 4 měsíce)</div>
          <TrendChart periods={trend!} />
          <div className={s.legend}>
            <LegendDot color="#22c55e" label="Strong Buy" />
            <LegendDot color="#86efac" label="Buy" />
            <LegendDot color="#94a3b8" label="Hold" />
            <LegendDot color="#f87171" label="Sell" />
            <LegendDot color="#ef4444" label="Strong Sell" />
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

function TrendChart({ periods }: { periods: RecentContextRecommendationTrend[] }) {
  const sorted = [...periods].sort((a, b) => {
    const av = a.period === '0m' ? 0 : -parseInt(a.period, 10);
    const bv = b.period === '0m' ? 0 : -parseInt(b.period, 10);
    return av - bv;
  });
  return (
    <div className={s.chart}>
      {sorted.map((p) => {
        const total = p.strongBuy + p.buy + p.hold + p.sell + p.strongSell || 1;
        const seg = (n: number) => `${(n / total) * 100}%`;
        return (
          <div key={p.period} className={s.barRow}>
            <div className={s.period}>{p.period}</div>
            <div className={s.bar}>
              <span style={{ width: seg(p.strongBuy), background: '#22c55e' }} title={`Strong Buy ${p.strongBuy}`} />
              <span style={{ width: seg(p.buy), background: '#86efac' }} title={`Buy ${p.buy}`} />
              <span style={{ width: seg(p.hold), background: '#94a3b8' }} title={`Hold ${p.hold}`} />
              <span style={{ width: seg(p.sell), background: '#f87171' }} title={`Sell ${p.sell}`} />
              <span style={{ width: seg(p.strongSell), background: '#ef4444' }} title={`Strong Sell ${p.strongSell}`} />
            </div>
            <div className={s.total}>{p.strongBuy + p.buy + p.hold + p.sell + p.strongSell}</div>
          </div>
        );
      })}
    </div>
  );
}
