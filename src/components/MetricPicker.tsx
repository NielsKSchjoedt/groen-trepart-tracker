import { AlertTriangle, Check } from 'lucide-react';
import type { KommuneMetric } from '@/lib/kommune-metrics';
import { METRIC_NO_DATA } from '@/lib/kommune-metrics';

interface MetricOption {
  id: KommuneMetric;
  label: string;
  color: string;
}

const METRIC_OPTIONS: MetricOption[] = [
  { id: 'nitrogen',      label: 'Kvælstof',         color: '#0d9488' },
  { id: 'extraction',    label: 'Udtagning',         color: '#a16207' },
  { id: 'afforestation', label: 'Skovrejsning',      color: '#15803d' },
  { id: 'nature',        label: 'Beskyttet natur',   color: '#16a34a' },
  { id: 'co2',           label: 'CO₂',               color: '#64748b' },
];

/**
 * Explanatory disclaimer shown below the picker when a no-data metric is active.
 * Keyed by KommuneMetric — only metrics in METRIC_NO_DATA need an entry.
 */
const NO_DATA_DISCLAIMERS: Partial<Record<KommuneMetric, React.ReactNode>> = {
  co2: (
    <>
      <strong className="font-semibold">CO₂-data ikke tilgængeligt per kommune.</strong>
      {' '}Danmarks CO₂-udledninger fra landbruget opgøres i{' '}
      <span className="font-medium">KF25 (Klimastatus og -fremskrivning 2025)</span> udelukkende på
      nationalt niveau — de er ikke fordelt på kommuner i de offentlige registre.
      Kortvisningen viser derfor ingen data. For nationale CO₂-fremskrivninger, se{' '}
      <strong className="font-semibold">CO₂-søjlen</strong> i den nationale oversigt.
    </>
  ),
};

interface MetricPickerProps {
  /** Currently selected metric, or null when none is selected */
  activeMetric: KommuneMetric | null;
  onChange: (metric: KommuneMetric) => void;
}

/**
 * Segmented pill control for selecting which metric the KommuneMap and
 * KommuneTable display.
 *
 * Supports a `null` activeMetric state (no selection). Metrics in
 * METRIC_NO_DATA are shown with a muted warning style and a ⚠ indicator.
 * A checkmark icon reinforces which pill is currently selected.
 *
 * @param activeMetric - Currently selected metric (null = none selected)
 * @param onChange     - Called when the user selects a different metric
 *
 * @example
 *   <MetricPicker activeMetric="nitrogen" onChange={(m) => setMetric(m)} />
 *   <MetricPicker activeMetric={null} onChange={(m) => setMetric(m)} />
 */
export function MetricPicker({ activeMetric, onChange }: MetricPickerProps) {
  const activeHasNoData = activeMetric !== null && METRIC_NO_DATA.has(activeMetric);
  const disclaimer = activeHasNoData ? NO_DATA_DISCLAIMERS[activeMetric!] : null;

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label="Vælg indsatsområde"
        className="flex flex-wrap items-center gap-1.5"
      >
        {METRIC_OPTIONS.map(({ id, label, color }) => {
          const isActive = id === activeMetric;
          const isNoData = METRIC_NO_DATA.has(id);

          return (
            <button
              key={id}
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(id)}
              title={isNoData ? 'Data ikke tilgængeligt på kommuneniveau' : undefined}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                border transition-all duration-150
                ${isActive && !isNoData
                  ? 'text-white border-transparent shadow-sm'
                  : isActive && isNoData
                    ? 'bg-muted/60 text-muted-foreground border-border shadow-sm ring-1 ring-border'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-border/70'
                }
              `}
              style={isActive && !isNoData ? { backgroundColor: color, borderColor: color } : {}}
            >
              {isActive && !isNoData ? (
                <Check className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={3} />
              ) : isNoData ? (
                <AlertTriangle
                  className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-amber-500' : 'text-muted-foreground/50'}`}
                  strokeWidth={2.5}
                />
              ) : (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color, opacity: 0.6 }}
                />
              )}
              {label}
            </button>
          );
        })}
      </div>

      {/* Per-metric disclaimer — only shown when a no-data metric is active */}
      {disclaimer && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" strokeWidth={2} />
          <p className="leading-snug">{disclaimer}</p>
        </div>
      )}
    </div>
  );
}
