import { formatNatureHa, type NatureMetricRow } from '@/lib/kommune-metrics';

interface NatureMetricBreakdownProps {
  rows: NatureMetricRow[];
}

/** Compact breakdown rows for the Beskyttet natur goal card. */
export function NatureMetricBreakdown({ rows }: NatureMetricBreakdownProps) {
  if (rows.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
      {rows.map((row) => (
        <div key={row.id} className="flex items-baseline justify-between gap-2 text-[10px] leading-snug">
          <span className="inline-flex items-center gap-1 min-w-0 font-medium text-foreground/80">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: row.dotColor }}
              aria-hidden
            />
            <span className={`truncate ${row.indent ? 'pl-2 text-muted-foreground' : ''}`}>
              {row.label}
            </span>
          </span>
          <span className="text-muted-foreground tabular-nums shrink-0 text-right">
            {formatNatureHa(row.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
