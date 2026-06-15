import type { KommuneMetrics } from '@/lib/types';
import {
  formatMarsPhaseMetricValue,
  getMarsMetricPhaseRows,
  type MarsPhaseMetricField,
} from '@/lib/kommune-metrics';

interface MarsMetricPhaseBreakdownProps {
  kommune: KommuneMetrics;
  metric: MarsPhaseMetricField;
}

/** Compact per-phase rows for one indsats metric inside a goal card. */
export function MarsMetricPhaseBreakdown({ kommune, metric }: MarsMetricPhaseBreakdownProps) {
  const rows = getMarsMetricPhaseRows(kommune, metric).filter((row) => row.stage !== 'established');
  if (rows.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
      {rows.map((row) => (
        <div key={row.stage} className="flex items-baseline justify-between gap-2 text-[10px] leading-snug">
          <span className={`inline-flex items-center gap-1 min-w-0 font-medium ${row.textClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${row.dotClass}`} aria-hidden />
            <span className="truncate">{row.label}</span>
          </span>
          <span className="text-muted-foreground tabular-nums shrink-0 text-right">
            {formatMarsPhaseMetricValue(metric, row.value)}
            {row.projectCount > 0 && (
              <span className="opacity-80">
                {' · '}
                {row.projectCount} proj.
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
