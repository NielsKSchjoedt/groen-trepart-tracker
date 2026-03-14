import { useEffect, useState, useCallback } from 'react';
import { formatDanishNumber } from '@/lib/format';
import { usePillar, PILLAR_CONFIGS } from '@/lib/pillars';
import type { PillarId, PillarConfig } from '@/lib/pillars';
import type { DashboardData, CO2EmissionsData } from '@/lib/types';
import { loadCO2Emissions } from '@/lib/data';
import { projectEndPct, assessGoalStatus, GOAL_STATUS_META } from '@/lib/projections';
import { Droplets, Mountain, Trees, Factory, Leaf, Hand } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';
import { HintCallout } from './HintCallout';
import { useFirstVisitHint } from '@/hooks/useFirstVisitHint';

type BarHover = 'actual' | 'projected' | null;

const PILLAR_INFO: Record<PillarId, { description: React.ReactNode; source: string }> = {
  nitrogen: {
    description: (
      <>
        <p>Viser den samlede kvælstofreduktion opnået via kollektive virkemidler (vådområder, lavbundsarealer, minivådområder m.fl.) registreret i MARS.</p>
        <p>Målet på 12.776 ton N/år dækker kollektive virkemidler. Det samlede politiske mål fra Den Grønne Trepart er 13.780 ton N/år inkl. øvrig regulering (bedriftskvoter m.m.) der ikke spores i MARS.</p>
      </>
    ),
    source: 'MARS API (Miljøstyrelsen) — kun anlagte projekter',
  },
  extraction: {
    description: (
      <>
        <p>Viser areal af kulstofrige lavbundsjorde der er udtaget af landbrugsdrift — primært vådområder og lavbundsprojekter.</p>
        <p>Procenten angiver andelen af det nationale mål på 140.000 ha udtaget lavbundsareal. Suppleret af Klimaskovfondens 3 frivillige lavbundsprojekter (~30 ha).</p>
      </>
    ),
    source: 'MARS API (Miljøstyrelsen) + Klimaskovfonden WFS (lavbund)',
  },
  afforestation: {
    description: (
      <>
        <p>Viser skovrejsning fra tre kilder: MARS (vandmiljøprojekter), <strong>Klimaskovfondens ~210 frivillige projekter (~2.300 ha)</strong>, og <strong>Naturstyrelsens ~30 statslige skovrejsningsprojekter (~4.100 ha)</strong>.</p>
        <p>Målet er 250.000 ha ny skov inden 2045. Den nationale tilskudsordning (SGAV) til private/kommunale skovrejsere er den største kilde og allerede dækket via MARS.</p>
      </>
    ),
    source: 'MARS API + Klimaskovfonden WFS + MiljøGIS WFS (Naturstyrelsen)',
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
        <p><strong>Målet er at 20% af Danmarks landareal er juridisk beskyttet natur inden 2030</strong> — via Natura 2000-udpegning, §3-registrering under Naturbeskyttelsesloven og nye naturnationalparker.</p>
        <p>De ~15% er et kombineret estimat (OECD 2024). Natura 2000 dækker ~18% og §3 ~9,5%, men de overlapper ~30%. En præcis beregning kræver et rumligt GIS-overlay.</p>
        <p>I modsætning til de andre delmål sker fremskridt ikke via projektpipeline, men via politiske beslutninger om arealdesignering.</p>
      </>
    ),
    source: 'OECD 2024 / Natura 2000-registret / §3-registret (Miljøstyrelsen)',
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

interface PillarProgress {
  /** Actual progress toward target, normalised to 0–100 (drives bar width) */
  actualPct: number | null;
  /** Projected end-of-period progress toward target, 0–100 (drives projected bar width) */
  projectedPct: number | null;
  /** Human-readable headline string for actual progress (e.g. "27%", "53,0%") */
  headline: string | null;
  /** Human-readable headline string for projected end (e.g. "~87%", "~69,8%") */
  projectedHeadline: string | null;
  /** Subtitle string: "X / Y unit" */
  subtitle: string | null;
}

/**
 * Format a percentage for display, showing "< 1%" when the value is
 * positive but rounds to zero. Avoids misleading "0%" when there is
 * real (but small) progress.
 *
 * @param pct - Percentage value (0–100)
 * @param decimals - Number of decimal places (0 = integer rounding)
 * @returns Formatted string, e.g. "< 1%", "27%", "53,0%"
 * @example formatPctHeadline(0.2)   // "< 1%"
 * @example formatPctHeadline(0)     // "0%"
 * @example formatPctHeadline(27.3)  // "27%"
 * @example formatPctHeadline(15, 1) // "15,0%"
 */
function formatPctHeadline(pct: number, decimals = 0): string {
  if (pct > 0 && pct < 1) return '< 1%';
  return `${formatDanishNumber(decimals === 0 ? Math.round(pct) : pct, decimals)}%`;
}

/**
 * Extract progress metrics for a pillar. For pillars where the target is
 * a percentage (CO2, nature), the headline shows the raw value people
 * understand (e.g. "53%" reduction, "15%" protected). For pillars with
 * absolute targets (nitrogen, extraction, afforestation), the headline
 * shows progress toward target (e.g. "27%").
 *
 * @param pillar - Pillar configuration
 * @param data - National dashboard data
 * @param co2Data - Optional CO₂ emissions data
 * @returns Progress metrics for the pillar
 * @example getPillarProgress(nitrogenConfig, data, null)
 */
function getPillarProgress(
  pillar: PillarConfig,
  data: DashboardData,
  co2Data: CO2EmissionsData | null,
): PillarProgress {
  const { progress } = data.national;

  switch (pillar.id) {
    case 'nitrogen': {
      const pct = progress.nitrogenProgressPct;
      const proj = projectEndPct(pct, pillar.deadlineYear);
      return {
        actualPct: pct,
        projectedPct: proj,
        headline: formatPctHeadline(pct),
        projectedHeadline: `~${formatPctHeadline(proj)}`,
        subtitle: `${formatDanishNumber(Math.round(progress.nitrogenAchievedT))} af ${formatDanishNumber(pillar.target!)} ${pillar.unit}`,
      };
    }
    case 'extraction': {
      const pct = progress.extractionProgressPct;
      const proj = projectEndPct(pct, pillar.deadlineYear);
      return {
        actualPct: pct,
        projectedPct: proj,
        headline: formatPctHeadline(pct),
        projectedHeadline: `~${formatPctHeadline(proj)}`,
        subtitle: `${formatDanishNumber(Math.round(progress.extractionAchievedHa))} af ${formatDanishNumber(pillar.target!)} ${pillar.unit}`,
      };
    }
    case 'afforestation': {
      const pct = progress.afforestationProgressPct;
      const proj = projectEndPct(pct, pillar.deadlineYear);
      return {
        actualPct: pct,
        projectedPct: proj,
        headline: formatPctHeadline(pct),
        projectedHeadline: `~${formatPctHeadline(proj)}`,
        subtitle: `${formatDanishNumber(Math.round(progress.afforestationAchievedHa))} af ${formatDanishNumber(pillar.target!)} ${pillar.unit}`,
      };
    }
    case 'nature': {
      const raw = progress.natureProtectedPct;
      const normalisedPct = pillar.target ? (raw / pillar.target) * 100 : 0;
      return {
        actualPct: normalisedPct,
        projectedPct: normalisedPct,
        headline: `${formatDanishNumber(normalisedPct, 0)}%`,
        projectedHeadline: null,
        subtitle: `~${formatDanishNumber(raw, 1)} af ${pillar.target}% juridisk beskyttet`,
      };
    }
    case 'co2': {
      if (!co2Data) return { actualPct: null, projectedPct: null, headline: null, projectedHeadline: null, subtitle: null };
      const currentReduction = co2Data.milestones.reduction2025Pct;
      const normalisedPct = (currentReduction / co2Data.targets.reductionPct) * 100;
      const projectedReduction = co2Data.milestones.reduction2030Pct;
      const projectedNormalisedPct = Math.min(100, (projectedReduction / co2Data.targets.reductionPct) * 100);
      return {
        actualPct: normalisedPct,
        projectedPct: projectedNormalisedPct,
        headline: `${formatDanishNumber(normalisedPct, 0)}%`,
        projectedHeadline: `~${formatDanishNumber(projectedNormalisedPct, 0)}%`,
        subtitle: `${formatDanishNumber(currentReduction, 0)} af ${pillar.target}% reduktion`,
      };
    }
  }
}

export function PillarCards({ data }: PillarCardsProps) {
  const { activePillar, setActivePillar } = usePillar();
  const [co2Data, setCo2Data] = useState<CO2EmissionsData | null>(null);
  const pillarHint = useFirstVisitHint('pillar-click', 15_000);

  useEffect(() => {
    loadCO2Emissions().then(setCo2Data);
  }, []);

  const handleSelect = useCallback((id: PillarId) => {
    pillarHint.dismiss();
    setActivePillar(id);
  }, [pillarHint, setActivePillar]);

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-center gap-1.5 mb-4">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Status per delmål — baseret på faktisk implementering
        </h2>
        <InfoTooltip
          title="Delmålskort"
          content={
            <>
              <p>Hvert kort viser fremdriften for ét af Den Grønne Trepartsaftales fem delmål, <strong>udelukkende baseret på fysisk gennemførte (anlagte) projekter</strong>.</p>
              <p>Projekter gennemgår en lang pipeline (skitse → forundersøgelse → godkendelse → anlæg), og de lave tal afspejler at implementeringen stadig er i en tidlig fase. Der forventes en naturlig acceleration efterhånden som projekterne modnes.</p>
              <p>Brug scenarievælgeren i prognosekortet ovenfor for at simulere, hvordan billedet ser ud med godkendte eller forundersøgte projekter.</p>
            </>
          }
          size={12}
          side="bottom"
        />
      </div>
      <div className="relative">
        {pillarHint.visible && (
          <HintCallout
            icon={Hand}
            text="Vælg et delmål for at dykke ned i detaljerne"
            arrow="left"
            onDismiss={pillarHint.dismiss}
            className="absolute left-1/2 -translate-x-1/2 -top-2 sm:left-auto sm:translate-x-0 sm:right-3"
          />
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {PILLAR_CONFIGS.map((pillar) => (
          <PillarCard
            key={pillar.id}
            pillar={pillar}
            data={data}
            co2Data={co2Data}
            isActive={activePillar === pillar.id}
            onSelect={() => handleSelect(pillar.id)}
          />
        ))}
        </div>
      </div>
    </section>
  );
}

interface PillarCardProps {
  pillar: PillarConfig;
  data: DashboardData;
  co2Data: CO2EmissionsData | null;
  isActive: boolean;
  onSelect: () => void;
}

/**
 * Individual pillar card with dual progress bar hover interaction and
 * a "Når vi målet?" yes/no verdict based on projected end percentage.
 */
function PillarCard({ pillar, data, co2Data, isActive, onSelect }: PillarCardProps) {
  const Icon = PILLAR_ICONS[pillar.id];
  const { actualPct, projectedPct, headline, projectedHeadline, subtitle } = getPillarProgress(pillar, data, co2Data);
  const [barHover, setBarHover] = useState<BarHover>(null);

  const goalStatus = assessGoalStatus(projectedPct, actualPct);
  const goalMeta = GOAL_STATUS_META[goalStatus];

  const displayHeadline = barHover === 'projected' && projectedHeadline
    ? projectedHeadline
    : headline;

  const displaySubtitle = barHover === 'projected'
    ? 'forventet slutresultat'
    : barHover === 'actual'
      ? 'faktisk fremskridt'
      : subtitle;

  return (
    <button
      onClick={onSelect}
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

              {pillar.hasData && headline !== null && actualPct !== null ? (
                <>
                  <p
                    className="text-xl font-bold mb-0.5 transition-colors duration-150"
                    style={{ fontFamily: "'Fraunces', serif", color: isActive ? pillar.accentColor : undefined }}
                  >
                    {displayHeadline}
                  </p>
          <p className="text-[11px] text-muted-foreground leading-tight mb-2 transition-opacity duration-150" style={{ minHeight: '1rem' }}>
            {displaySubtitle}
          </p>
          <DualProgressBar
            actualPct={actualPct}
            projectedPct={projectedPct}
            accentColor={pillar.accentColor}
            onHoverChange={setBarHover}
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-muted-foreground">
              Mål: {pillar.deadlineYear}
            </p>
            {goalStatus !== 'unknown' && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: goalMeta.bgColor,
                  color: goalMeta.color,
                }}
              >
                {goalMeta.icon} {goalMeta.label}
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mb-2">
            <span className="text-[11px] rounded-full bg-muted text-muted-foreground px-2 py-0.5 font-medium">
              Afventer data
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Mål: {pillar.deadlineYear}
          </p>
        </>
      )}
    </button>
  );
}

interface DualProgressBarProps {
  /** Actual current progress (0–100) */
  actualPct: number;
  /** Projected end-of-period progress (0–100), or null if unavailable */
  projectedPct: number | null;
  /** Accent color for the bars */
  accentColor: string;
  /** Callback when hover state changes */
  onHoverChange: (hover: BarHover) => void;
}

const MUTED_OPACITY = 0.25;
const DIMMED_OPACITY = 0.12;

/**
 * Horizontal progress bar with two interactive layers:
 * - A muted background bar showing projected end-of-period progress
 * - A bright foreground bar showing actual current progress
 *
 * On hover, the hovered bar lights up to full color and the other dims.
 * The parent card reacts via onHoverChange to update headline/subtitle.
 *
 * @example <DualProgressBar actualPct={27} projectedPct={87} accentColor="#0d9488" onHoverChange={setHover} />
 */
function DualProgressBar({ actualPct, projectedPct, accentColor, onHoverChange }: DualProgressBarProps) {
  const clampedActual = Math.min(actualPct, 100);
  const clampedProjected = projectedPct !== null ? Math.min(projectedPct, 100) : null;
  const hasProjection = clampedProjected !== null && clampedProjected > clampedActual;

  const [hover, setHover] = useState<BarHover>(null);

  const handleEnter = useCallback((layer: BarHover) => {
    setHover(layer);
    onHoverChange(layer);
  }, [onHoverChange]);

  const handleLeave = useCallback(() => {
    setHover(null);
    onHoverChange(null);
  }, [onHoverChange]);

  const projectedOpacity =
    hover === 'actual' ? DIMMED_OPACITY
    : hover === 'projected' ? 1
    : MUTED_OPACITY;

  const actualOpacity =
    hover === 'projected' ? 0.35 : 1;

  return (
    <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
      {/* Projected bar (behind) — lights up to full color on hover */}
      {hasProjection && (
        <div
          className="absolute inset-y-0 left-0 rounded-full cursor-pointer"
          style={{
            width: `${clampedProjected}%`,
            backgroundColor: accentColor,
            opacity: projectedOpacity,
            transition: 'opacity 200ms ease',
          }}
          onMouseEnter={() => handleEnter('projected')}
          onMouseLeave={handleLeave}
        />
      )}
      {/* Actual bar (on top) — full color, dims when projected is hovered */}
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${hasProjection ? 'cursor-pointer' : ''}`}
        style={{
          width: `${clampedActual}%`,
          backgroundColor: accentColor,
          opacity: actualOpacity,
          transition: 'opacity 200ms ease',
        }}
        onMouseEnter={hasProjection ? () => handleEnter('actual') : undefined}
        onMouseLeave={hasProjection ? handleLeave : undefined}
      />
    </div>
  );
}
