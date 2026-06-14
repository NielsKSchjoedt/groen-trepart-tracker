import type { KommuneMetrics } from '@/lib/types';
import { getPhaseConfig } from '@/lib/phase-config';
import {
  PROJECT_COUNT_STAGES,
  formatPhaseMetricsSummary,
  getPhaseMetricsForCountStage,
} from '@/lib/kommune-metrics';

interface MarsProjectPhaseBadgesProps {
  kommune: KommuneMetrics;
}

/** MARS project counts per phase with registered hectares (lavbund, skov, kvælstof). */
export function MarsProjectPhaseBadges({ kommune }: MarsProjectPhaseBadgesProps) {
  const rows = PROJECT_COUNT_STAGES.map(({ stage, countField }) => {
    const count = kommune.projectsByPhase[countField];
    const summary = formatPhaseMetricsSummary(getPhaseMetricsForCountStage(kommune, stage));
    return { stage, count, config: getPhaseConfig(stage), summary };
  }).filter((row) => row.count > 0);

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {rows.map(({ stage, count, config, summary }) => (
        <span
          key={stage}
          className={`inline-flex flex-wrap items-center gap-x-1 text-xs font-medium rounded-full px-2.5 py-0.5 ${config.badge}`}
        >
          <span>{config.label}:</span>
          {summary ? (
            <>
              <span className="tabular-nums">{summary}</span>
              <span className="opacity-80">
                · {count} projekt{count !== 1 ? 'er' : ''}
              </span>
            </>
          ) : (
            <span>{count}</span>
          )}
        </span>
      ))}
    </div>
  );
}
