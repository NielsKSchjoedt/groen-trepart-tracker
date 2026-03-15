import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { formatDanishNumber } from '@/lib/format';
import type { DashboardData } from '@/lib/types';
import { usePillar } from '@/lib/pillars';
import type { PillarId } from '@/lib/pillars';
import { InfoTooltip } from './InfoTooltip';
import { NatureWatermark } from './NatureWatermark';

interface InitiativeTypeGaugeProps {
  data: DashboardData;
}

type InitiatorType = 'state' | 'municipal' | 'private';

interface InitiatorCounts {
  state: number;
  municipal: number;
  private: number;
}

const INITIATOR_CONFIG: Record<
  InitiatorType,
  { label: string; sublabel: string; color: string; bg: string; border: string }
> = {
  state: {
    label: 'Statslig',
    sublabel: 'NST-projekter',
    color: 'hsl(213 80% 50%)',
    bg: 'hsl(213 80% 97%)',
    border: 'hsl(213 80% 80%)',
  },
  municipal: {
    label: 'Kommunal/åben',
    sublabel: 'SGAV-ordninger',
    color: 'hsl(152 44% 40%)',
    bg: 'hsl(152 44% 97%)',
    border: 'hsl(152 44% 75%)',
  },
  private: {
    label: 'Privat',
    sublabel: 'LBST + Minivådområder',
    color: 'hsl(32 95% 50%)',
    bg: 'hsl(32 95% 97%)',
    border: 'hsl(32 95% 78%)',
  },
};

const INITIATOR_ORDER: InitiatorType[] = ['state', 'municipal', 'private'];

/**
 * Classify a project into one of three initiator categories based on its
 * subsidy scheme metadata. Classification is based on who administers / is
 * eligible for the scheme, not the actual applicant (which MARS does not expose).
 *
 * Rules:
 * - "NST" org → state (Naturstyrelsen's own projects, no public application)
 * - "LBST" org → private (Privat Skovrejsning — private landowners only)
 * - SGAV scheme "Minivådområder" → private (only private applicants eligible)
 * - Everything else → municipal/open (SGAV schemes open to municipalities and/or private)
 *
 * @param schemeOrg - Organization field from the subsidy scheme (e.g. "NST", "SGAV", "LBST")
 * @param schemeName - Human-readable scheme name (e.g. "Minivådområder")
 * @returns The initiator type category
 *
 * @example
 * classifyInitiator("NST", "NST Klima-Lavbund") // → 'state'
 * classifyInitiator("LBST", "Privat Skovrejsning") // → 'private'
 * classifyInitiator("SGAV", "Minivådområder") // → 'private'
 * classifyInitiator("SGAV", "Kvælstofvådområder") // → 'municipal'
 */
function classifyInitiator(schemeOrg: string, schemeName: string): InitiatorType {
  if (schemeOrg === 'NST') return 'state';
  if (schemeOrg === 'LBST' || schemeName === 'Minivådområder') return 'private';
  return 'municipal';
}

/** Effect field name on project records for each pillar. */
const EFFECT_FIELD: Partial<Record<PillarId, string>> = {
  nitrogen: 'nitrogenT',
  extraction: 'extractionHa',
  afforestation: 'afforestationHa',
};

/**
 * Compute initiator-type counts for the given pillar by scanning all plan-level
 * project details and sketch projects.
 *
 * For nitrogen/extraction/afforestation pillars, only projects with a non-zero
 * effect for that pillar are counted (matching the ProjectFunnel approach).
 * For the nature pillar (no single effect field), all projects are counted.
 *
 * @param data - The full dashboard data payload
 * @param pillarId - The currently selected pillar
 * @returns Object with counts for each initiator type
 *
 * @example
 * const counts = computeInitiatorCounts(data, 'nitrogen');
 * // → { state: 12, municipal: 204, private: 38 }
 */
function computeInitiatorCounts(data: DashboardData, pillarId: PillarId): InitiatorCounts {
  const counts: InitiatorCounts = { state: 0, municipal: 0, private: 0 };
  const effectField = EFFECT_FIELD[pillarId];

  for (const plan of data.plans) {
    for (const proj of plan.projectDetails) {
      const hasEffect =
        !effectField || ((proj as Record<string, unknown>)[effectField] as number) > 0;
      if (hasEffect) {
        counts[classifyInitiator(proj.schemeOrg, proj.schemeName)]++;
      }
    }
    for (const sketch of plan.sketchProjects) {
      const hasEffect =
        !effectField || ((sketch as Record<string, unknown>)[effectField] as number) > 0;
      if (hasEffect) {
        counts[classifyInitiator(sketch.schemeOrg, sketch.schemeName)]++;
      }
    }
  }

  return counts;
}

/**
 * Renders a horizontal stacked-bar gauge showing the proportion of projects
 * classified as Statslig (state), Kommunal/åben (municipal/open), or Privat
 * (private), filtered to the currently active pillar.
 *
 * Classification is derived from the subsidy scheme's organization field and
 * name, not from individual project applicants (which MARS does not expose).
 */
export function InitiativeTypeGauge({ data }: InitiativeTypeGaugeProps) {
  const { activePillar } = usePillar();

  const counts = useMemo(
    () => computeInitiatorCounts(data, activePillar),
    [data, activePillar],
  );

  const total = counts.state + counts.municipal + counts.private;

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-10 relative overflow-hidden">
      {/* Decorative watermarks */}
      <div className="absolute right-8 bottom-8 opacity-[0.08] hidden lg:block">
        <NatureWatermark animal="heron" size={110} className="scale-x-[-1]" />
      </div>
      <div className="absolute left-4 top-4 opacity-[0.07] hidden md:block">
        <NatureWatermark animal="butterfly" size={60} />
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-2">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
          Initiativtype
        </h2>
        <InfoTooltip
          title="Initiativtype"
          content={
            <>
              <p>
                Fordeling af projekter baseret på tilskudsordningens karakter — statslig, kommunal/åben
                eller privat. Klassificeringen er foretaget ud fra <strong>ordningens</strong> organisation
                og ansøgerkreds, ikke den faktiske ansøger per projekt (MARS indeholder ikke denne information).
              </p>
              <p className="mt-2">
                <strong>Statslig:</strong> Naturstyrelsens egne projekter (NST-ordninger).<br />
                <strong>Kommunal/åben:</strong> SGAV-ordninger åbne for kommuner og/eller private lodsejere.<br />
                <strong>Privat:</strong> Ordninger kun for private (LBST Privat Skovrejsning samt Minivådområder).
              </p>
              <p className="mt-2 text-muted-foreground">
                Skitser er inkluderet. Kommunal/åben-kategorien dækker projekter, hvor ordningen tillader
                både kommunale og private ansøgere — den reelle fordeling mellem disse kendes ikke.
              </p>
            </>
          }
          source="MARS API (Miljøstyrelsen) + master-data"
          side="right"
        />
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {total > 0
          ? `${formatDanishNumber(total)} projekter fordelt efter ordningstype`
          : 'Ingen projekter med effekt for dette delmål'}
      </p>

      {total > 0 && (
        <>
          {/* Stacked bar */}
          <div className="h-8 w-full rounded-full overflow-hidden flex bg-muted mb-5">
            {INITIATOR_ORDER.map((type) => {
              const count = counts[type];
              const pct = (count / total) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={type}
                  className="h-full transition-all duration-700 ease-out"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: INITIATOR_CONFIG[type].color,
                  }}
                  title={`${INITIATOR_CONFIG[type].label}: ${formatDanishNumber(count)} (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {INITIATOR_ORDER.map((type) => {
              const count = counts[type];
              const pct = total > 0 ? (count / total) * 100 : 0;
              const cfg = INITIATOR_CONFIG[type];

              return (
                <div
                  key={type}
                  className="flex items-start gap-3 p-3 rounded-xl border"
                  style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
                >
                  {/* Color swatch */}
                  <div
                    className="mt-0.5 w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-foreground">{cfg.label}</span>
                      <span
                        className="text-base font-bold tabular-nums"
                        style={{ color: cfg.color, fontFamily: "'Fraunces', serif" }}
                      >
                        {formatDanishNumber(count)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[11px] text-muted-foreground">{cfg.sublabel}</span>
                      <span className="text-[11px] font-medium" style={{ color: cfg.color }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Caveat note */}
          <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
            Bemærk: Kommunal/åben-kategorien inkluderer ordninger åbne for <em>både</em> kommuner og private lodsejere.
            Den reelle fordeling af ansøgere kendes ikke på projektniveau i MARS.
          </p>
        </>
      )}
    </section>
  );
}
