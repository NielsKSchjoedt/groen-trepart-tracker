import { useState } from 'react';
import { AlertTriangle, Check, ChevronDown } from 'lucide-react';
import type { KommuneMetric } from '@/lib/kommune-metrics';
import { METRIC_NO_DATA } from '@/lib/kommune-metrics';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ControlBarTrigger } from '@/components/ControlBar';

interface MetricOption {
  id: KommuneMetric;
  label: string;
  color: string;
}

const METRIC_OPTIONS: MetricOption[] = [
  { id: 'nitrogen',      label: 'Kvælstof',         color: '#0d9488' },
  { id: 'extraction',    label: 'Lavbund',           color: '#a16207' },
  { id: 'afforestation', label: 'Skovrejsning',      color: '#15803d' },
  { id: 'nature',        label: 'Beskyttet natur',   color: '#16a34a' },
  { id: 'co2',           label: 'CO₂',               color: '#64748b' },
];

interface MetricDotPickerProps {
  activeMetric: KommuneMetric | null;
  onChange: (metric: KommuneMetric) => void;
  /** Larger, centred pills for the map overlay before first selection. */
  variant?: 'inline' | 'overlay';
}

/**
 * Coloured delmål pills — used on the kommune map before a metric is chosen,
 * and as the wide-screen picker on the list page.
 */
export function MetricDotPicker({
  activeMetric,
  onChange,
  variant = 'inline',
}: MetricDotPickerProps) {
  const isOverlay = variant === 'overlay';

  return (
    <div
      role="radiogroup"
      aria-label="Vælg indsatsområde"
      className={
        isOverlay
          ? 'flex flex-wrap items-center justify-center gap-2'
          : 'flex flex-wrap items-center gap-1.5'
      }
    >
      {METRIC_OPTIONS.map(({ id, label, color }) => {
        const isActive = id === activeMetric;
        const isNoData = METRIC_NO_DATA.has(id);

        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(id)}
            title={isNoData ? 'Data ikke tilgængeligt på kommuneniveau' : undefined}
            className={`
              flex items-center gap-2 rounded-full font-medium border transition-all duration-150 cursor-pointer
              ${isOverlay ? 'px-4 py-2.5 text-sm shadow-sm bg-background' : 'px-3 py-1.5 text-sm'}
              ${isActive && !isNoData
                ? 'text-white border-transparent shadow-md'
                : isActive && isNoData
                  ? 'bg-muted/60 text-muted-foreground border-border shadow-sm ring-1 ring-border'
                  : isOverlay
                    ? 'text-foreground border-border/80 hover:border-border hover:shadow-md'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-border/70'
              }
            `}
            style={isActive && !isNoData ? { backgroundColor: color, borderColor: color } : {}}
          >
            {isActive && !isNoData ? (
              <Check className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={3} />
            ) : isNoData ? (
              <AlertTriangle
                className={`flex-shrink-0 ${isOverlay ? 'w-4 h-4' : 'w-3 h-3'} ${isActive ? 'text-amber-500' : 'text-muted-foreground/50'}`}
                strokeWidth={2.5}
              />
            ) : (
              <span
                className={`rounded-full flex-shrink-0 ${isOverlay ? 'w-3 h-3' : 'w-2 h-2'}`}
                style={{ backgroundColor: color }}
              />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}

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
  /** Always use dropdown (detail page / narrow layouts). */
  compact?: boolean;
}

/**
 * Segmented pill control for selecting which metric the KommuneMap and
 * KommuneTable display.
 *
 * On mobile, pills collapse into a compact dropdown to save vertical space.
 */
export function MetricPicker({ activeMetric, onChange, compact = false }: MetricPickerProps) {
  const [open, setOpen] = useState(false);
  const activeHasNoData = activeMetric !== null && METRIC_NO_DATA.has(activeMetric);
  const disclaimer = activeHasNoData ? NO_DATA_DISCLAIMERS[activeMetric!] : null;
  const activeOption = METRIC_OPTIONS.find((o) => o.id === activeMetric);

  const selectMetric = (id: KommuneMetric) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 min-w-0">
      {/* Compact: dropdown (mobile or narrow detail layout) */}
      <div className={compact ? '' : 'md:hidden'}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <ControlBarTrigger
              aria-label="Vælg indsatsområde"
              fullWidth
            >
              {activeOption ? (
                <>
                  {activeHasNoData ? (
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" strokeWidth={2.5} />
                  ) : (
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: activeOption.color }}
                    />
                  )}
                  <span className="truncate">{activeOption.label}</span>
                </>
              ) : (
                <span className="truncate">Vælg indsatsområde</span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 ml-auto" strokeWidth={2.4} />
            </ControlBarTrigger>
          </PopoverTrigger>
          <PopoverContent align="start" className="z-[10000] w-[min(100vw-2rem,18rem)] p-1">
            {METRIC_OPTIONS.map(({ id, label, color }) => {
              const isActive = id === activeMetric;
              const isNoData = METRIC_NO_DATA.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectMetric(id)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  {isNoData ? (
                    <AlertTriangle
                      className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-amber-500' : 'text-muted-foreground/50'}`}
                      strokeWidth={2.5}
                    />
                  ) : (
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color, opacity: isActive ? 1 : 0.6 }}
                    />
                  )}
                  <span className={isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                    {label}
                  </span>
                  {isActive && <Check className="w-3.5 h-3.5 text-primary ml-auto" strokeWidth={2.6} />}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>

      {/* Wide list page: pill row */}
      {!compact && (
        <div className="hidden md:block">
          <MetricDotPicker activeMetric={activeMetric} onChange={onChange} />
        </div>
      )}

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
