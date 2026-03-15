import { useState, useEffect } from 'react';
import type { ComponentType } from 'react';
import { formatDanishNumber } from '@/lib/format';
import { TrendingUp, TrendingDown, Target, GitPullRequestArrow, Pencil, ClipboardCheck, ShieldCheck, Hammer } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';
import { assessGoalStatus, GOAL_STATUS_META } from '@/lib/projections';
import type { PipelineScenarioKey } from '@/lib/types';

/**
 * Pipeline scenario steps — ordered from most conservative to most optimistic.
 * Cumulative selection: choosing `preliminary` implicitly includes `established`
 * and `approved` as well (all steps with rank ≤ selected rank are highlighted).
 */
const SCENARIO_OPTIONS: {
  key: PipelineScenarioKey;
  label: string;
  /** Short label shown in step buttons */
  shortLabel: string;
  /** Grammatical form used in body copy ("Hvis alle X projekter var anlagt") */
  bodyLabel: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  /** Cumulative rank: a step is active when rank ≤ selectedRank */
  rank: number;
  disabled?: boolean;
}[] = [
  {
    key: 'established',
    label: 'Kun anlagte projekter',
    shortLabel: 'Anlagte',
    bodyLabel: 'anlagte',
    description: 'Kun fysisk gennemførte projekter tælles med',
    icon: Hammer,
    rank: 0,
  },
  {
    key: 'approved',
    label: '+ godkendte projekter',
    shortLabel: 'Godkendte',
    bodyLabel: 'godkendte',
    description: 'Anlagte + godkendt til anlæg (etableringstilsagn)',
    icon: ShieldCheck,
    rank: 1,
  },
  {
    key: 'preliminary',
    label: '+ under forundersøgelse',
    shortLabel: 'Forundersøgelse',
    bodyLabel: 'forundersøgte',
    description: 'Anlagte + godkendte + forundersøgelsestilsagn',
    icon: ClipboardCheck,
    rank: 2,
  },
  {
    key: 'all',
    label: '+ skitser',
    shortLabel: 'Skitser',
    bodyLabel: 'skitserede',
    description: 'Skitser har endnu ikke estimerede effekter — afventer forundersøgelse',
    icon: Pencil,
    rank: 3,
    disabled: true,
  },
];

interface ScenarioValues {
  achieved: number;
  projected?: number;
}

interface CountdownProjectionProps {
  deadline: string;
  achieved: number;
  target: number;
  /** Short unit label (e.g. "ton", "ha") used in progress text */
  unit?: string;
  /** Pillar accent color for the progress bar */
  accentColor?: string;
  /** Approximate start date of tracking / agreement */
  trackingStart?: string;
  /**
   * Override the linear projection with an external model value (in the same
   * unit as `achieved` and `target`). When provided, the component skips its
   * own linear extrapolation and uses this value instead.
   */
  projectedOverride?: number;
  /**
   * Pipeline scenario values keyed by scenario. When provided, a dropdown
   * appears allowing the user to switch between conservative (established-only)
   * and optimistic (approved, preliminary) views. The `achieved` prop is used
   * as the default "established" scenario.
   */
  scenarios?: Partial<Record<PipelineScenarioKey, ScenarioValues>>;
  /** Active pillar label shown as a colored badge (e.g. "Kvælstof") */
  pillarLabel?: string;
  /** Pillar brand color used for the badge background */
  pillarColor?: string;
}

export function CountdownProjection({
  deadline,
  achieved,
  target,
  unit = 'ton',
  accentColor,
  trackingStart = '2024-01-01',
  projectedOverride,
  scenarios,
  pillarLabel,
  pillarColor,
}: CountdownProjectionProps) {
  const [now, setNow] = useState(() => new Date());
  const [selectedScenario, setSelectedScenario] = useState<PipelineScenarioKey>('established');

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hasScenarios = scenarios && Object.keys(scenarios).length > 1;
  const isOptimistic = selectedScenario !== 'established';
  const scenarioValues = hasScenarios && isOptimistic
    ? scenarios[selectedScenario]
    : undefined;
  const scenarioAchieved = scenarioValues?.achieved ?? achieved;
  const selectedOption = SCENARIO_OPTIONS.find((o) => o.key === selectedScenario)!;
  const scenarioDelta = isOptimistic
    ? scenarioAchieved - (scenarios?.established?.achieved ?? achieved)
    : 0;;

  const deadlineDate = new Date(deadline);
  const startDate = new Date(trackingStart);

  const diffMs = Math.max(0, deadlineDate.getTime() - now.getTime());

  // Linear extrapolation: project current achieved value forward to deadline
  const elapsedMs = now.getTime() - startDate.getTime();
  const totalWindowMs = deadlineDate.getTime() - startDate.getTime();
  const elapsedFraction = Math.max(0.001, elapsedMs / totalWindowMs);

  // Active values: use scenario achieved when an optimistic scenario is selected,
  // otherwise fall back to the base established achieved.
  const activeAchieved = isOptimistic ? scenarioAchieved : achieved;
  const activeProjectedTotal = projectedOverride ?? (activeAchieved / elapsedFraction);
  const activeProjectedPct = target > 0 ? (activeProjectedTotal / target) * 100 : 0;
  const activeActualPct = target > 0 ? (activeAchieved / target) * 100 : 0;

  const goalStatus = assessGoalStatus(activeProjectedPct, activeActualPct);
  const goalMeta = GOAL_STATUS_META[goalStatus];
  const isPositive = goalStatus === 'reached' || goalStatus === 'on-track';

  // Rate calculations
  const daysElapsed = Math.max(1, elapsedMs / (1000 * 60 * 60 * 24));
  const activeRate = projectedOverride !== undefined ? null : activeAchieved / daysElapsed;
  const daysRemaining = Math.max(1, diffMs / (1000 * 60 * 60 * 24));
  const remaining = target - activeAchieved;
  const requiredRate = remaining / daysRemaining;
  const rateRatio = activeRate !== null && activeRate > 0 ? requiredRate / activeRate : null;

  const TrendIcon = isPositive || goalStatus === 'very-close' ? TrendingUp : TrendingDown;

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Projection card — styled using the graduated goal status */}
      <div
        className="rounded-xl border p-4 transition-colors"
        style={{
          backgroundColor: goalMeta.bgColor,
          borderColor: goalMeta.color + '30',
        }}
      >
        {/* Scenario builder — cumulative step-selector */}
        {hasScenarios && (
          <div className="mb-3 pb-3 border-b" style={{ borderColor: goalMeta.color + '20' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <GitPullRequestArrow className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Scenariebygger
                </span>
                <InfoTooltip
                  title="Byg dit scenarie — hvad nu hvis?"
                  content={
                    <>
                      <p>Projekter gennemgår en lang pipeline: <strong>skitse → forundersøgelse → godkendelse → anlæg</strong>. Kun anlagte (fysisk gennemførte) projekter tæller i standardvisningen.</p>
                      <p>Men der ligger allerede mange projekter klar i pipelinen. Brug scenariebyggeren til at simulere: <em>hvad nu hvis</em> projekter i tidligere faser også blev realiseret?</p>
                      <p>Prognosen opdateres automatisk — du kan se både det umiddelbare løft og den fremskrevne effekt ved deadline.</p>
                      <p><strong>Vigtigt:</strong> Der forventes en <em>naturlig acceleration</em> efterhånden som de mange godkendte og forundersøgte projekter modnes. Det er ikke et spørgsmål om <em>om</em> projekterne kommer, men <em>hvornår</em>.</p>
                    </>
                  }
                  size={11}
                  side="bottom"
                />
              </div>
              {pillarLabel && pillarColor ? (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: pillarColor + '18', color: pillarColor }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pillarColor }} />
                  {pillarLabel}
                </span>
              ) : (
                <span className="text-[9px] italic text-muted-foreground/60">Hvad nu hvis?</span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">
              Vælg hvilke projektstadier der medregnes i prognosen:
            </p>
            <div className="grid grid-cols-4 gap-1">
              {SCENARIO_OPTIONS.map((opt) => {
                const isActive = !opt.disabled && opt.rank <= selectedOption.rank;
                return (
                  <button
                    key={opt.key}
                    disabled={opt.disabled}
                    onClick={() => { if (!opt.disabled) setSelectedScenario(opt.key); }}
                    title={opt.description}
                    className={`flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg border text-[10px] leading-tight transition-all ${
                      opt.disabled
                        ? 'opacity-30 cursor-not-allowed border-border/30 text-muted-foreground'
                        : isActive
                          ? 'font-medium cursor-pointer'
                          : 'border-border/50 bg-background/40 text-muted-foreground hover:bg-background/60 cursor-pointer'
                    }`}
                    style={isActive && !opt.disabled ? {
                      backgroundColor: (accentColor ?? goalMeta.color) + '18',
                      borderColor: accentColor ?? goalMeta.color,
                      color: accentColor ?? goalMeta.color,
                    } : {}}
                  >
                    <opt.icon className="w-3.5 h-3.5 mb-0.5" />
                    <span className="text-center">{opt.shortLabel}</span>
                    {opt.disabled && (
                      <span className="text-[9px] opacity-60 mt-0.5">ingen data</span>
                    )}
                  </button>
                );
              })}
            </div>
            {isOptimistic && scenarioDelta > 0 && (
              <p className="mt-2 text-[10px]">
                <span className="font-semibold" style={{ color: accentColor ?? goalMeta.color }}>
                  +{formatDanishNumber(scenarioDelta, 1)} {unit}
                </span>
                <span className="text-muted-foreground">
                  {' '}ekstra ved at medregne {selectedOption.bodyLabel} projekter
                </span>
              </p>
            )}
          </div>
        )}

        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: goalMeta.color + '20' }}
          >
            <TrendIcon className="w-4.5 h-4.5" style={{ color: goalMeta.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold mb-0.5" style={{ color: goalMeta.color }}>
              {isOptimistic ? `Hvad nu hvis: ${goalMeta.label.toLowerCase()}` : goalMeta.label}
            </p>
            <p className="text-xs leading-relaxed text-foreground/70">
              {isOptimistic ? (
                <>
                  Hvis alle {selectedOption.bodyLabel} projekter var anlagt i dag, ville vi stå ved <strong>{formatDanishNumber(activeAchieved, 1)} {unit}</strong> nu — og prognosen ville vise <strong>{formatDanishNumber(activeProjectedTotal, 1)} {unit}</strong> ved deadline ({Math.round(activeProjectedPct)}% af målet).
                  {rateRatio !== null && !isPositive && (
                    <> Det kræver stadig <strong>{rateRatio.toFixed(1)}x</strong> hurtigere tempo.</>
                  )}
                </>
              ) : (
                <>
                  Prognosen viser <strong>{formatDanishNumber(activeProjectedTotal, 1)} {unit}</strong> ved deadline ({Math.round(activeProjectedPct)}% af målet).
                  {rateRatio !== null && !isPositive && (
                    <> Vi skal <strong>{rateRatio.toFixed(1)}x</strong> hurtigere for at nå {formatDanishNumber(target)} {unit}.</>
                  )}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Visual projection bar */}
        <div className="mt-3.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>0 {unit}</span>
            <span className="flex items-center gap-1">
              <Target className="w-2.5 h-2.5" />
              {formatDanishNumber(target)} {unit}
            </span>
          </div>
          <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
            {/* Projected (ghost bar) */}
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(activeProjectedPct, 100)}%`,
                backgroundColor: goalMeta.color + '40',
              }}
            />
            {/* Actual / scenario achieved */}
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(activeActualPct, 100)}%`,
                backgroundColor: accentColor ?? goalMeta.color,
              }}
            />
            {/* Goal marker */}
            <div className="absolute inset-y-0 right-0 w-0.5 bg-foreground/20" />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor ?? goalMeta.color }} />
                <span className="text-muted-foreground">
                  {isOptimistic ? `Scenarie — ${selectedOption.bodyLabel}` : 'Nu'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: goalMeta.color + '40' }} />
                <span className="text-muted-foreground">Prognose {deadlineDate.getFullYear()}</span>
              </div>
            </div>
            {activeRate !== null && (
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                {formatDanishNumber(activeRate, 1)} {unit}/dag
              </span>
            )}
          </div>
        </div>

        {/* Pipeline context note */}
        {isOptimistic && (
          <p className="mt-3 text-[10px] text-muted-foreground/80 leading-relaxed italic">
            Bemærk: Projekter gennemgår en pipeline fra skitse → forundersøgelse → godkendelse → anlæg. Der forventes en naturlig acceleration efterhånden som flere projekter modnes.
          </p>
        )}
      </div>
    </div>
  );
}
