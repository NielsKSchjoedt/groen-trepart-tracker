import { useEffect, useState } from 'react';
import { Target, TrendingDown, TrendingUp } from 'lucide-react';
import { loadCO2Emissions } from '@/lib/data';
import { formatDanishNumber } from '@/lib/format';
import { assessGoalStatus, GOAL_STATUS_META } from '@/lib/projections';
import type { CO2EmissionsData } from '@/lib/types';

/**
 * CO₂ fremskrivning from KF25 — no MARS pipeline scenario builder.
 */
export function Co2ProjectionCard() {
  const [co2Data, setCo2Data] = useState<CO2EmissionsData | null>(null);

  useEffect(() => {
    loadCO2Emissions().then(setCo2Data);
  }, []);

  if (!co2Data) {
    return (
      <div className="rounded-xl border border-border p-4 bg-muted/30 text-sm text-muted-foreground">
        Henter CO₂-fremskrivning…
      </div>
    );
  }

  const achieved = co2Data.milestones.reduction2025Pct;
  const target = co2Data.targets.reductionPct;
  const projected = co2Data.milestones.reduction2030Pct;
  const actualPct = target > 0 ? (achieved / target) * 100 : 0;
  const projectedPct = target > 0 ? (projected / target) * 100 : 0;
  const goalStatus = assessGoalStatus(projectedPct, actualPct);
  const goalMeta = GOAL_STATUS_META[goalStatus];
  const isPositive = goalStatus === 'reached' || goalStatus === 'on-track';
  const TrendIcon = isPositive || goalStatus === 'very-close' ? TrendingUp : TrendingDown;

  return (
    <div
      className="w-full max-w-3xl mx-auto rounded-2xl border p-5 sm:p-7 transition-colors"
      style={{
        backgroundColor: goalMeta.bgColor,
        borderColor: goalMeta.color + '30',
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: goalMeta.color + '20' }}
        >
          <TrendIcon className="w-6 h-6" style={{ color: goalMeta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base sm:text-lg font-semibold mb-1" style={{ color: goalMeta.color }}>
            {goalMeta.label}
          </p>
          <p className="text-sm leading-relaxed text-foreground/70">
            KF25-fremskrivningen viser <strong>{formatDanishNumber(projected, 1)}%</strong> reduktion
            i 2030 (mål: {formatDanishNumber(target)}%). Nuværende niveau:{' '}
            <strong>{formatDanishNumber(achieved, 1)}%</strong>.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>0%</span>
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3" />
            {formatDanishNumber(target)}%
          </span>
        </div>
        <div className="relative h-4 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(projectedPct, 100)}%`,
              backgroundColor: goalMeta.color + '40',
            }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(actualPct, 100)}%`,
              backgroundColor: '#737373',
            }}
          />
          <div className="absolute inset-y-0 right-0 w-0.5 bg-foreground/20" />
        </div>
        <div className="flex items-center justify-between mt-2 gap-2 flex-wrap text-[11px] sm:text-xs text-muted-foreground">
          <span>Nu ({formatDanishNumber(achieved, 1)}%)</span>
          <span>Prognose 2030 ({formatDanishNumber(projected, 1)}%)</span>
        </div>
      </div>
    </div>
  );
}
