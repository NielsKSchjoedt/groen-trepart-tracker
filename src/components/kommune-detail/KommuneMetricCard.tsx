import type { ReactNode } from 'react';
import type { KommuneMetrics } from '@/lib/types';
import { formatDanishNumber } from '@/lib/format';
import type { MarsPhaseMetricField } from '@/lib/kommune-metrics';
import { formatMarsMetricHeadline } from '@/lib/kommune-metrics';
import { MarsMetricPhaseBreakdown } from '@/components/kommune-detail/MarsMetricPhaseBreakdown';

export interface KommuneMetricCardProps {
  icon: ReactNode;
  label: string;
  value: number;
  unit: string;
  sub?: string;
  noDataText?: string;
  kommune?: KommuneMetrics;
  marsPhaseMetric?: MarsPhaseMetricField;
  /** Added to «anlagt» in headline (e.g. KSF/NST skov uden MARS-faser). */
  extraAnlagt?: number;
}

/** Single indsats goal card with optional MARS phase breakdown. */
export function KommuneMetricCard({
  icon,
  label,
  value,
  unit,
  sub,
  noDataText,
  kommune,
  marsPhaseMetric,
  extraAnlagt = 0,
}: KommuneMetricCardProps) {
  const marsHeadline = kommune && marsPhaseMetric
    ? formatMarsMetricHeadline(kommune, marsPhaseMetric, extraAnlagt)
    : null;
  const showSimpleTotal = !marsHeadline && value > 0;

  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      {marsHeadline ? (
        <>
          <p className="text-sm font-bold text-foreground tabular-nums leading-snug">
            {marsHeadline}
          </p>
          {sub && (
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{sub}</p>
          )}
        </>
      ) : showSimpleTotal ? (
        <>
          <p className="text-lg font-bold text-foreground tabular-nums leading-tight">
            {formatDanishNumber(Math.round(value * 10) / 10)}
            <span className="text-xs font-normal text-muted-foreground ml-1">{unit}</span>
          </p>
          {sub && (
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{sub}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          {noDataText ?? '—'}
        </p>
      )}
      {kommune && marsPhaseMetric && (
        <MarsMetricPhaseBreakdown kommune={kommune} metric={marsPhaseMetric} />
      )}
    </div>
  );
}
