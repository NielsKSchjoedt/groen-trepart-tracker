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

/** Vises i 2 linjer på kortet; fuld tekst i info-ikon ved siden af */
const NATURE_NO_PROJECTION_DISCLAIMER =
  'Ingen tempo-prognose: beskyttet natur ændres primært ved politiske udpegninger (Natura 2000, §3 m.m.), ikke via samme projekt-pipeline som de øvrige delmål — derfor vises ikke samme slags fremskrivning som på de andre kort.';

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
        <p>Viser skovrejsning fra tre kilder: <strong>MARS</strong> (vandmiljøprojekter med projektfasedata), <strong>Klimaskovfonden</strong> (~210 frivillige projekter, ~2.300 ha), og <strong>Naturstyrelsen</strong> (~30 statslige projekter, ~4.100 ha).</p>
        <p>KSF og NST administreres uden for MARS og har ikke projektfasedata. Målet er 250.000 ha ny skov inden 2045.</p>
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
        <p>§3- og Natura 2000-arealer er statslige/EU-udpegninger — ikke projekter med faser. I modsætning til de andre delmål sker fremskridt primært via politiske beslutninger om arealdesignering.</p>
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
        subtitle: `${formatDanishNumber(Math.round(progress.nitrogenAchievedT))} af målet på ${formatDanishNumber(pillar.target!)} ${pillar.unit} er ført ud i virkeligheden`,
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
        subtitle: `${formatDanishNumber(Math.round(progress.extractionAchievedHa))} af målet på ${formatDanishNumber(pillar.target!)} ${pillar.unit} er ført ud i virkeligheden`,
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
        subtitle: `${formatDanishNumber(Math.round(progress.afforestationAchievedHa))} af målet på ${formatDanishNumber(pillar.target!)} ${pillar.unit} er ført ud i virkeligheden`,
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
        subtitle: `~${formatDanishNumber(raw, 1)}% af målet på ${pillar.target}% er ført ud i virkeligheden`,
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
        subtitle: `${formatDanishNumber(currentReduction, 0)}% af målet på ${pillar.target}% er ført ud i virkeligheden`,
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
    <section lang="da" className="w-full max-w-5xl min-[1100px]:max-w-6xl min-[1280px]:max-w-7xl mx-auto px-4 py-6">
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
        {/* Show hint persistently in overview mode; otherwise only on first visit */}
        {(activePillar === null || pillarHint.visible) && (
          <HintCallout
            icon={Hand}
            text="Vælg et delmål for at dykke ned i detaljerne"
            arrow="left"
            onDismiss={activePillar === null ? () => {} : pillarHint.dismiss}
            className="absolute left-1/2 -translate-x-1/2 -top-2 sm:left-auto sm:translate-x-0 sm:right-3"
          />
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 items-stretch">
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

  const showProjection = projectedPct !== null && projectedPct < 100 && pillar.target !== null && pillar.id !== 'nature';
  const projectedAbsolute = showProjection ? (projectedPct! / 100) * pillar.target! : null;
  /** Same hex as status-badge (GOAL_STATUS_META) — rød → gul → grøn efter projiceret målnåelse */
  const projectionReachColor = goalMeta.color;

  return (
    <button
      onClick={onSelect}
      className={`relative flex h-full w-full min-h-0 flex-col bg-card rounded-xl border-2 p-4 text-left transition-all hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isActive
          ? 'shadow-md'
          : 'border-border hover:border-border/80'
      }`}
      style={isActive ? { borderColor: pillar.accentColor, backgroundColor: pillar.backgroundTint } : undefined}
      aria-pressed={isActive}
    >
      <div className="flex items-start gap-2 mb-2">
        <div
          className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: pillar.accentColor + '18' }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: pillar.accentColor }} />
        </div>
        <span className="min-w-0 flex-1 text-[10px] font-semibold text-muted-foreground uppercase leading-tight tracking-tight sm:text-xs sm:tracking-wide break-words hyphens-auto">
          {pillar.label}
        </span>
        <InfoTooltip
          title={pillar.label}
          content={PILLAR_INFO[pillar.id].description}
          source={PILLAR_INFO[pillar.id].source}
          size={12}
          side="bottom"
          className="mt-0.5 ml-auto flex-shrink-0"
        />
      </div>

              {pillar.hasData && headline !== null && actualPct !== null ? (
                <>
                  <p
                    className="text-2xl sm:text-3xl font-black mb-0.5 transition-colors duration-150"
                    style={{ fontFamily: "'Fraunces', serif", color: isActive ? pillar.accentColor : undefined }}
                  >
                    {displayHeadline}
                  </p>
          <p className="text-[11px] text-muted-foreground leading-tight mb-2 min-h-[2.25rem] transition-opacity duration-150">
            {displaySubtitle}
          </p>
          <DualProgressBar
            actualPct={actualPct}
            projectedPct={projectedPct}
            accentColor={pillar.accentColor}
            onHoverChange={setBarHover}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <p className="text-[10px] text-muted-foreground shrink-0">
              Mål: {pillar.deadlineYear}
            </p>
            {goalStatus !== 'unknown' && (
              <span
                className="max-w-full text-center text-[10px] font-semibold leading-snug whitespace-normal px-1.5 py-0.5 rounded-full sm:max-w-[10rem]"
                style={{
                  backgroundColor: goalMeta.bgColor,
                  color: goalMeta.color,
                }}
              >
                {goalMeta.icon} {goalMeta.label}
              </span>
            )}
          </div>
          {/* Prognose: max 2 linjer på smalle kort; fuld tekst fra md+. Natur: altid max 2 linjer + info-ikon */}
          <div className="mt-1.5 flex min-h-[2.5rem] flex-col justify-start md:min-h-0">
            {showProjection && projectedAbsolute !== null ? (
              <p className="text-[10px] leading-snug font-bold italic line-clamp-2 md:line-clamp-none">
                <span className="text-muted-foreground font-semibold italic">Ved dette tempo når vi: </span>
                <span className="italic" style={{ color: projectionReachColor }}>
                  ~{formatDanishNumber(Math.round(projectedAbsolute))} {pillar.unit}{' '}
                  <span className="font-black italic">({formatPctHeadline(projectedPct!)})</span>
                </span>
                <span className="text-muted-foreground font-semibold italic">
                  {' '}
                  af målet i {pillar.deadlineYear}
                </span>
              </p>
            ) : pillar.id === 'nature' ? (
              <div className="flex items-start gap-1">
                <p className="min-w-0 flex-1 text-[10px] leading-snug font-bold italic text-muted-foreground/85 line-clamp-2">
                  {NATURE_NO_PROJECTION_DISCLAIMER}
                </p>
                <InfoTooltip
                  title="Hvorfor ingen tempo-prognose?"
                  content={<p>{NATURE_NO_PROJECTION_DISCLAIMER}</p>}
                  size={12}
                  side="top"
                  className="mt-0.5 flex-shrink-0"
                />
              </div>
            ) : null}
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
