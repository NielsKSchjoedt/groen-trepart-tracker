import { useState, useEffect } from 'react';
import { ArcGauge } from './ArcGauge';
import { CountdownTimer } from './CountdownTimer';
import { NatureWatermark } from './NatureWatermark';
import type { Animal } from './NatureWatermark';
import { ShareButton } from './ShareButton';
import { usePillar, PILLAR_CONFIGS } from '@/lib/pillars';
import { loadCO2Emissions } from '@/lib/data';
import { projectEndPct, assessGoalStatus, GOAL_STATUS_META, getPillarProjectionData, type GoalStatus } from '@/lib/projections';
import type { DashboardData, CO2EmissionsData } from '@/lib/types';
import { Leaf, TreePine } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';
import { ViewSwitcher } from './ViewSwitcher';

interface HeroSectionProps {
  data: DashboardData;
}

/**
 * Assess a pillar's goal status for the hero circle indicators, delegating
 * to the shared graduated assessGoalStatus function.
 *
 * @param projectedPct - Projected progress at deadline (0–100+)
 * @param actualPct    - Current actual progress (0–100)
 * @param hasData      - Whether the pillar has numeric data
 * @returns A graduated GoalStatus tier
 * @example assessPillarHeroStatus(93, 60, true) // => 'very-close'
 */
function assessPillarHeroStatus(
  projectedPct: number | null,
  actualPct: number | null,
  hasData: boolean,
): GoalStatus {
  if (!hasData || projectedPct === null) return 'unknown';
  return assessGoalStatus(projectedPct, actualPct);
}

export function HeroSection({ data }: HeroSectionProps) {
  const { activePillar, setActivePillar, config } = usePillar();
  const { progress } = data.national;

  // Load CO₂ emissions data for the CO₂ pillar
  const [co2Data, setCo2Data] = useState<CO2EmissionsData | null>(null);
  useEffect(() => {
    loadCO2Emissions().then(setCo2Data);
  }, []);

  // Per-pillar actual + projected percentages (normalised to 0–100 where 100 = target met).
  // CO₂ uses the KF25 climate model projection instead of naive linear extrapolation.
  const natureCfg = PILLAR_CONFIGS.find((p) => p.id === 'nature');
  const natureNormalisedPct =
    natureCfg?.target ? (progress.natureProtectedPct / natureCfg.target) * 100 : 0;

  const co2ActualPct = co2Data
    ? (co2Data.milestones.reduction2025Pct / co2Data.targets.reductionPct) * 100
    : null;
  const co2ProjectedPct = co2Data
    ? Math.min(100, (co2Data.milestones.reduction2030Pct / co2Data.targets.reductionPct) * 100)
    : null;

  interface PillarEntry { id: string; actualPct: number; projectedPct: number; deadlineYear: number }
  const pillarEntries: PillarEntry[] = [
    { id: 'nitrogen', actualPct: progress.nitrogenProgressPct, projectedPct: projectEndPct(progress.nitrogenProgressPct, PILLAR_CONFIGS.find((p) => p.id === 'nitrogen')!.deadlineYear), deadlineYear: PILLAR_CONFIGS.find((p) => p.id === 'nitrogen')!.deadlineYear },
    { id: 'extraction', actualPct: progress.extractionProgressPct, projectedPct: projectEndPct(progress.extractionProgressPct, PILLAR_CONFIGS.find((p) => p.id === 'extraction')!.deadlineYear), deadlineYear: PILLAR_CONFIGS.find((p) => p.id === 'extraction')!.deadlineYear },
    { id: 'afforestation', actualPct: progress.afforestationProgressPct, projectedPct: projectEndPct(progress.afforestationProgressPct, PILLAR_CONFIGS.find((p) => p.id === 'afforestation')!.deadlineYear), deadlineYear: PILLAR_CONFIGS.find((p) => p.id === 'afforestation')!.deadlineYear },
    { id: 'nature', actualPct: natureNormalisedPct, projectedPct: natureNormalisedPct, deadlineYear: PILLAR_CONFIGS.find((p) => p.id === 'nature')!.deadlineYear },
    ...(co2ActualPct !== null && co2ProjectedPct !== null
      ? [{ id: 'co2', actualPct: co2ActualPct, projectedPct: co2ProjectedPct, deadlineYear: PILLAR_CONFIGS.find((p) => p.id === 'co2')!.deadlineYear }]
      : []),
  ];

  const pillarStatuses = PILLAR_CONFIGS.map((p) => {
    const entry = pillarEntries.find((e) => e.id === p.id);
    return {
      config: p,
      status: assessPillarHeroStatus(entry?.projectedPct ?? null, entry?.actualPct ?? null, p.hasData && !!entry),
    };
  });

  const onTrackCount = pillarStatuses.filter((s) => s.status === 'on-track' || s.status === 'reached').length;
  const totalWithData = pillarStatuses.filter((s) => s.status !== 'unknown').length;

  const compositeProgressPct = pillarEntries.length > 0
    ? pillarEntries.reduce((a, e) => a + e.actualPct, 0) / pillarEntries.length
    : 0;

  const compositeProjectedPct = pillarEntries.length > 0
    ? pillarEntries.reduce((a, e) => a + e.projectedPct, 0) / pillarEntries.length
    : 0;

  const compositeStatus = pillarEntries.length > 0
    ? assessGoalStatus(compositeProjectedPct, compositeProgressPct)
    : 'unknown';
  const compositeStatusMeta = GOAL_STATUS_META[compositeStatus];

  return (
    <section className="w-full pt-10 pb-14 md:pb-20 text-center relative overflow-hidden">
      <ViewSwitcher />

      <div className="absolute top-6 left-8 opacity-[0.08] pointer-events-none">
        <Leaf className="w-32 h-32 text-primary animate-gentle-sway" strokeWidth={1} />
      </div>
      <div className="absolute bottom-4 right-10 opacity-[0.07] pointer-events-none">
        <TreePine className="w-40 h-40 text-nature-moss" strokeWidth={1} />
      </div>
      <div className="absolute top-1/3 right-1/4 opacity-[0.06] pointer-events-none hidden md:block">
        <Leaf className="w-20 h-20 text-nature-leaf rotate-45" strokeWidth={1} />
      </div>

      {(activePillar ? config.watermarks : ['deer', 'butterfly', 'heron', 'owl'] as Animal[]).slice(0, 4).map((animal, i) => {
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

      <h1
        className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-3"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Er vi på sporet?
      </h1>
      <p
        className="text-lg md:text-xl text-muted-foreground mb-1"
        style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
      >
        — til et grønt Danmark
      </p>
      <p className="text-muted-foreground text-base md:text-lg mb-4 max-w-lg mx-auto leading-relaxed flex items-center justify-center gap-1.5 flex-wrap">
        <span>Følg Danmarks fremskridt med kvælstofreduktion, lavbundsarealer, skovrejsning, klima og beskyttet natur</span>
        <InfoTooltip
          title="Hvad ser du her?"
          content={
            <>
              <p>Denne side viser Danmarks fremskridt mod de 5 hovedmål i den grønne trepart-aftale fra december 2023.</p>
              <p>Data hentes automatisk fra offentlige kilder (MARS API, Miljøstyrelsen m.fl.) og opdateres løbende. Alle tal er baseret på officielle projektdata og statistikker.</p>
            </>
          }
          source="Den Grønne Trepart (Finansministeriet, dec. 2023)"
          methodLink="#datakilder"
          size={15}
          side="bottom"
        />
      </p>

      {/* Share button — only shown when a specific pillar is active */}
      {activePillar && (
        <div className="flex justify-center mb-8">
          <ShareButton pillarLabel={config.label} />
        </div>
      )}

      {/* Overall composite progress gauge */}
      <div className="mb-6 relative">
        <ArcGauge
          value={Math.round(compositeProgressPct)}
          max={100}
          pct={compositeProgressPct}
          projectedPct={compositeProjectedPct}
          unit="%"
          subText="mål nået"
          label={co2ActualPct !== null
            ? "Gennemsnitlig fremgang på tværs af kvælstof, lavbundsarealer, skovrejsning, CO₂ og beskyttet natur"
            : "Gennemsnitlig fremgang på tværs af kvælstof, lavbundsarealer, skovrejsning og beskyttet natur"
          }
          size={240}
          statusLabel={compositeStatusMeta.label}
          statusColor={compositeStatusMeta.color}
          statusIcon={compositeStatusMeta.icon}
        />
        <div className="flex items-center justify-center mt-1">
          <InfoTooltip
            title="Hvad viser denne procent?"
            content={
              <>
                <p><strong>Hvor langt er vi mod målstregen?</strong> Tallet viser hvor stor en andel af de samlede mål der allerede er nået — ikke om vi er foran eller bagud tidsplanen. Bemærk: delmålene har forskellige deadlines (kvælstof 2027, CO₂/beskyttet natur 2030, skovrejsning 2045).</p>
                <p>Hvert delmål normaliseres til 0–100% (f.eks. beskyttet natur: 15% af 20%-mål = 75% nået) og vægtes lige i gennemsnittet.</p>
                <p>Cirklerne nedenfor viser noget andet: om hvert delmål forventes at nå sit mål inden deadline (grøn ✓) eller ej (orange !).</p>
              </>
            }
            source="Beregnet på baggrund af data fra MARS, KF25 og Miljøstyrelsen"
            methodLink="#metode"
            size={13}
          />
        </div>
      </div>

      {/* Status strip — 5 pillar indicators (clickable) */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
        {pillarStatuses.map(({ config: pc, status }) => {
          const isSelected = activePillar === pc.id;
          const meta = GOAL_STATUS_META[status];
          return (
            <button
              key={pc.id}
              onClick={() => setActivePillar(pc.id)}
              className="flex flex-col items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-1 transition-transform hover:scale-110"
              aria-pressed={isSelected}
              title={`${pc.label}: ${meta.label}`}
            >
              <div
                className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: meta.color,
                  backgroundColor: status === 'unknown' ? '#f5f5f5' : meta.color + '15',
                  boxShadow: isSelected ? `0 0 0 2px white, 0 0 0 4px ${pc.accentColor}` : undefined,
                }}
              >
                <span className="text-[10px] md:text-xs font-bold" style={{ color: meta.color }}>
                  {meta.icon}
                </span>
              </div>
              <span
                className="text-[9px] md:text-[10px] font-semibold rounded-full px-2 py-0.5 transition-colors"
                style={{
                  backgroundColor: pc.accentColor + (isSelected ? '20' : '10'),
                  color: isSelected ? pc.accentColor : pc.accentColor + 'bb',
                }}
              >
                {pc.label}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground mb-8 flex items-center justify-center gap-1.5">
        <span><span className="font-semibold text-foreground">{onTrackCount} af {totalWithData}</span>{' '}delmål når målet baseret på faktisk implementering</span>
        <InfoTooltip
          title="Når vi målet?"
          content={
            <>
              <p><strong>Baseret på faktisk implementering.</strong> Statusen måler udelukkende, hvad der er fysisk gennemført (anlagt) til dato — ikke hvad der er planlagt eller godkendt.</p>
              <p>Projekter gennemgår en lang pipeline (skitse → forundersøgelse → godkendelse → anlæg), og der forventes en <em>naturlig acceleration</em> efterhånden som flere projekter modnes. Brug <strong>scenarievælgeren</strong> i prognosekortet nedenfor for at se, hvordan billedet ændres hvis godkendte eller forundersøgte projekter også realiseres.</p>
              <p>For CO₂ bruges KF25-klimafremskrivningen i stedet for lineær ekstrapolation. For <strong>beskyttet natur</strong> vises den aktuelle andel af juridisk beskyttet areal (Natura 2000 + §3) mod 20%-målet — uden projektion, da fremskridt sker via politiske beslutninger om arealdesignering.</p>
              <p>
                <span style={{ color: GOAL_STATUS_META['reached'].color }}>✓ Mål nået</span> — allerede over 100%<br />
                <span style={{ color: GOAL_STATUS_META['on-track'].color }}>✓ Når målet</span> — prognose ≥ 100%<br />
                <span style={{ color: GOAL_STATUS_META['very-close'].color }}>○ Tæt på målet</span> — prognose 90–99%<br />
                <span style={{ color: GOAL_STATUS_META['close'].color }}>○ Nærmer sig målet</span> — prognose 75–89%<br />
                <span style={{ color: GOAL_STATUS_META['behind'].color }}>! Når ikke målet</span> — prognose under 75%
              </p>
            </>
          }
          methodLink="#metode"
          size={12}
        />
      </p>

      {/* Countdown timer — only when a specific pillar is active */}
      {activePillar && (() => {
        const projData = getPillarProjectionData(activePillar, data, co2Data);
        const pillarCfg = PILLAR_CONFIGS.find((p) => p.id === activePillar);
        const deadline = projData?.deadline ?? (pillarCfg ? `${pillarCfg.deadlineYear}-12-31` : null);
        return deadline ? <CountdownTimer deadline={deadline} /> : null;
      })()}

    </section>
  );
}
