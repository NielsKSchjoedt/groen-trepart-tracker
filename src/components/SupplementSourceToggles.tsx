import type { KommuneMetric, SupplementSource } from '@/lib/kommune-metrics';
import { getSupplementPresentation } from '@/lib/kommune-metrics';
import { MapSwitchToggle } from '@/components/MapSwitchToggle';

interface SupplementSourceTogglesProps {
  metric: KommuneMetric;
  sources: SupplementSource[];
  active: Set<SupplementSource>;
  onChange: (next: Set<SupplementSource>) => void;
}

/** Supplementary data sources (KSF, NST, …) as switch toggles — same UX as kortlag. */
export function SupplementSourceToggles({
  metric,
  sources,
  active,
  onChange,
}: SupplementSourceTogglesProps) {
  if (sources.length === 0) return null;

  const toggle = (id: SupplementSource, on: boolean) => {
    const next = new Set(active);
    if (on) next.add(id);
    else next.delete(id);
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {sources.map((srcId) => {
        const def = getSupplementPresentation(srcId, metric);
        return (
          <MapSwitchToggle
            key={srcId}
            label={def.label}
            description={def.description}
            color={def.color.stroke}
            checked={active.has(srcId)}
            onChange={(on) => toggle(srcId, on)}
          />
        );
      })}
    </div>
  );
}
