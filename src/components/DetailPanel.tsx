import { useState } from 'react';
import { X, Droplets, MapPin, Hammer, TrendingUp, PieChart, ExternalLink, Trees, Leaf, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDanishNumber, getProgressColor, getPillarProgressColor } from '@/lib/format';
import { usePillar } from '@/lib/pillars';
import { ProjectList } from './ProjectList';
import { CO2Section } from './CO2Section';
import type { Plan, Catchment, ProjectCounts, DashboardData } from '@/lib/types';

interface DetailPanelProps {
  plan?: Plan;
  catchment?: Catchment;
  nationalData?: DashboardData['national'];
  onClose: () => void;
}

export function DetailPanel({ plan, catchment, nationalData, onClose }: DetailPanelProps) {
  const { activePillar, config: pillarConfig } = usePillar();
  const [showProjects, setShowProjects] = useState(false);
  const name = plan?.name || catchment?.name || '';
  const projects: ProjectCounts = plan?.projects ?? catchment?.projects ?? { sketches: 0, assessed: 0, approved: 0, established: 0 };
  const totalProjects = projects.sketches + projects.assessed + projects.approved + projects.established;
  const hasProjectDetails = plan && ((plan.projectDetails?.length ?? 0) + (plan.sketchProjects?.length ?? 0) + (plan.naturePotentials?.length ?? 0)) > 0;

  const stages = [
    { label: 'Skitser', count: projects.sketches, color: 'hsl(35 50% 75%)' },
    { label: 'Forundersøgelse', count: projects.assessed, color: 'hsl(45 60% 60%)' },
    { label: 'Godkendt', count: projects.approved, color: 'hsl(80 40% 55%)' },
    { label: 'Anlagt', count: projects.established, color: 'hsl(95 55% 48%)' },
  ];

  return (
    <div className="bg-background border-l border-border h-full overflow-y-auto p-6 relative">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label="Luk"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>

      <h2
        className="text-lg font-bold text-foreground pr-8 mb-1"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {name}
      </h2>
      {plan?.status && (
        <span className="inline-flex items-center text-[11px] font-medium rounded-full bg-primary/10 text-primary px-2.5 py-0.5 mb-5">
          {plan.status}
        </span>
      )}
      <div
        className="inline-flex items-center text-[11px] font-medium rounded-full px-2.5 py-0.5 mb-5 ml-2"
        style={{ color: pillarConfig.accentColor, backgroundColor: pillarConfig.accentColor + '15' }}
      >
        {pillarConfig.label}
      </div>

      {/* Nitrogen section */}
      {activePillar === 'nitrogen' && (
        <NitrogenSection plan={plan} catchment={catchment} nationalData={nationalData} />
      )}

      {/* Extraction section */}
      {activePillar === 'extraction' && (
        <ExtractionSection plan={plan} catchment={catchment} />
      )}

      {/* Afforestation section */}
      {activePillar === 'afforestation' && (
        <AfforestationSection plan={plan} catchment={catchment} />
      )}

      {/* Nature section */}
      {activePillar === 'nature' && (
        <NatureSection plan={plan} catchment={catchment} />
      )}

      {/* CO₂ national emissions section */}
      {activePillar === 'co2' && <CO2Section />}

      {/* Projects pipeline — stacked bar showing stage breakdown */}
      {pillarConfig.hasData && totalProjects > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Hammer className="w-4 h-4 text-nature-sky" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projekter</h3>
            </div>
            <span className="text-xs text-muted-foreground">{formatDanishNumber(totalProjects)} i alt</span>
          </div>

          {/* Implementation percentage: only "Anlagt" counts as done */}
          <div className="flex items-baseline justify-between mb-1.5">
            <span
              className="text-xl font-bold"
              style={{
                fontFamily: "'Fraunces', serif",
                color: projects.established > 0 ? 'hsl(95 55% 48%)' : 'hsl(0 0% 60%)',
              }}
            >
              {totalProjects > 0 ? ((projects.established / totalProjects) * 100).toFixed(1) : 0}%
            </span>
            <span className="text-[11px] text-muted-foreground">
              {formatDanishNumber(projects.established)} af {formatDanishNumber(totalProjects)} anlagt
            </span>
          </div>

          {/* Stacked progress bar */}
          <div className="h-4 w-full rounded-full bg-muted overflow-hidden flex">
            {stages.map((stage) => {
              const segmentPct = totalProjects > 0 ? (stage.count / totalProjects) * 100 : 0;
              if (segmentPct === 0) return null;
              return (
                <div
                  key={stage.label}
                  className="h-full transition-all first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${segmentPct}%`, backgroundColor: stage.color }}
                  title={`${stage.label}: ${formatDanishNumber(stage.count)}`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {stages.map((stage) => (
              stage.count > 0 && (
                <div key={stage.label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: stage.color }} />
                  <span className="text-[10px] text-muted-foreground">
                    {stage.label} <span className="font-semibold text-foreground">{formatDanishNumber(stage.count)}</span>
                  </span>
                </div>
              )
            ))}
          </div>

          {/* Toggle to show individual projects */}
          {hasProjectDetails && (
            <button
              onClick={() => setShowProjects(!showProjects)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-[11px] font-medium text-primary"
            >
              {showProjects ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Skjul projektdetaljer
                </>
              ) : (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  Vis alle {formatDanishNumber(totalProjects)} projekter
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Project drill-down — expandable list of individual projects */}
      {plan && showProjects && (
        <ProjectList
          projectDetails={plan.projectDetails ?? []}
          sketchProjects={plan.sketchProjects ?? []}
          naturePotentials={plan.naturePotentials ?? []}
          activePillar={activePillar}
        />
      )}

      {/* Data source note */}
      <div className="pt-4 mt-4 border-t border-border">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <PieChart className="w-3 h-3" />
          <span>
            Data fra{' '}
            <a
              href="https://mars.sgav.dk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30"
            >
              MARS <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}

function NitrogenSection({ plan, catchment, nationalData }: { plan?: Plan; catchment?: Catchment; nationalData?: DashboardData['national'] }) {
  const nitrogenAchieved = plan?.nitrogenAchievedT ?? catchment?.nitrogenAchievedT ?? 0;
  const nitrogenGoal = plan?.nitrogenGoalT ?? 0;
  const nitrogenPct = plan?.nitrogenProgressPct ?? 0;
  const natTargetT = nationalData?.targets.nitrogenReductionT ?? 0;
  const natAchievedT = nationalData?.progress.nitrogenAchievedT ?? 0;
  const natPct = nationalData?.progress.nitrogenProgressPct ?? 0;
  const shareOfNationalGoal = natTargetT > 0 && nitrogenGoal > 0 ? (nitrogenGoal / natTargetT) * 100 : 0;
  const shareOfNationalAchieved = natAchievedT > 0 ? (nitrogenAchieved / natAchievedT) * 100 : 0;

  return (
    <>
      <div className="mb-5 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Droplets className="w-4 h-4 text-nature-water" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kvælstofreduktion</h3>
        </div>
        {nitrogenGoal > 0 ? (
          <>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-2xl font-bold" style={{ fontFamily: "'Fraunces', serif", color: getProgressColor(nitrogenPct) }}>
                {Math.round(nitrogenPct)}%
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDanishNumber(nitrogenAchieved, 1)} / {formatDanishNumber(nitrogenGoal, 1)} ton
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(nitrogenPct, 100)}%`,
                  background: 'linear-gradient(90deg, hsl(152 44% 38%), hsl(95 55% 48%))',
                }}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-foreground">
            {formatDanishNumber(nitrogenAchieved, 1)} ton reduceret
            <span className="text-muted-foreground ml-1">(intet mål sat)</span>
          </p>
        )}
      </div>

      {nationalData && (nitrogenGoal > 0 || nitrogenAchieved > 0) && (
        <div className="mb-5 p-3.5 rounded-lg bg-muted/40 border border-border/50">
          <div className="flex items-center gap-1.5 mb-2.5">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sammenligning med nationalt
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            {shareOfNationalGoal > 0 && (
              <div>
                <p className="text-lg font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
                  {shareOfNationalGoal.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">af nationalt mål</p>
              </div>
            )}
            <div>
              <p className="text-lg font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
                {shareOfNationalAchieved.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">af national reduktion</p>
            </div>
            {nitrogenPct > 0 && (
              <div className="col-span-2">
                <div className="flex items-center justify-center gap-2 text-xs">
                  <span className="text-muted-foreground">Landsgennemsnit:</span>
                  <span className="font-semibold" style={{ color: getProgressColor(natPct) }}>
                    {Math.round(natPct)}%
                  </span>
                  <span className="text-muted-foreground">vs. denne plan:</span>
                  <span className="font-semibold" style={{ color: getProgressColor(nitrogenPct) }}>
                    {Math.round(nitrogenPct)}%
                  </span>
                  {nitrogenPct > natPct ? (
                    <span className="text-[10px] text-green-600 font-medium">▲ over</span>
                  ) : (
                    <span className="text-[10px] text-red-500 font-medium">▼ under</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ExtractionSection({ plan, catchment }: { plan?: Plan; catchment?: Catchment }) {
  const achieved = plan?.extractionAchievedHa ?? catchment?.extractionAchievedHa ?? 0;
  const potential = plan?.extractionPotentialHa ?? 0;

  return (
    <div className="mb-5 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-4 h-4 text-nature-earth" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Udtagning af lavbundsarealer</h3>
      </div>
      {potential > 0 ? (
        <>
          <p className="text-sm text-foreground mb-1.5">
            {formatDanishNumber(achieved, 1)} af {formatDanishNumber(potential, 1)} ha
          </p>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min((achieved / potential) * 100, 100)}%`,
                background: 'linear-gradient(90deg, hsl(30 35% 45%), hsl(38 50% 55%))',
              }}
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-foreground">
          {formatDanishNumber(achieved, 1)} ha udtaget
        </p>
      )}
    </div>
  );
}

function AfforestationSection({ plan, catchment }: { plan?: Plan; catchment?: Catchment }) {
  const achieved = plan?.afforestationAchievedHa ?? catchment?.afforestationAchievedHa ?? 0;

  return (
    <div className="mb-5 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Trees className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skovrejsning</h3>
      </div>
      <p className="text-sm text-foreground">
        {formatDanishNumber(achieved, 1)} ha skovrejst
      </p>
      {achieved === 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          Begrænset geografisk data — de fleste oplande har endnu ingen registreret skovrejsning
        </p>
      )}
    </div>
  );
}

/**
 * Nature detail section for the map panel. Shows nature restoration
 * potentials (MARS-identified candidate sites) and explains the
 * distinction from legally protected area and the project pipeline.
 *
 * @param plan - Plan data (coastal water group), if available
 * @param catchment - Catchment data, if available
 */
function NatureSection({ plan, catchment }: { plan?: Plan; catchment?: Catchment }) {
  const potentialHa = plan?.naturePotentialAreaHa ?? catchment?.naturePotentialAreaHa ?? 0;
  const count = plan?.countNaturePotentials ?? catchment?.countNaturePotentials ?? 0;

  return (
    <div className="mb-5 mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <Leaf className="w-4 h-4" style={{ color: '#166534' }} />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Naturgenopretningspotentiale</h3>
      </div>

      <div>
        <p className="text-sm text-foreground font-medium">
          {formatDanishNumber(potentialHa, 0)} ha identificeret
        </p>
        {count > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Fordelt på {formatDanishNumber(count)} potentielle genopretningssteder
          </p>
        )}
      </div>

      <div className="rounded-lg bg-muted/40 p-2.5 space-y-1.5">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong>Naturpotentialer</strong> er arealer i MARS identificeret som mulige genopretningssteder — de er ikke endnu juridisk beskyttede.
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong>Projekterne nedenfor</strong> dækker alle typer virkemidler (kvælstof, lavbund, skovrejsning m.fl.) i dette område — ikke kun naturprojekter. Nogle projekter kan adressere de identificerede naturpotentialer.
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed italic">
          Målet om 20% beskyttet natur nås via juridisk udpegning (Natura 2000, §3, naturnationalparker) — ikke direkte via disse potentialer.
        </p>
      </div>
    </div>
  );
}
