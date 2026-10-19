import { Leaf } from 'lucide-react';
import type { KommuneMetrics, KommuneRankingRow } from '@/lib/types';
import {
  formatNatureMetricHeadline,
  getNatureMetricRows,
} from '@/lib/kommune-metrics';
import { NatureMetricBreakdown } from '@/components/kommune-detail/NatureMetricBreakdown';

export interface KommuneNatureMetricCardProps {
  kommune: KommuneMetrics;
  rankingRow?: KommuneRankingRow | null;
  dce30Ha?: number | null;
  noDataText?: string;
}

/** Beskyttet natur goal card with §3/N2000 and naturpotentiale breakdown. */
export function KommuneNatureMetricCard({
  kommune,
  rankingRow,
  dce30Ha,
  noDataText,
}: KommuneNatureMetricCardProps) {
  const headline = formatNatureMetricHeadline(kommune, rankingRow, dce30Ha);
  const rows = getNatureMetricRows(kommune, rankingRow, dce30Ha);

  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Leaf className="w-4 h-4 text-emerald-600" />
        <span className="text-xs font-medium text-muted-foreground">Beskyttet natur (§3+N2000)</span>
      </div>
      {headline ? (
        <p className="text-sm font-bold text-foreground tabular-nums leading-snug">
          {headline}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          {noDataText ?? '—'}
        </p>
      )}
      <NatureMetricBreakdown rows={rows} />
    </div>
  );
}
