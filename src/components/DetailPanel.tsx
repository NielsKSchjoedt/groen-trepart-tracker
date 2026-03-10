import { X } from 'lucide-react';
import { formatDanishNumber } from '@/lib/format';
import type { Plan, Catchment, ProjectCounts } from '@/lib/types';

interface DetailPanelProps {
  plan?: Plan;
  catchment?: Catchment;
  onClose: () => void;
}

export function DetailPanel({ plan, catchment, onClose }: DetailPanelProps) {
  const name = plan?.name || catchment?.name || '';
  const nitrogenAchieved = plan?.nitrogenAchievedT ?? catchment?.nitrogenAchievedT ?? 0;
  const nitrogenGoal = plan?.nitrogenGoalT ?? 0;
  const nitrogenPct = plan?.nitrogenProgressPct ?? 0;
  const extractionAchieved = plan?.extractionAchievedHa ?? catchment?.extractionAchievedHa ?? 0;
  const extractionPotential = plan?.extractionPotentialHa ?? 0;
  const projects: ProjectCounts = plan?.projects ?? catchment?.projects ?? { sketches: 0, assessed: 0, approved: 0, established: 0 };

  return (
    <div className="bg-background border-l border-border h-full overflow-y-auto p-6 relative">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-muted transition-colors"
        aria-label="Luk"
      >
        <X className="w-5 h-5 text-muted-foreground" />
      </button>

      <h2 className="text-xl font-semibold text-foreground pr-8 mb-6" style={{ fontFamily: "'Public Sans', sans-serif" }}>
        {name}
      </h2>

      {/* Nitrogen */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Kvælstofreduktion</h3>
        {nitrogenGoal > 0 ? (
          <>
            <p className="text-sm text-foreground mb-2">
              {formatDanishNumber(nitrogenAchieved, 1)} af {formatDanishNumber(nitrogenGoal, 1)} ton ({Math.round(nitrogenPct)}%)
            </p>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(nitrogenPct, 100)}%`,
                  backgroundColor: 'hsl(210 100% 52%)',
                }}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-foreground">
            {formatDanishNumber(nitrogenAchieved, 1)} ton reduceret
            {nitrogenGoal === 0 && <span className="text-muted-foreground ml-1">(intet mål sat)</span>}
          </p>
        )}
      </div>

      {/* Extraction */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Udtagning</h3>
        {extractionPotential > 0 ? (
          <p className="text-sm text-foreground">
            {formatDanishNumber(extractionAchieved, 1)} af {formatDanishNumber(extractionPotential, 1)} ha
          </p>
        ) : (
          <p className="text-sm text-foreground">
            {formatDanishNumber(extractionAchieved, 1)} ha udtaget
          </p>
        )}
      </div>

      {/* Projects pipeline */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Projekter</h3>
        <div className="space-y-2">
          {[
            { label: 'Skitser', count: projects.sketches, color: 'hsl(210 40% 78%)' },
            { label: 'Vurderet', count: projects.assessed, color: 'hsl(210 60% 60%)' },
            { label: 'Godkendt', count: projects.approved, color: 'hsl(210 80% 45%)' },
            { label: 'Anlagt', count: projects.established, color: 'hsl(142 71% 45%)' },
          ].map((stage) => (
            <div key={stage.label} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: stage.color }} />
                <span className="text-muted-foreground">{stage.label}</span>
              </div>
              <span className="text-foreground font-medium">{formatDanishNumber(stage.count)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
