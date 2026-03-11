import { X, Droplets, MapPin, Hammer, TrendingUp, PieChart, ExternalLink } from 'lucide-react';
import { formatDanishNumber, getProgressColor } from '@/lib/format';
import type { Plan, Catchment, ProjectCounts, DashboardData } from '@/lib/types';

interface DetailPanelProps {
  plan?: Plan;
  catchment?: Catchment;
  nationalData?: DashboardData['national'];
  onClose: () => void;
}

export function DetailPanel({ plan, catchment, nationalData, onClose }: DetailPanelProps) {
  const name = plan?.name || catchment?.name || '';
  const nitrogenAchieved = plan?.nitrogenAchievedT ?? catchment?.nitrogenAchievedT ?? 0;
  const nitrogenGoal = plan?.nitrogenGoalT ?? 0;
  const nitrogenPct = plan?.nitrogenProgressPct ?? 0;
  const extractionAchieved = plan?.extractionAchievedHa ?? catchment?.extractionAchievedHa ?? 0;
  const extractionPotential = plan?.extractionPotentialHa ?? 0;
  const projects: ProjectCounts = plan?.projects ?? catchment?.projects ?? { sketches: 0, assessed: 0, approved: 0, established: 0 };
  const totalProjects = projects.sketches + projects.assessed + projects.approved + projects.established;

  // National comparison
  const natTargetT = nationalData?.targets.nitrogenReductionT ?? 0;
  const natAchievedT = nationalData?.progress.nitrogenAchievedT ?? 0;
  const natPct = nationalData?.progress.nitrogenProgressPct ?? 0;
  const shareOfNationalGoal = natTargetT > 0 && nitrogenGoal > 0 ? (nitrogenGoal / natTargetT) * 100 : 0;
  const shareOfNationalAchieved = natAchievedT > 0 ? (nitrogenAchieved / natAchievedT) * 100 : 0;

  const stages = [
    { label: 'Skitser', count: projects.sketches, color: 'hsl(150 20% 78%)' },
    { label: 'Vurderet', count: projects.assessed, color: 'hsl(152 30% 60%)' },
    { label: 'Godkendt', count: projects.approved, color: 'hsl(152 44% 45%)' },
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

      {/* Nitrogen */}
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

      {/* National comparison */}
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

      {/* Extraction */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4 text-nature-earth" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Udtagning</h3>
        </div>
        {extractionPotential > 0 ? (
          <>
            <p className="text-sm text-foreground mb-1.5">
              {formatDanishNumber(extractionAchieved, 1)} af {formatDanishNumber(extractionPotential, 1)} ha
            </p>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min((extractionAchieved / extractionPotential) * 100, 100)}%`,
                  background: 'linear-gradient(90deg, hsl(30 35% 45%), hsl(38 50% 55%))',
                }}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-foreground">
            {formatDanishNumber(extractionAchieved, 1)} ha udtaget
          </p>
        )}
      </div>

      {/* Projects pipeline */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Hammer className="w-4 h-4 text-nature-sky" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projekter</h3>
          </div>
          <span className="text-xs text-muted-foreground">{formatDanishNumber(totalProjects)} i alt</span>
        </div>

        {/* Mini funnel */}
        <div className="space-y-2">
          {stages.map((stage) => {
            const barPct = totalProjects > 0 ? Math.max((stage.count / Math.max(...stages.map(s => s.count), 1)) * 100, 3) : 0;
            return (
              <div key={stage.label} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-16 text-right flex-shrink-0">{stage.label}</span>
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${barPct}%`, backgroundColor: stage.color }}
                  />
                </div>
                <span className="text-xs font-semibold text-foreground tabular-nums w-10 text-right">
                  {formatDanishNumber(stage.count)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data source note */}
      <div className="pt-4 mt-4 border-t border-border">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <PieChart className="w-3 h-3" />
          <span>
            Data fra{' '}
            <a
              href="https://mars.mst.dk"
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
