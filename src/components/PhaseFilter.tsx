/**
 * PhaseFilter — multi-select pill toggle for MARS project implementation phases.
 *
 * Lets the user include or exclude phases when computing the municipality
 * metric totals shown on the choropleth map and the sortable table.
 *
 * Uses the canonical phase definitions from `@/lib/phase-config` for consistent
 * labels and colours across the entire app.
 *
 * Default: all four phases selected.
 */
import { Check } from 'lucide-react';
import type { KommunePhase } from '@/lib/kommune-metrics';
import { PHASE_CONFIGS } from '@/lib/phase-config';

export { KOMMUNE_PHASES } from '@/lib/kommune-metrics';

interface PhaseFilterProps {
  /** Currently active (selected) phases */
  selected: Set<KommunePhase>;
  /** Called when the user toggles a phase pill */
  onChange: (selected: Set<KommunePhase>) => void;
}

/**
 * Multi-select phase toggle pill bar.
 *
 * @param selected - Set of currently selected KommunePhase values
 * @param onChange - Called with the new Set when user toggles a pill
 *
 * @example
 * const [phases, setPhases] = useState(new Set<KommunePhase>(['sketch','preliminary','approved','established']));
 * <PhaseFilter selected={phases} onChange={setPhases} />
 */
export function PhaseFilter({ selected, onChange }: PhaseFilterProps) {
  const toggle = (id: KommunePhase) => {
    const next = new Set(selected);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filtrer projektfaser">
      {PHASE_CONFIGS.map((phase) => {
        const active = selected.has(phase.id);
        return (
          <button
            key={phase.id}
            type="button"
            onClick={() => toggle(phase.id)}
            aria-pressed={active}
            title={phase.description}
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
              'transition-all duration-150 select-none cursor-pointer',
              active
                ? phase.pillActive
                : 'border-border/50 bg-background text-muted-foreground hover:bg-muted/50',
            ].join(' ')}
          >
            {active ? (
              <Check className="w-3 h-3 flex-shrink-0" strokeWidth={3} />
            ) : (
              <span
                className={[
                  'w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors',
                  'bg-muted-foreground/40',
                ].join(' ')}
              />
            )}
            {phase.label}
          </button>
        );
      })}
    </div>
  );
}
