import { X, Droplets, MapPin, Hammer } from 'lucide-react';
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
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label="Luk"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>

      <h2
        className="text-lg font-bold text-foreground pr-8 mb-6"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {name}
      </h2>

      {/* Nitrogen */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Droplets className="w-4 h-4 text-nature-water" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kvælstofreduktion</h3>
        </div>
        {nitrogenGoal > 0 ? (
          <>
            <p className="text-sm text-foreground mb-2">
              {formatDanishNumber(nitrogenAchieved, 1)} af {formatDanishNumber(nitrogenGoal, 1)} ton ({Math.round(nitrogenPct)}%)
            </p>
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
            {nitrogenGoal === 0 && <span className="text-muted-foreground ml-1">(intet mål sat)</span>}
          </p>
        )}
      </div>

      {/* Extraction */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4 text-nature-earth" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Udtagning</h3>
        </div>
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
        <div className="flex items-center gap-2 mb-3">
          <Hammer className="w-4 h-4 text-nature-sky" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projekter</h3>
        </div>
        <div className="space-y-2.5">
          {[
            { label: 'Skitser', count: projects.sketches, color: 'hsl(150 20% 78%)' },
            { label: 'Vurderet', count: projects.assessed, color: 'hsl(152 30% 60%)' },
            { label: 'Godkendt', count: projects.approved, color: 'hsl(152 44% 45%)' },
            { label: 'Anlagt', count: projects.established, color: 'hsl(95 55% 48%)' },
          ].map((stage) => (
            <div key={stage.label} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="text-muted-foreground">{stage.label}</span>
              </div>
              <span className="text-foreground font-semibold">{formatDanishNumber(stage.count)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
