import { useEffect, useState } from 'react';
import { formatDanishNumber } from '@/lib/format';
import { usePillar, PILLAR_CONFIGS } from '@/lib/pillars';
import type { PillarId, PillarConfig } from '@/lib/pillars';
import type { DashboardData, CO2EmissionsData } from '@/lib/types';
import { loadCO2Emissions } from '@/lib/data';
import { Droplets, Mountain, Trees, Factory, Leaf } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

const PILLAR_INFO: Record<PillarId, { description: React.ReactNode; source: string }> = {
  nitrogen: {
    description: (
      <>
        <p>Viser den samlede kvælstofreduktion opnået via virkemiddelprojekter (vådområder, lavbundsarealer, minivådområder m.fl.).</p>
        <p>Procenten angiver andelen af det nationale reduktionsmål på 13.780 ton N/år der er opnået gennem anlagte projekter.</p>
      </>
    ),
    source: 'MARS API (Miljøstyrelsen) — kun anlagte projekter',
  },
  extraction: {
    description: (
      <>
        <p>Viser areal af kulstofrige lavbundsjorde der er udtaget af landbrugsdrift — primært vådområder og lavbundsprojekter.</p>
        <p>Procenten angiver andelen af det nationale mål på 140.000 ha udtaget lavbundsareal.</p>
      </>
    ),
    source: 'MARS API (Miljøstyrelsen) — anlagte projekter',
  },
  afforestation: {
    description: (
      <>
        <p>Viser arealet af ny skov plantet — dels via MARS-registrerede projekter, dels via supplerende kilder (Klimaskovfonden m.fl.).</p>
        <p>Målet er 250.000 ha ny skov inden 2045 ud over eksisterende fredskov.</p>
      </>
    ),
    source: 'MARS API + Klimaskovfonden',
  },
  co2: {
    description: (
      <>
        <p>Viser Danmarks fremskrevne CO₂-reduktion ift. 1990-niveau. Klimaloven kræver 70% reduktion inden 2030.</p>
        <p>Procenten viser den forventede reduktion baseret på KF25-fremskrivningen (Klima-, Energi- og Forsyningsministeriet).</p>
      </>
    ),
    source: 'KF25 — Klimafremskrivning 2025 (KEFM)',
  },
  nature: {
    description: (
      <>
        <p>Viser andelen af Danmarks landareal der er beskyttet natur (Natura 2000, §3-arealer m.fl.) — målet er 20%.</p>
        <p>Estimat korrigerer for overlap mellem Natura 2000 og §3-beskyttede arealer (~30% overlap).</p>
      </>
    ),
    source: 'Natura 2000 + §3-registret (Miljøstyrelsen)',
  },
};

interface PillarCardsProps {
  data: DashboardData;
}

const PILLAR_ICONS: Record<PillarId, LucideIcon> = {
  nitrogen: Droplets,
  extraction: Mountain,
  afforestation: Trees,
  co2: Factory,
  nature: Leaf,
};

/**
 * Extract the current achieved value and progress percentage for a pillar
 * from the national-level dashboard data.
 */
function getPillarProgress(
  pillar: PillarConfig,
  data: DashboardData,
  co2Data: CO2EmissionsData | null,
): { achieved: number | null; pct: number | null } {
  const { progress } = data.national;
  switch (pillar.id) {
    case 'nitrogen':
      return { achieved: progress.nitrogenAchievedT, pct: progress.nitrogenProgressPct };
    case 'extraction':
      return { achieved: progress.extractionAchievedHa, pct: progress.extractionProgressPct };
    case 'afforestation':
      return { achieved: progress.afforestationAchievedHa, pct: progress.afforestationProgressPct };
    case 'nature':
      return { achieved: progress.natureProtectedPct, pct: progress.natureProtectedPct };
    case 'co2':
      if (!co2Data) return { achieved: null, pct: null };
      // achieved = actual projected reduction %, pct = same (used as display value)
      return {
        achieved: co2Data.milestones.reduction2030Pct,
        pct: co2Data.milestones.reduction2030Pct,
      };
  }
}

export function PillarCards({ data }: PillarCardsProps) {
  const { activePillar, setActivePillar } = usePillar();
  const [co2Data, setCo2Data] = useState<CO2EmissionsData | null>(null);

  useEffect(() => {
    loadCO2Emissions().then(setCo2Data);
  }, []);

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {PILLAR_CONFIGS.map((pillar) => {
          const isActive = activePillar === pillar.id;
          const Icon = PILLAR_ICONS[pillar.id];
          const { achieved, pct } = getPillarProgress(pillar, data, co2Data);

          return (
            <button
              key={pillar.id}
              onClick={() => setActivePillar(pillar.id)}
              className={`relative bg-card rounded-xl border-2 p-4 text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? 'shadow-md'
                  : 'border-border hover:border-border/80'
              }`}
              style={isActive ? { borderColor: pillar.accentColor, backgroundColor: pillar.backgroundTint } : undefined}
              aria-pressed={isActive}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: pillar.accentColor + '18' }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: pillar.accentColor }} />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
                  {pillar.label}
                </span>
                <InfoTooltip
                  title={pillar.label}
                  content={PILLAR_INFO[pillar.id].description}
                  source={PILLAR_INFO[pillar.id].source}
                  size={12}
                  side="bottom"
                  className="ml-auto flex-shrink-0"
                />
              </div>

              {pillar.hasData && achieved !== null ? (
                <>
                  {pct !== null ? (
                    <p
                      className="text-xl font-bold mb-0.5"
                      style={{ fontFamily: "'Fraunces', serif", color: isActive ? pillar.accentColor : undefined }}
                    >
                      {formatDanishNumber(Math.round(pct))}%
                    </p>
                  ) : (
                    <p
                      className="text-lg font-bold mb-0.5"
                      style={{ fontFamily: "'Fraunces', serif", color: isActive ? pillar.accentColor : undefined }}
                    >
                      {formatDanishNumber(Math.round(achieved))} ha
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground leading-tight mb-2">
                    {pillar.id === 'nature'
                      ? `${formatDanishNumber(achieved, 1)}% / ${pillar.target}% beskyttet`
                      : pillar.id === 'co2'
                        ? `${formatDanishNumber(achieved, 1)}% / ${pillar.target}% reduktion`
                        : pillar.target
                          ? `${formatDanishNumber(Math.round(achieved))} / ${formatDanishNumber(pillar.target)} ${pillar.unit}`
                          : `${formatDanishNumber(Math.round(achieved))} ${pillar.unit}`}
                  </p>
                  {pct !== null && (
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            (pillar.id === 'nature' || pillar.id === 'co2') && pillar.target
                              ? (achieved! / pillar.target) * 100
                              : pct,
                            100
                          )}%`,
                          backgroundColor: pillar.accentColor,
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="mb-2">
                  <span className="text-[11px] rounded-full bg-muted text-muted-foreground px-2 py-0.5 font-medium">
                    Afventer data
                  </span>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground mt-2">
                Mål: {pillar.deadlineYear}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
