import type { KommuneMetrics, KommuneRankingData } from '@/lib/types';
import type { KommunePhase } from '@/lib/kommune-metrics';
import { formatDanishNumber } from '@/lib/format';
import { getPhaseConfig } from '@/lib/phase-config';

const PHASES: KommunePhase[] = ['established', 'approved', 'preliminary'];

function phaseHa(km: KommuneMetrics, phase: KommunePhase): number {
  const p = km.byPhase[phase];
  return (p?.extractionHa ?? 0) + (p?.afforestationHa ?? 0);
}

interface KommunePhaseVsNationalProps {
  kommune: KommuneMetrics;
  ranking: KommuneRankingData;
}

/**
 * Compare municipality pipeline phase mix to national (ranking precomputed shares).
 */
export function KommunePhaseVsNational({ kommune, ranking }: KommunePhaseVsNationalProps) {
  const nat = ranking.national.phaseShareHa;
  const kmTotal = PHASES.reduce((s, ph) => s + phaseHa(kommune, ph), 0);
  const natTotal = PHASES.reduce((s, ph) => {
    const n = nat[ph];
    return s + (n?.extractionHa ?? 0) + (n?.afforestationHa ?? 0);
  }, 0);

  if (kmTotal <= 0 && natTotal <= 0) return null;

  return (
    <div className="mb-5 pb-5 border-b border-border">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        Faseprofil vs. landet
      </p>
      <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
        Andel af kommunens leverede hektar (lavbund + skov, uden skitser) i hver fase — sammenlignet med landsgennemsnittet.
      </p>
      <div className="space-y-2">
        {PHASES.map((ph) => {
          const cfg = getPhaseConfig(ph);
          const kmHa = phaseHa(kommune, ph);
          const kmPct = kmTotal > 0 ? (kmHa / kmTotal) * 100 : 0;
          const natRow = nat[ph];
          const natHa = (natRow?.extractionHa ?? 0) + (natRow?.afforestationHa ?? 0);
          const natPct = natTotal > 0 ? (natHa / natTotal) * 100 : 0;
          const diff = kmPct - natPct;
          return (
            <div key={ph} className="text-xs">
              <div className="flex justify-between gap-2 mb-0.5">
                <span className={`font-medium ${cfg.badge.split(' ')[0]}`}>{cfg.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatDanishNumber(Math.round(kmPct))}% kommunen
                  {diff !== 0 && (
                    <span className={diff > 0 ? ' text-amber-700' : ' text-emerald-700'}>
                      {' '}
                      ({diff > 0 ? '+' : ''}{formatDanishNumber(Math.round(diff))} pp)
                    </span>
                  )}
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full opacity-90"
                  style={{ width: `${Math.min(kmPct, 100)}%`, backgroundColor: '#2f8f5b' }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground/50"
                  style={{ left: `${Math.min(natPct, 100)}%` }}
                  title={`Landet: ${formatDanishNumber(Math.round(natPct))}%`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
