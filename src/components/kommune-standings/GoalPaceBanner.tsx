import { Flag } from 'lucide-react';
import type { NationalPaceContext, NationalMetricPace } from '@/lib/kommune-goal-pace';

const pct = (n: number) => `${Math.round(n)}%`;

/**
 * National goal-pace context shown above the effort metrics whenever the
 * "Mod målet" lens is active. Anchors a kommune's standing to whether the
 * tripartite as a whole is on pace for 2030 — so "foran feltet" is never
 * mistaken for "on track to the goal".
 */
export function GoalPaceBanner({ pace }: { pace: NationalPaceContext }) {
  const entries: Array<[string, NationalMetricPace | null]> = [
    ['skov', pace.skov],
    ['kvælstof', pace.kvaelstof],
    ['lavbund', pace.lavbund],
  ];
  const parts = entries
    .filter(([, m]) => m != null)
    .map(([label, m]) => `${label} ${pct(m!.paceRatio * 100)} af nødvendigt tempo`);

  const statuses = entries
    .map(([, m]) => m?.status)
    .filter((s): s is NationalMetricPace['status'] => s != null);
  const allOnTrack =
    statuses.length > 0 && statuses.every((s) => s === 'on-track' || s === 'reached');
  const verdict = allOnTrack ? 'Treparten er på sporet.' : 'Treparten er ikke på sporet.';

  if (parts.length === 0) return null;

  return (
    <p className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/80 px-3 py-1.5 text-[11px] text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
      <Flag className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={2.2} aria-hidden />
      <span>
        <strong>Landet samlet, mod målet:</strong> {parts.join(' · ')}. <strong>{verdict}</strong>{' '}
        En placering her skal læses i det lys — 1,0× = på sporet mod fristen, ikke “bedst i feltet”.
      </span>
    </p>
  );
}
