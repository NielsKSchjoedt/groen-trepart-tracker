import type { Measure, MeasureId, EffectDomainId } from '@/lib/model';
import type { PillarId } from '@/lib/pillars';
import type { KlimaraadetData } from '@/lib/types';
import { GOAL_STATUS_META, paceVerdictLabel } from '@/lib/projections';
import { Check } from 'lucide-react';
import { TrajectoryTrack } from './TrajectoryTrack';
import { KlimaraadetBadge } from './KlimaraadetBadge';

interface IndsatsRowProps {
  measures: Measure[];
  /** Directly selected/hovered measure (gets the ring) */
  activeMeasure: MeasureId | null;
  /** Active effect — used to keep its feeding measures highlighted */
  activeDomain: EffectDomainId | null;
  /** Measures that feed the active effect; null when no effect is active */
  highlightedMeasures: Set<MeasureId> | null;
  /** Pillar currently driving the page content — its card stays permanently selected */
  selectedPillar: PillarId | null;
  klimaraadet?: KlimaraadetData;
  onHover: (id: MeasureId | null) => void;
  /** Navigate to the matching pillar detail page */
  onSelect: (pillarId: PillarId) => void;
}

export function IndsatsRow({
  measures,
  activeMeasure,
  activeDomain,
  highlightedMeasures,
  selectedPillar,
  klimaraadet,
  onHover,
  onSelect,
}: IndsatsRowProps) {
  const anyActive = activeMeasure !== null || activeDomain !== null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {measures.map((m) => {
        const Icon = m.icon;
        const isSelected = selectedPillar !== null && m.pillarId === selectedPillar;
        const isFocused = activeMeasure === m.id;
        const isHighlighted = highlightedMeasures?.has(m.id) ?? false;
        const dimmed = anyActive && !isFocused && !isHighlighted && !isSelected;
        const vurdering = klimaraadet?.vurderinger[m.pillarId];
        const meta = GOAL_STATUS_META[m.status];
        const verdictLabel = paceVerdictLabel(m.status, m.timeElapsedPct);

        const cardStyle = isSelected
          ? { borderColor: m.accent, borderWidth: 2, boxShadow: `0 0 0 3px ${m.accent}33` }
          : isFocused
            ? { borderColor: m.accent, borderWidth: 2 }
            : undefined;

        return (
          <div
            key={m.id}
            role="button"
            tabIndex={0}
            aria-label={`${m.label} — se detaljer`}
            aria-pressed={isSelected}
            className={`flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card px-4 py-3 text-left transition-all duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isSelected || isFocused ? 'shadow-md' : 'border-border shadow-sm'
            } ${dimmed ? 'opacity-35' : 'opacity-100'}`}
            style={cardStyle}
            onMouseEnter={() => onHover(m.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(m.id)}
            onBlur={() => onHover(null)}
            onClick={() => onSelect(m.pillarId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(m.pillarId);
              }
            }}
          >
            <div className="-mx-4 -mt-3 mb-2.5 px-4 pb-2.5 pt-3" style={{ backgroundColor: `${m.accent}14` }}>
              {/* Top row: icon (left) + status badge (right) — fixed height so every card's title and bars line up */}
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${m.accent}29` }}
                >
                  <Icon className="h-4 w-4" style={{ color: m.accent }} strokeWidth={2} />
                </div>
                {isSelected ? (
                  <span
                    className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                    style={{ backgroundColor: m.accent, color: 'white' }}
                  >
                    <Check className="h-2.5 w-2.5" strokeWidth={3} /> Valgt
                  </span>
                ) : (
                  <span
                    className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] font-semibold"
                    style={{ color: meta.color }}
                  >
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                    {verdictLabel}
                  </span>
                )}
              </div>
              {/* Title on its own full-width line — long compound words no longer crowd the badge or wrap unevenly */}
              <h3
                className="mt-1.5 text-[13px] font-semibold leading-tight"
                style={{ color: `color-mix(in srgb, ${m.accent} 78%, black)` }}
              >
                {m.label}
              </h3>
            </div>

            <TrajectoryTrack
              timePct={m.timeElapsedPct}
              builtPct={m.builtPct}
              projectedPct={m.projectedPct}
              accent={m.accent}
              ghostLabel={m.ghostLabel}
              progressLabel="anlagt"
            />

            <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
              {m.timeVsBuiltSentence}
            </p>

            {vurdering && klimaraadet?.url && (
              <div
                className="mt-2 w-full"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="presentation"
              >
                <KlimaraadetBadge vurdering={vurdering} rapportUrl={klimaraadet.url} compact />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
