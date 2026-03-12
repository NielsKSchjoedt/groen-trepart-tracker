import { useState, useEffect } from 'react';
import { ArcGauge } from './ArcGauge';
import { CountdownProjection } from './CountdownProjection';
import { NatureWatermark } from './NatureWatermark';
import { ShareButton } from './ShareButton';
import { usePillar, PILLAR_CONFIGS } from '@/lib/pillars';
import { loadCO2Emissions } from '@/lib/data';
import type { DashboardData, CO2EmissionsData } from '@/lib/types';
import { Leaf, TreePine } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

interface HeroSectionProps {
  data: DashboardData;
}

type TrackStatus = 'on-track' | 'behind' | 'unknown';

/**
 * Determine whether a pillar is "on track" using linear interpolation:
 * progressPct >= (elapsed / total window) * 100.
 */
function assessPillarStatus(
  progressPct: number | null,
  deadlineYear: number,
  hasData: boolean,
): TrackStatus {
  if (!hasData || progressPct === null) return 'unknown';
  const now = new Date();
  const start = new Date('2024-01-01');
  const deadline = new Date(`${deadlineYear}-12-31`);
  const elapsed = now.getTime() - start.getTime();
  const total = deadline.getTime() - start.getTime();
  const expectedPct = total > 0 ? (elapsed / total) * 100 : 0;
  return progressPct >= expectedPct ? 'on-track' : 'behind';
}

const STATUS_COLORS: Record<TrackStatus, string> = {
  'on-track': '#16a34a',
  'behind': '#f97316',
  'unknown': '#d4d4d4',
};

/**
 * Extract pillar-specific achieved, target, deadline, and unit from DashboardData
 * for use in the CountdownProjection. Returns null for pillars without
 * numeric targets or data.
 */
function getPillarProjectionData(
  pillarId: string,
  data: DashboardData,
  co2Data: CO2EmissionsData | null,
): { achieved: number; target: number; deadline: string; unit: string; accentColor: string } | null {
  const { targets, progress } = data.national;
  switch (pillarId) {
    case 'nitrogen':
      return {
        achieved: progress.nitrogenAchievedT,
        target: targets.nitrogenReductionT,
        deadline: targets.deadline,
        unit: 'ton',
        accentColor: '#0d9488',
      };
    case 'extraction':
      return {
        achieved: progress.extractionAchievedHa,
        target: targets.extractionHa,
        deadline: targets.deadline,
        unit: 'ha',
        accentColor: '#a16207',
      };
    case 'afforestation':
      return {
        achieved: progress.afforestationAchievedHa,
        target: targets.afforestationHa,
        deadline: targets.forestDeadline,
        unit: 'ha',
        accentColor: '#15803d',
      };
    case 'nature':
      return {
        achieved: progress.natureProtectedPct,
        target: targets.protectedNaturePct,
        deadline: targets.deadline,
        unit: '%',
        accentColor: '#166534',
      };
    case 'co2':
      if (!co2Data) return null;
      return {
        achieved: co2Data.milestones.reduction2025Pct,
        target: co2Data.targets.reductionPct,
        deadline: '2030-12-31',
        unit: '% reduktion',
        accentColor: '#737373',
      };
    default:
      return null;
  }
}

export function HeroSection({ data }: HeroSectionProps) {
  const { activePillar, setActivePillar, config } = usePillar();
  const { progress } = data.national;

  // Load CO₂ emissions data for the CO₂ pillar
  const [co2Data, setCo2Data] = useState<CO2EmissionsData | null>(null);
  useEffect(() => {
    loadCO2Emissions().then(setCo2Data);
  }, []);

  // CO₂ progress: how far along the 70% reduction target
  // reduction2025Pct is the KF25-projected reduction as of 2025 (≈69.8%)
  const co2ProgressPct = co2Data
    ? (co2Data.milestones.reduction2025Pct / co2Data.targets.reductionPct) * 100
    : null;

  const pillarStatuses = PILLAR_CONFIGS.map((p) => {
    let pct: number | null = null;
    if (p.id === 'nitrogen') pct = progress.nitrogenProgressPct;
    else if (p.id === 'extraction') pct = progress.extractionProgressPct;
    else if (p.id === 'afforestation') pct = progress.afforestationProgressPct;
    else if (p.id === 'nature' && p.target)
      pct = (progress.natureProtectedPct / p.target) * 100;
    else if (p.id === 'co2') pct = co2ProgressPct;
    return { config: p, status: assessPillarStatus(pct, p.deadlineYear, p.hasData && pct !== null) };
  });

  const onTrackCount = pillarStatuses.filter((s) => s.status === 'on-track').length;
  const totalWithData = pillarStatuses.filter((s) => s.status !== 'unknown').length;

  // Weighted average across all measurable pillars.
  // Nature's raw % (e.g. 15%) is normalised against its 20% target so it's
  // comparable to the other pillars' 0–100% scales.
  const natureCfg = PILLAR_CONFIGS.find((p) => p.id === 'nature');
  const natureNormalisedPct =
    natureCfg?.target ? (progress.natureProtectedPct / natureCfg.target) * 100 : 0;
  const measurablePcts = [
    progress.nitrogenProgressPct,
    progress.extractionProgressPct,
    progress.afforestationProgressPct,
    natureNormalisedPct,
    ...(co2ProgressPct !== null ? [co2ProgressPct] : []),
  ];
  const compositeProgressPct = measurablePcts.length > 0
    ? measurablePcts.reduce((a, b) => a + b, 0) / measurablePcts.length
    : 0;

  const projectionData = getPillarProjectionData(activePillar, data, co2Data);

  return (
    <section className="w-full py-14 md:py-20 text-center relative overflow-hidden">
      <div className="absolute top-6 left-8 opacity-[0.08] pointer-events-none">
        <Leaf className="w-32 h-32 text-primary animate-gentle-sway" strokeWidth={1} />
      </div>
      <div className="absolute bottom-4 right-10 opacity-[0.07] pointer-events-none">
        <TreePine className="w-40 h-40 text-nature-moss" strokeWidth={1} />
      </div>
      <div className="absolute top-1/3 right-1/4 opacity-[0.06] pointer-events-none hidden md:block">
        <Leaf className="w-20 h-20 text-nature-leaf rotate-45" strokeWidth={1} />
      </div>

      {config.watermarks.slice(0, 4).map((animal, i) => {
        const positions = [
          'absolute bottom-16 left-4 opacity-[0.10] hidden lg:block',
          'absolute top-20 right-6 opacity-[0.12] hidden md:block animate-gentle-sway',
          'absolute top-40 left-1/4 opacity-[0.08] hidden lg:block',
          'absolute bottom-32 right-1/4 opacity-[0.09] hidden md:block',
        ];
        const sizes = [150, 70, 60, 90];
        return (
          <div key={`${animal}-${i}`} className={`pointer-events-none transition-opacity duration-300 ${positions[i]}`}>
            <NatureWatermark animal={animal} size={sizes[i]} />
          </div>
        );
      })}

      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="text-2xl">🌿</span>
        <span className="text-xs font-medium uppercase tracking-widest text-primary">
          Den Grønne Trepart
        </span>
        <span className="text-2xl">🌿</span>
      </div>

      <h1
        className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-3"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Er vi på sporet?
      </h1>
      <p className="text-muted-foreground text-base md:text-lg mb-4 max-w-lg mx-auto leading-relaxed flex items-center justify-center gap-1.5 flex-wrap">
        <span>Følg Danmarks fremskridt med kvælstofreduktion, lavbundsarealer, skovrejsning, klima og natur</span>
        <InfoTooltip
          title="Hvad ser du her?"
          content={
            <>
              <p>Denne side viser Danmarks fremskridt mod de 5 hovedmål i den grønne trepart-aftale fra december 2023.</p>
              <p>Data hentes automatisk fra offentlige kilder (MARS API, Miljøstyrelsen m.fl.) og opdateres løbende. Alle tal er baseret på officielle projektdata og statistikker.</p>
            </>
          }
          source="Den Grønne Trepart (Finansministeriet, dec. 2023)"
          size={15}
          side="bottom"
        />
      </p>

      {/* Share button — lets users copy a direct link to the active pillar view */}
      <div className="flex justify-center mb-8">
        <ShareButton pillarLabel={config.label} />
      </div>

      {/* Overall composite progress gauge */}
      <div className="mb-6 relative">
        <ArcGauge
          value={Math.round(compositeProgressPct)}
          max={100}
          pct={compositeProgressPct}
          unit="%"
          subText="samlet fremskridt"
          label={co2ProgressPct !== null
            ? "Gennemsnit af kvælstof, lavbundsarealer, skovrejsning, CO₂ og natur"
            : "Gennemsnit af kvælstof, lavbundsarealer, skovrejsning og natur"
          }
          size={240}
        />
        <div className="flex items-center justify-center mt-1">
          <InfoTooltip
            title="Hvad viser denne procent?"
            content={
              <>
                <p><strong>Hvor langt er vi mod målstregen?</strong> Tallet viser hvor stor en andel af de samlede 2030-mål der allerede er nået — ikke om vi er foran eller bagud tidsplanen.</p>
                <p>Hvert delmål normaliseres til 0–100% (f.eks. natur: 15% beskyttet af 20%-mål = 75% nået) og vægtes lige i gennemsnittet.</p>
                <p>Cirklerne nedenfor viser noget andet: om hvert delmål følger den forventede tidsplan (grøn ✓) eller er bagud (orange !).</p>
              </>
            }
            source="Beregnet på baggrund af data fra MARS, KF25 og Miljøstyrelsen"
            size={13}
          />
        </div>
      </div>

      {/* Status strip — 5 pillar indicators (clickable) */}
      <div className="flex items-center justify-center gap-2 mb-3">
        {pillarStatuses.map(({ config: pc, status }) => {
          const isSelected = activePillar === pc.id;
          return (
            <button
              key={pc.id}
              onClick={() => setActivePillar(pc.id)}
              className="flex flex-col items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-1 transition-transform hover:scale-110"
              aria-pressed={isSelected}
              title={`${pc.label}: ${status === 'on-track' ? 'På sporet' : status === 'behind' ? 'Ikke på sporet' : 'Afventer data'}`}
            >
              <div
                className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'ring-2 ring-offset-2' : ''}`}
                style={{
                  borderColor: STATUS_COLORS[status],
                  backgroundColor: status === 'unknown' ? '#f5f5f5' : STATUS_COLORS[status] + '15',
                  ringColor: isSelected ? STATUS_COLORS[status] : undefined,
                }}
              >
                <span className="text-[10px] md:text-xs font-bold" style={{ color: STATUS_COLORS[status] }}>
                  {status === 'on-track' ? '✓' : status === 'behind' ? '!' : '?'}
                </span>
              </div>
              <span className={`text-[9px] md:text-[10px] font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>{pc.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground mb-8 flex items-center justify-center gap-1.5">
        <span><span className="font-semibold text-foreground">{onTrackCount} af {totalWithData}</span>{' '}delmål med data er på sporet</span>
        <InfoTooltip
          title="&quot;På sporet&quot; — hvad betyder det?"
          content={
            <>
              <p><strong>Er vi foran eller bagud tidsplanen?</strong> Hvert delmål sammenlignes med den forventede lineære fremdrift fra aftalens start (jan. 2024) til deadline.</p>
              <p>Eksempel: Hvis vi er halvvejs i tid, skal mindst 50% af målet være nået for at være «på sporet».</p>
              <p>Grøn ✓ = foran eller på tidsplanen. Orange ! = bagud tidsplanen.</p>
              <p>Dette er uafhængigt af procenttallet i buen ovenfor, som blot viser den samlede andel nået af 2030-målene.</p>
            </>
          }
          size={12}
        />
      </p>

      {/* Pillar-specific countdown + projection — only for pillars with numeric targets */}
      {projectionData ? (
        <div className="px-4">
          <CountdownProjection
            deadline={projectionData.deadline}
            achieved={projectionData.achieved}
            target={projectionData.target}
            unit={projectionData.unit}
            accentColor={projectionData.accentColor}
            trackingStart="2024-01-01"
          />
        </div>
      ) : (
        <div className="px-4 max-w-lg mx-auto">
          <div className="rounded-xl border border-border p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground">
              {config.stubMessage || `${config.label}: Ingen kvantitativ fremskrivning tilgængelig endnu`}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
