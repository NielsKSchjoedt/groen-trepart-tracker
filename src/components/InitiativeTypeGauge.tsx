import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { formatDanishNumber } from '@/lib/format';
import type { DashboardData, ByInitiatorHa } from '@/lib/types';
import { usePillar } from '@/lib/pillars';
import type { PillarId } from '@/lib/pillars';
import { InfoTooltip } from './InfoTooltip';
import { NatureWatermark } from './NatureWatermark';
import { classifyInitiator } from '@/lib/initiator';
import type { InitiatorType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface InitiativeTypeGaugeProps {
  data: DashboardData;
}

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
    label: 'Statslig (NST)',
    sublabel: 'NST-projekter',
    color: 'hsl(213 80% 50%)',
    bg: 'hsl(213 80% 97%)',
    border: 'hsl(213 80% 80%)',
  },
  municipal: {
    label: 'Kommunal/åben (SGAV)',
    sublabel: 'SGAV-ordninger',
    color: 'hsl(152 44% 40%)',
    bg: 'hsl(152 44% 97%)',
    border: 'hsl(152 44% 75%)',
  },
  private: {
    label: 'Privat (LBST m.fl.)',
    sublabel: 'LBST + Minivådområder',
    color: 'hsl(32 95% 50%)',
    bg: 'hsl(32 95% 97%)',
    border: 'hsl(32 95% 78%)',
  },
};

const INITIATOR_ORDER: InitiatorType[] = ['state', 'municipal', 'private'];

const EFFECT_FIELD: Partial<Record<PillarId, string>> = {
  nitrogen: 'nitrogenT',
  extraction: 'extractionHa',
  afforestation: 'afforestationHa',
};

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

type MetricId = 'extraction' | 'afforestation' | 'nitrogen';

function mergeByInitiatorFromPhases(
  bih: ByInitiatorHa,
  metric: MetricId,
  includeSketches: boolean,
): { state: number; municipal: number; private: number; unit: 'ha' | 'ton' } {
  const phases: Array<keyof ByInitiatorHa['byPhase']> = includeSketches
    ? ['sketch', 'preliminary', 'approved', 'established']
    : ['preliminary', 'approved', 'established'];
  const out = { state: 0, municipal: 0, private: 0 };
  for (const ph of phases) {
    const block = bih.byPhase[ph][metric];
    for (const t of INITIATOR_ORDER) {
      out[t] += block[t].ha;
    }
  }
  const isTon = metric === 'nitrogen';
  return { ...out, unit: isTon ? 'ton' : 'ha' };
}

export function InitiativeTypeGauge({ data }: InitiativeTypeGaugeProps) {
  const { activePillar } = usePillar();
  const bih = data.national.byInitiatorHa;

  const [displayMode, setDisplayMode] = useState<'ha' | 'count'>('ha');
  const [includeSketches, setIncludeSketches] = useState(false);

  const metric: MetricId | null =
    activePillar === 'extraction'
      ? 'extraction'
      : activePillar === 'afforestation'
        ? 'afforestation'
        : activePillar === 'nitrogen'
          ? 'nitrogen'
          : null;

  const counts = useMemo(
    () => (activePillar ? computeInitiatorCounts(data, activePillar) : { state: 0, municipal: 0, private: 0 }),
    [data, activePillar],
  );

  const haOrTonByInitiator = useMemo(() => {
    if (!bih || !metric) return null;
    return mergeByInitiatorFromPhases(bih, metric, includeSketches);
  }, [bih, metric, includeSketches]);

  const isNature = activePillar === 'nature';
  const isCo2 = activePillar === 'co2';
  const canHaMode = !isNature && !isCo2 && metric != null && Boolean(bih);

  const { values, valueLabel, total, caption } = useMemo(() => {
    if (canHaMode && displayMode === 'ha' && haOrTonByInitiator) {
      const u = haOrTonByInitiator.unit;
      const v = {
        state: haOrTonByInitiator.state,
        municipal: haOrTonByInitiator.municipal,
        private: haOrTonByInitiator.private,
      };
      const t = v.state + v.municipal + v.private;
      return {
        values: v,
        valueLabel: u === 'ton' ? 'ton N' : 'ha',
        total: t,
        caption: 'Kun forundersøgelsestilsagn og frem (medmindre “inkl. skitser” er valgt).',
      };
    }
    return {
      values: counts,
      valueLabel: 'projekter' as const,
      total: counts.state + counts.municipal + counts.private,
      caption: includeSketches
        ? 'Tæller projekter med skitser med.'
        : 'Skitser er som udgangspunkt ikke med — slå til hvis du vil inkludere indledende skitseprojekter.',
    };
  }, [canHaMode, displayMode, haOrTonByInitiator, counts, includeSketches]);

  if (!activePillar || isCo2) return null;

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-10 relative overflow-hidden">
      <div className="absolute right-8 bottom-8 opacity-[0.08] hidden lg:block">
        <NatureWatermark animal="heron" size={110} className="scale-x-[-1]" />
      </div>
      <div className="absolute left-4 top-4 opacity-[0.07] hidden md:block">
        <NatureWatermark animal="butterfly" size={60} />
      </div>

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
                Fordeling baseret på tilskudsordningens karakter — statslig, kommunal/åben
                eller privat. Klassificeringen følger <strong>ordningens</strong> organisation
                og ansøgerkreds, ikke den faktiske ansøger (MARS indeholder ikke denne information).
              </p>
              <p className="mt-2">
                <strong>Statslig:</strong> Naturstyrelsens egne projekter (NST).<br />
                <strong>Kommunal/åben:</strong> SGAV-ordninger åbne for kommuner og/eller private lodsejere.<br />
                <strong>Privat:</strong> Ordninger kun for private (LBST m.v. og Minivådområder).
              </p>
            </>
          }
          source="MARS API (Miljøstyrelsen) + master-data / ETL"
          side="right"
        />
      </div>

      {!isNature && canHaMode && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setDisplayMode('ha')}
              className={cn(
                'rounded-md px-2 py-1 transition',
                displayMode === 'ha' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Vis areal/virkning
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('count')}
              className={cn(
                'rounded-md px-2 py-1 transition',
                displayMode === 'count' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Vis projekt-antal
            </button>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={includeSketches}
              onChange={(e) => setIncludeSketches(e.target.checked)}
            />
            Inkluder skitser
          </label>
        </div>
      )}

      <p className="text-sm text-muted-foreground mb-2">
        {total > 0
          ? `${formatDanishNumber(total, displayMode === 'ha' && canHaMode ? 1 : 0)} ${
            displayMode === 'ha' && canHaMode ? valueLabel : 'projekter'
          } fordelt efter ordningstype`
          : 'Ingen projekter med effekt for dette delmål'}
      </p>
      {displayMode === 'ha' && canHaMode && <p className="text-[11px] text-muted-foreground mb-4">{caption}</p>}

      {total > 0 && (
        <>
          <div className="h-8 w-full rounded-full overflow-hidden flex bg-muted mb-5">
            {INITIATOR_ORDER.map((type) => {
              const n = (values as Record<InitiatorType, number>)[type];
              const pct = (n / total) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={type}
                  className="h-full transition-all duration-700 ease-out"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: INITIATOR_CONFIG[type].color,
                  }}
                  title={`${INITIATOR_CONFIG[type].label}: ${formatDanishNumber(n, 1)} (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {INITIATOR_ORDER.map((type) => {
              const n = (values as Record<InitiatorType, number>)[type];
              const pct = total > 0 ? (n / total) * 100 : 0;
              const cfg = INITIATOR_CONFIG[type];

              return (
                <div
                  key={type}
                  className="flex items-start gap-3 p-3 rounded-xl border"
                  style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
                >
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
                        {formatDanishNumber(n, displayMode === 'ha' && canHaMode ? 1 : 0)}
                        {displayMode === 'ha' && canHaMode ? ` ${valueLabel}` : ''}
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

          <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
            Bemærk: “Kommunal/åben” dækker ordninger åbne for både kommuner og private. Den faktiske fordeling af
            ansøgere kendes ikke på projektniveau i MARS.
          </p>
        </>
      )}
    </section>
  );
}
