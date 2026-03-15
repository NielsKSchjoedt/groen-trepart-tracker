/**
 * PhaseFilter — multi-select pill toggle for MARS project implementation phases.
 *
 * Lets the user include or exclude phases when computing the municipality
 * metric totals shown on the choropleth map and the sortable table.
 *
 * Phases (aligned with the MARS status codes used in ETL):
 *   sketch       → Skitse (rough outline, not yet in formal study)
 *   preliminary  → Forundersøgelse (feasibility study granted, not yet approved)
 *   approved     → Etableringstilsagn (approved for construction, not yet built)
 *   established  → Anlagt (actually constructed and operational)
 *
 * Default: all four phases selected.
 */
import type { KommunePhase } from '@/lib/kommune-metrics';

export { KOMMUNE_PHASES } from '@/lib/kommune-metrics';

interface PhaseFilterProps {
  /** Currently active (selected) phases */
  selected: Set<KommunePhase>;
  /** Called when the user toggles a phase pill */
  onChange: (selected: Set<KommunePhase>) => void;
}

interface PhaseDef {
  id: KommunePhase;
  label: string;
  labelShort: string;
  description: string;
  color: string;       // active background
  dotColor: string;    // dot indicator
}

const PHASE_DEFS: PhaseDef[] = [
  {
    id: 'sketch',
    label: 'Skitse',
    labelShort: 'Skitse',
    description: 'Skitseprojekter — tidligste fase, kun et groft overblik over mulige projekter',
    color: 'bg-slate-100 border-slate-300 text-slate-700',
    dotColor: 'bg-slate-400',
  },
  {
    id: 'preliminary',
    label: 'Forundersøgelse',
    labelShort: 'Forundersøgelse',
    description: 'Projekter med tilsagn om forundersøgelse — mulig implementering, ikke godkendt endnu',
    color: 'bg-amber-50 border-amber-300 text-amber-800',
    dotColor: 'bg-amber-400',
  },
  {
    id: 'approved',
    label: 'Godkendt',
    labelShort: 'Godkendt',
    description: 'Projekter med etableringstilsagn — godkendt til anlæg, ikke bygget endnu',
    color: 'bg-blue-50 border-blue-300 text-blue-800',
    dotColor: 'bg-blue-500',
  },
  {
    id: 'established',
    label: 'Anlagt',
    labelShort: 'Anlagt',
    description: 'Projekter der er fysisk anlagt og i drift',
    color: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    dotColor: 'bg-emerald-500',
  },
];

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
      // Never deselect the last phase — at least one must remain
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filtrer projektfaser">
      {PHASE_DEFS.map((phase) => {
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
                ? phase.color
                : 'border-border/50 bg-background text-muted-foreground hover:bg-muted/50',
            ].join(' ')}
          >
            <span
              className={[
                'w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors',
                active ? phase.dotColor : 'bg-muted-foreground/40',
              ].join(' ')}
            />
            {phase.label}
          </button>
        );
      })}
    </div>
  );
}
