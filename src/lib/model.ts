/**
 * Two-layer hero model: Indsats (virkemidler treparten anlægger) vs Effekt (udfald i naturen).
 * See docs/design/hero-redesign-brief.md and CURSOR_PLAN.md.
 */

import type { LucideIcon } from 'lucide-react';
import { Trees, Mountain, Droplets, Cloud, Leaf } from 'lucide-react';
import type { CoastalWaterStatusData, DashboardData, CO2EmissionsData } from './types';
import { projectEndPct, assessGoalStatus, timeElapsedPct, type GoalStatus } from './projections';
import { formatDanishNumber } from './format';
import { getPillarConfig, type PillarId } from './pillars';

export type MeasureId = 'skov' | 'lavbund' | 'vaadomraade';
export type EffectDomainId = 'klima' | 'vand' | 'natur';

/** Each card drills into the matching official pillar detail page. */
export const MEASURE_PILLAR: Record<MeasureId, PillarId> = {
  skov: 'afforestation',
  lavbund: 'extraction',
  vaadomraade: 'nitrogen',
};
export const DOMAIN_PILLAR: Record<EffectDomainId, PillarId> = {
  klima: 'co2',
  vand: 'nitrogen',
  natur: 'nature',
};

export interface Measure {
  id: MeasureId;
  pillarId: PillarId;
  label: string;
  icon: LucideIcon;
  accent: string;
  /** Akkumuleret % anlagt mod mål */
  builtPct: number;
  /** Lineær fremskrivning til deadline */
  projectedPct: number;
  /** Pipeline-bjælke: anlagt (solid) */
  anlagtPct: number;
  /** Pipeline-bjælke: godkendt/forundersøgt, ikke endnu anlagt */
  pipelinePct: number;
  achieved: number;
  goal: number;
  unit: string;
  deadlineYear: number;
  status: GoalStatus;
  compactLine: string;
  paceLine: string;
  /** Andel af tiden gået fra aftalen (2024) til deadline, 0–100 */
  timeElapsedPct: number;
  /** Klar-tale sammenligning, fx "På 11% af tiden er 3% anlagt — 7.484 af 250.000 ha." */
  timeVsBuiltSentence: string;
  /** Kort label under fremdriftsbjælken, fx "→ 27% i 2045" */
  ghostLabel: string;
  /** Label ved målflaget, fx "mål 2045" */
  flagLabel: string;
}

/**
 * Effekt-kort vises forskelligt afhængigt af hvor ærligt tallet kan tolkes:
 * - `progress`: aftalens eget mål — vis fremdrift som hidtil.
 * - `ecological-snapshot`: VP3-økologisk tilstand for kystvande (vandmiljø-effekt).
 * - `baseline-gap`: en bestand der allerede fandtes ved underskrift (natur) —
 *   krediter kun det aftalen skal flytte: (nu − baseline) / (mål − baseline).
 * - `attribution`: et nationalt tal drevet udefra (CO₂) — adskil trepartens
 *   andel fra resten, så aftalen ikke tager æren for hele økonomien.
 */
export type EffectReframe =
  | { kind: 'progress'; valueLabel: string; how: string; note: string }
  | {
      kind: 'baseline-gap';
      baselinePct: number;
      currentPct: number;
      targetPct: number;
      deadlineYear: number;
      deltaHeadline: string;
      deltaSub: string;
      verdictLabel: string;
      caveat: string;
    }
  | {
      kind: 'attribution';
      contextLine: string;
      /** Bjælke (andel af hele reduktionen, summerer til ~100): resten af økonomien */
      restPct: number;
      /** Trepartens del der er leveret (anlagt) */
      deliveredPct: number;
      /** Trepartens del der mangler */
      remainingPct: number;
      /** Højre-label ved bjælken, fx "i alt ~17 mio. ton" */
      totalLabel: string;
      /** Stort tal: andel af trepartens bidrag der er anlagt */
      headline: string;
      headlineSub: string;
      verdictLabel: string;
      caveat: string;
    }
  | {
      kind: 'ecological-snapshot';
      how: string;
      valueLabel: string;
      note: string;
      verdictLabel: string;
      goodCount: number;
      totalWaters: number;
      distributionLine: string;
    };

export interface EffectDomain {
  id: EffectDomainId;
  pillarId: PillarId;
  label: string;
  icon: LucideIcon;
  accent: string;
  /** Forklarende linje i klar tale */
  means: string;
  status: GoalStatus;
  valueText: string;
  goalFooter: string;
  /** Hvordan kortet skal tolkes/vises ærligt (se EffectReframe) */
  reframe: EffectReframe;
  /** False for effekt-kort uden eget delmål (fx vandmiljø = udfald af kvælstofindsatsen). */
  isDelmaal?: boolean;
}

/**
 * Trepartens eget skønnede CO₂e-bidrag i 2030 (mio. ton).
 * Kilde: "Aftale om et Grønt Danmark" (regeringen.dk, 24.06.2024) — aftalens
 * eget skøn (KF25-æra). 2,6 er et betinget øvre potentiale, ikke det bogførte tal.
 */
const TREPART_CO2_EFFECT_MT_2030 = 1.8;

/**
 * Beskyttet natur ved underskrift (juni 2024). Eneste tilgængelige estimat er
 * OECD 2024 (~ved underskrift) = combinedEstimatePct. Derfor sættes baseline =
 * det aktuelle estimat, og tilvækst siden underskrift kan endnu ikke måles > 0.
 */
const NATURE_BASELINE_2024_PCT = 15.3;

export interface FlowLink {
  measure: MeasureId;
  domain: EffectDomainId;
  /** 2 = primært formål (tykkere linje), 1 = bidrager */
  level: 1 | 2;
}

export interface IndsatsComposite {
  builtPct: number;
  projectedPct: number;
  status: GoalStatus;
  onTrackCount: number;
  totalMeasures: number;
}

export const FLOW_LINKS: FlowLink[] = [
  { measure: 'skov', domain: 'klima', level: 1 },
  { measure: 'skov', domain: 'vand', level: 1 },
  { measure: 'skov', domain: 'natur', level: 2 },
  { measure: 'lavbund', domain: 'klima', level: 2 },
  { measure: 'lavbund', domain: 'vand', level: 1 },
  { measure: 'lavbund', domain: 'natur', level: 1 },
  { measure: 'vaadomraade', domain: 'vand', level: 2 },
  { measure: 'vaadomraade', domain: 'natur', level: 1 },
];

const MEASURE_ACCENT: Record<MeasureId, string> = {
  skov: getPillarConfig('afforestation').accentColor,
  lavbund: getPillarConfig('extraction').accentColor,
  vaadomraade: getPillarConfig('nitrogen').accentColor,
};

const ECO_STATUS_ORDER = ['Dårlig', 'Ringe', 'Moderat', 'God', 'Høj'] as const;

/** Kort VP3-fordeling, fx "55 ringe · 25 dårlig · 24 moderat · 5 god". */
export function formatEcoDistributionLine(eco: Record<string, number>): string {
  return ECO_STATUS_ORDER.filter((k) => (eco[k] ?? 0) > 0)
    .map((k) => `${eco[k]} ${k.toLowerCase()}`)
    .join(' · ');
}

/** Format percentage for display; shows "< 1%" when positive but rounds to zero. */
export function formatPctHeadline(pct: number, decimals = 0): string {
  if (pct > 0 && pct < 1) return '< 1%';
  return `${formatDanishNumber(decimals === 0 ? Math.round(pct) : pct, decimals)}%`;
}

function buildPaceLine(
  projectedPct: number,
  projectedAbsolute: number,
  unit: string,
  deadlineYear: number,
): string {
  return `Ved dette tempo når vi ~${formatDanishNumber(Math.round(projectedAbsolute))} ${unit} (~${formatPctHeadline(projectedPct)}) af målet i ${deadlineYear}`;
}

/**
 * Plain-language honesty check that makes the linear projection transparent:
 * the projection is literally built% ÷ time-elapsed%, so showing both numbers
 * lets the reader verify where the ghost marker comes from.
 *
 * @example "På 11% af tiden er 3% anlagt — 7.484 af 250.000 ha."
 */
function buildTimeVsBuiltSentence(
  timePct: number,
  builtPct: number,
  achieved: number,
  goal: number,
  unit: string,
): string {
  return `På ${formatPctHeadline(timePct)} af tiden er ${formatPctHeadline(builtPct)} anlagt — ${formatDanishNumber(Math.round(achieved))} af ${formatDanishNumber(goal)} ${unit}.`;
}

/**
 * Area-weighted composite of skov + lavbund anlagt ha — the honest "indsats"-tal (~2%).
 * Fremskrivning bruger skov-deadline (2045) da arealmålene dominerer tidslinjen.
 */
export function buildIndsatsComposite(data: DashboardData): IndsatsComposite {
  const { progress, targets } = data.national;
  const areaAchieved = progress.afforestationAchievedHa + progress.extractionAchievedHa;
  const areaGoal = targets.afforestationHa + targets.extractionHa;
  const builtPct = areaGoal > 0 ? (areaAchieved / areaGoal) * 100 : 0;
  const forestDeadline = parseInt(targets.forestDeadline?.slice(0, 4) ?? '2045', 10);
  const projectedPct = projectEndPct(builtPct, forestDeadline);

  const measures = buildMeasures(data);
  const onTrackCount = measures.filter(
    (m) => m.status === 'on-track' || m.status === 'reached',
  ).length;

  return {
    builtPct,
    projectedPct,
    status: assessGoalStatus(projectedPct, builtPct),
    onTrackCount,
    totalMeasures: measures.length,
  };
}

/** Build the three virkemiddel cards from dashboard + pipeline scenario data. */
export function buildMeasures(data: DashboardData): Measure[] {
  const { progress, targets, pipelineScenarios } = data.national;
  const est = pipelineScenarios.established;
  const appr = pipelineScenarios.approved;

  const affCfg = getPillarConfig('afforestation');
  const extCfg = getPillarConfig('extraction');
  const nCfg = getPillarConfig('nitrogen');

  const defs: Array<{
    id: MeasureId;
    label: string;
    icon: LucideIcon;
    achieved: number;
    goal: number;
    unit: string;
    deadlineYear: number;
    builtPct: number;
    anlagtPct: number;
    pipelinePct: number;
  }> = [
    {
      id: 'skov',
      label: 'Skovrejsning',
      icon: Trees,
      achieved: progress.afforestationAchievedHa,
      goal: targets.afforestationHa,
      unit: 'ha',
      deadlineYear: affCfg.deadlineYear,
      builtPct: progress.afforestationProgressPct,
      anlagtPct: est.afforestationProgressPct,
      pipelinePct: Math.max(0, appr.afforestationProgressPct - est.afforestationProgressPct),
    },
    {
      id: 'lavbund',
      label: 'Lavbundsarealer',
      icon: Mountain,
      achieved: progress.extractionAchievedHa,
      goal: targets.extractionHa,
      unit: 'ha',
      deadlineYear: extCfg.deadlineYear,
      builtPct: progress.extractionProgressPct,
      anlagtPct: est.extractionProgressPct,
      pipelinePct: Math.max(0, appr.extractionProgressPct - est.extractionProgressPct),
    },
    {
      id: 'vaadomraade',
      label: 'Kvælstof-vådområder',
      icon: Droplets,
      achieved: progress.nitrogenAchievedT,
      goal: targets.nitrogenReductionT,
      unit: 'ton N',
      deadlineYear: nCfg.deadlineYear,
      builtPct: progress.nitrogenProgressPct,
      anlagtPct: est.nitrogenProgressPct,
      pipelinePct: Math.max(0, appr.nitrogenProgressPct - est.nitrogenProgressPct),
    },
  ];

  return defs.map((d) => {
    const projectedPct = projectEndPct(d.builtPct, d.deadlineYear);
    const projectedAbsolute = (projectedPct / 100) * d.goal;
    const elapsedPct = timeElapsedPct(d.deadlineYear);
    return {
      id: d.id,
      pillarId: MEASURE_PILLAR[d.id],
      label: d.label,
      icon: d.icon,
      accent: MEASURE_ACCENT[d.id],
      builtPct: d.builtPct,
      projectedPct,
      anlagtPct: d.anlagtPct,
      pipelinePct: d.pipelinePct,
      achieved: d.achieved,
      goal: d.goal,
      unit: d.unit,
      deadlineYear: d.deadlineYear,
      status: assessGoalStatus(projectedPct, d.builtPct),
      compactLine: `${formatDanishNumber(Math.round(d.achieved))} / ${formatDanishNumber(d.goal)} ${d.unit} · ${formatPctHeadline(d.builtPct)}`,
      paceLine: buildPaceLine(projectedPct, projectedAbsolute, d.unit, d.deadlineYear),
      timeElapsedPct: elapsedPct,
      timeVsBuiltSentence: buildTimeVsBuiltSentence(elapsedPct, d.builtPct, d.achieved, d.goal, d.unit),
      ghostLabel: `→ ${formatPctHeadline(projectedPct)} i ${d.deadlineYear}`,
      flagLabel: `mål ${d.deadlineYear}`,
    };
  });
}

/** Build the three effektdomæner — aldrig summeret til ét tal. */
export function buildEffectDomains(
  data: DashboardData,
  co2Data: CO2EmissionsData | null,
  coastalStatus: CoastalWaterStatusData | null = null,
): EffectDomain[] {
  const { progress, targets } = data.national;
  const natureCfg = getPillarConfig('nature');
  const nCfg = getPillarConfig('nitrogen');

  const natureNormalisedPct = natureCfg.target
    ? (progress.natureProtectedPct / natureCfg.target) * 100
    : 0;

  const co2ActualPct = co2Data
    ? (co2Data.milestones.reduction2025Pct / co2Data.targets.reductionPct) * 100
    : null;
  const co2ProjectedPct = co2Data
    ? Math.min(100, (co2Data.milestones.reduction2030Pct / co2Data.targets.reductionPct) * 100)
    : null;

  const coastalTotal = coastalStatus?.summary.total ?? 0;
  const coastalEco = coastalStatus?.summary.ecologicalStatus ?? {};
  const coastalGood = coastalEco.God ?? 0;
  const coastalGoodPct = coastalTotal > 0 ? (coastalGood / coastalTotal) * 100 : null;

  // Natur: krediter kun det aftalen skal flytte (mål − baseline), ikke den
  // bestand der allerede fandtes ved underskrift.
  const natureTarget = natureCfg.target ?? 20;
  const natureCurrentPct = progress.natureProtectedPct;
  const natureGapPoints = natureTarget - NATURE_BASELINE_2024_PCT;
  const natureDeltaPoints = natureCurrentPct - NATURE_BASELINE_2024_PCT;
  const natureGapProgressPct =
    natureGapPoints > 0 ? Math.max(0, (natureDeltaPoints / natureGapPoints) * 100) : 0;

  // CO₂: trepartens del af reduktionen frem mod 2030 vs. hvor lidt der er leveret.
  const co2RemainingMt = co2Data
    ? co2Data.milestones.totalExcl2023 - co2Data.milestones.totalExcl2030
    : 17.4;
  // Trepartens klimabidrag kommer fra skov + lavbund. Bjælken viser hele
  // reduktionen frem mod 2030: resten af økonomien (energi/industri), trepartens
  // del der mangler, og den lille del treparten reelt har anlagt.
  const climateProjectAreaGoal = targets.afforestationHa + targets.extractionHa;
  const climateBuildPct =
    climateProjectAreaGoal > 0
      ? ((progress.afforestationAchievedHa + progress.extractionAchievedHa) / climateProjectAreaGoal) * 100
      : 0;
  const trepartShareOfTotalPct = co2RemainingMt > 0 ? (TREPART_CO2_EFFECT_MT_2030 / co2RemainingMt) * 100 : 10;
  const co2DeliveredOfTotalPct = trepartShareOfTotalPct * (climateBuildPct / 100);
  const co2RemainingOfTotalPct = Math.max(0, trepartShareOfTotalPct - co2DeliveredOfTotalPct);
  const co2RestOfTotalPct = Math.max(0, 100 - trepartShareOfTotalPct);

  const domains: EffectDomain[] = [
    {
      id: 'klima',
      pillarId: DOMAIN_PILLAR.klima,
      label: 'Klima',
      icon: Cloud,
      accent: getPillarConfig('co2').accentColor,
      means: 'Mindre CO₂ og metan i atmosfæren — målt mod 1990-niveau.',
      status: co2ActualPct !== null && co2ProjectedPct !== null
        ? assessGoalStatus(co2ProjectedPct, co2ActualPct)
        : 'unknown',
      valueText: co2Data
        ? `${formatDanishNumber(co2Data.milestones.reduction2025Pct, 0)} / ${formatDanishNumber(co2Data.targets.reductionPct, 0)}%`
        : '…',
      goalFooter: `MÅL: -${formatDanishNumber(co2Data?.targets.reductionPct ?? 70, 0)}% I 2030`,
      reframe: {
        kind: 'attribution',
        contextLine: co2Data
          ? `Danmark samlet: ${formatDanishNumber(co2Data.milestones.reduction2025Pct, 0)}% → ${formatDanishNumber(co2Data.milestones.reduction2030Pct, 1)}% (mål ${formatDanishNumber(co2Data.targets.reductionPct, 0)}% i 2030).`
          : 'Danmark samlet målt mod 1990 (mål 70% i 2030).',
        restPct: co2RestOfTotalPct,
        deliveredPct: co2DeliveredOfTotalPct,
        remainingPct: co2RemainingOfTotalPct,
        totalLabel: `i alt ~${formatDanishNumber(Math.round(co2RemainingMt))} mio. ton`,
        headline: formatPctHeadline(climateBuildPct),
        headlineSub: `af trepartens klimabidrag (~${formatDanishNumber(TREPART_CO2_EFFECT_MT_2030, 1)} mio. ton) er anlagt`,
        verdictLabel: 'Nationalt nær mål',
        caveat:
          'Landbruget skal nå 55–65% i 2030; KF26 forventer 52%. Klimarådet: væsentlig risiko.',
      },
    },
    {
      id: 'vand',
      pillarId: DOMAIN_PILLAR.vand,
      label: 'Vandmiljø',
      icon: Droplets,
      accent: nCfg.accentColor,
      means: 'Det vi vil opnå: bedre økologisk balance i fjorde og kystvande.',
      status:
        coastalGoodPct !== null ? assessGoalStatus(coastalGoodPct, coastalGoodPct) : 'unknown',
      valueText:
        coastalTotal > 0
          ? formatDanishNumber(coastalGood, 0)
          : '…',
      goalFooter:
        coastalTotal > 0
          ? `MÅLING: VP3 TILSTAND · ${formatDanishNumber(coastalTotal, 0)} KYSTVANDE`
          : 'MÅLING: VP3 TILSTAND · KYSTVANDE',
      reframe: {
        kind: 'ecological-snapshot',
        how:
          coastalTotal > 0
            ? `Samlet økologisk tilstand vurderes for ${formatDanishNumber(coastalTotal, 0)} kystvande (VP3) — ikke via kvælstof-ton alene. Vandmiljøet er effekt, ikke eget delmål.`
            : 'Samlet økologisk tilstand vurderes for kystvandene (VP3) — ikke via kvælstof-ton alene.',
        valueLabel:
          coastalTotal > 0
            ? `af ${formatDanishNumber(coastalTotal, 0)} kystvande i god økologisk tilstand (målet er god overalt)`
            : 'kystvande i god økologisk tilstand',
        note: `Kvælstof-vådområder er delmålet — effekten i vandet følger langsomt efter.`,
        verdictLabel:
          coastalTotal > 0
            ? coastalGood === 0
              ? 'Ingen i god tilstand'
              : `${formatDanishNumber(coastalGood, 0)} af ${formatDanishNumber(coastalTotal, 0)} i god tilstand`
            : 'Afventer data',
        goodCount: coastalGood,
        totalWaters: coastalTotal,
        distributionLine: formatEcoDistributionLine(coastalEco),
      },
      isDelmaal: false,
    },
    {
      id: 'natur',
      pillarId: DOMAIN_PILLAR.natur,
      label: 'Natur & biodiversitet',
      icon: Leaf,
      accent: natureCfg.accentColor,
      means: 'Mere beskyttet, sammenhængende natur hvor arter kan trives.',
      status: assessGoalStatus(natureGapProgressPct, natureGapProgressPct),
      valueText: `~${formatPctHeadline(natureNormalisedPct, 0)}`,
      goalFooter: `MÅL: ${formatDanishNumber(natureTarget, 0)}% BESKYTTET NATUR I ${natureCfg.deadlineYear}`,
      reframe: {
        kind: 'baseline-gap',
        baselinePct: NATURE_BASELINE_2024_PCT,
        currentPct: natureCurrentPct,
        targetPct: natureTarget,
        deadlineYear: natureCfg.deadlineYear,
        deltaHeadline: `~${formatPctHeadline(natureGapProgressPct, 0)}`,
        deltaSub: 'af det aftalen skal tilføje siden underskrift',
        verdictLabel: natureDeltaPoints > 0.05 ? 'Næsten i stå' : 'Står stille',
        caveat:
          'Måler juridisk udpegning — ikke om naturen reelt trives.',
      },
    },
  ];

  return domains;
}

/** Which effect domains a measure feeds (for hover highlighting). */
export function domainsForMeasure(measureId: MeasureId): EffectDomainId[] {
  return [...new Set(FLOW_LINKS.filter((l) => l.measure === measureId).map((l) => l.domain))];
}

/** Which measures feed an effect domain (for hover highlighting). */
export function measuresForDomain(domainId: EffectDomainId): MeasureId[] {
  return [...new Set(FLOW_LINKS.filter((l) => l.domain === domainId).map((l) => l.measure))];
}
