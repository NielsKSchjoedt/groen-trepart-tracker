import { X, Droplets, Trees, Mountain, Leaf, ExternalLink } from 'lucide-react';
import type { KommuneMetrics, ProjectDetail, KlimaskovfondenProject, NaturstyrelsenSkovProject } from '@/lib/types';
import { formatDanishNumber } from '@/lib/format';
import { getPhaseConfig, STAGE_TO_PHASE } from '@/lib/phase-config';

interface KommuneDetailPanelProps {
  kommune: KommuneMetrics;
  /** MARS projects in this municipality filtered from the plan data */
  projectDetails: ProjectDetail[];
  /** KSF projects in this municipality */
  ksfProjects: KlimaskovfondenProject[];
  /** NST projects in this municipality */
  nstProjects: NaturstyrelsenSkovProject[];
  onClose: () => void;
}

/**
 * Detail panel for a selected Danish municipality.
 *
 * Shows:
 *   - 2×2 metric grid (nitrogen, extraction, afforestation, nature)
 *   - Phase distribution bar
 *   - MARS project list with phase badges
 *   - Supplementary sources: KSF and NST projects if present
 *
 * Used in two contexts:
 *   - Desktop: rendered in a right-side panel column (caller handles layout)
 *   - Mobile: rendered inside MobileBottomSheet (caller handles wrapping)
 *
 * @param kommune        - Aggregated metrics for the selected municipality
 * @param projectDetails - MARS projects located in this municipality
 * @param ksfProjects    - Klimaskovfonden projects in this municipality
 * @param nstProjects    - Naturstyrelsen projects in this municipality
 * @param onClose        - Called when the close button is pressed
 *
 * @example
 *   <KommuneDetailPanel
 *     kommune={odense}
 *     projectDetails={marsProjects.filter(p => p.kommuneKode === '0461')}
 *     ksfProjects={ksfProjects.filter(p => p.kommune === 'Odense')}
 *     nstProjects={nstProjects.filter(p => p.kommune === 'Odense')}
 *     onClose={closeDetail}
 *   />
 */
export function KommuneDetailPanel({
  kommune,
  projectDetails,
  ksfProjects,
  nstProjects,
  onClose,
}: KommuneDetailPanelProps) {
  const totalAffTotal = kommune.afforestationTotalHa;
  const ksfTotal = ksfProjects.reduce((s, p) => s + (p.areaHa || 0), 0);
  const nstTotal = nstProjects.reduce((s, p) => s + (p.areaHa || 0), 0);

  const phases = [
    { key: 'established', config: getPhaseConfig('established'), count: kommune.projectsByPhase.established },
    { key: 'approved',    config: getPhaseConfig('approved'),    count: kommune.projectsByPhase.approved    },
    { key: 'assessed',    config: getPhaseConfig('assessed'),    count: kommune.projectsByPhase.assessed    },
    { key: 'sketches',    config: getPhaseConfig('sketches'),    count: kommune.projectsByPhase.sketches    },
  ];
  const hasPhases = phases.some((p) => p.count > 0);

  return (
    <div className="bg-background border-l border-border h-full overflow-y-auto p-5 relative">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted transition-colors"
        aria-label="Luk"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Header */}
      <h2
        className="text-lg font-bold text-foreground pr-8 mb-0.5"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {kommune.navn}
      </h2>
      <p className="text-xs text-muted-foreground mb-5">
        {kommune.region} · {kommune.projectCount} MARS-projekt{kommune.projectCount !== 1 ? 'er' : ''}
      </p>

      {/* 2×2 metric grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <MetricCard
          icon={<Droplets className="w-4 h-4 text-teal-600" />}
          label="Kvælstof"
          value={kommune.nitrogenT}
          unit="ton N"
          color="teal"
        />
        <MetricCard
          icon={<Mountain className="w-4 h-4 text-amber-700" />}
          label="Udtagning"
          value={kommune.extractionHa}
          unit="ha"
          color="amber"
        />
        <MetricCard
          icon={<Trees className="w-4 h-4 text-green-700" />}
          label="Skovrejsning"
          value={totalAffTotal}
          unit="ha"
          color="green"
          sub={totalAffTotal > 0 ? [
            kommune.afforestationMarsHa > 0 && `MARS ${formatDanishNumber(Math.round(kommune.afforestationMarsHa))} ha`,
            ksfTotal > 0 && `KSF ${formatDanishNumber(Math.round(ksfTotal))} ha`,
            nstTotal > 0 && `NST ${formatDanishNumber(Math.round(nstTotal))} ha`,
          ].filter(Boolean).join(' · ') : undefined}
        />
        <MetricCard
          icon={<Leaf className="w-4 h-4 text-emerald-600" />}
          label="Naturpotentiale"
          value={kommune.naturePotentialHa}
          unit="ha"
          color="emerald"
          noDataText="Ikke opdelt per kommune"
        />
      </div>

      {/* Phase distribution */}
      {hasPhases && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Projektfaser
          </p>
          <div className="flex flex-wrap gap-2">
            {phases.filter((p) => p.count > 0).map(({ key, config, count }) => (
              <span
                key={key}
                className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-0.5 ${config.badge}`}
              >
                {config.label}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* MARS project list */}
      {projectDetails.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            MARS-projekter ({projectDetails.length})
          </p>
          <ul className="space-y-2">
            {projectDetails.slice(0, 20).map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
            {projectDetails.length > 20 && (
              <li className="text-xs text-muted-foreground pl-1">
                + {projectDetails.length - 20} projekter mere…
              </li>
            )}
          </ul>
        </div>
      )}

      {/* KSF projects */}
      {ksfProjects.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Klimaskovfonden ({ksfProjects.length} projekter)
          </p>
          <ul className="space-y-1.5">
            {ksfProjects.map((p) => (
              <li key={p.sagsnummer} className="flex items-center justify-between text-xs gap-2">
                <span className="text-foreground/80 truncate">
                  {p.sagsnummer} · {p.projekttyp}
                </span>
                <span className="text-muted-foreground flex-shrink-0">
                  {p.areaHa < 10 ? p.areaHa.toFixed(1).replace('.', ',') : Math.round(p.areaHa).toLocaleString('da-DK')} ha
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* NST projects */}
      {nstProjects.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Naturstyrelsen ({nstProjects.length} projekter)
          </p>
          <ul className="space-y-1.5">
            {nstProjects.map((p) => (
              <li key={p.name} className="flex items-start justify-between text-xs gap-2">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/80 hover:text-primary flex items-center gap-1 min-w-0 truncate"
                >
                  {p.name}
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
                <span className="text-muted-foreground flex-shrink-0">
                  {p.areaHa ? `${Math.round(p.areaHa).toLocaleString('da-DK')} ha` : '?'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {projectDetails.length === 0 && ksfProjects.length === 0 && nstProjects.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          Ingen registrerede projekter i denne kommune endnu.
        </p>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  color: string;
  sub?: string;
  noDataText?: string;
}

function MetricCard({ icon, label, value, unit, sub, noDataText }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      {value > 0 ? (
        <>
          <p className="text-lg font-bold text-foreground tabular-nums leading-tight">
            {formatDanishNumber(Math.round(value * 10) / 10)}
            <span className="text-xs font-normal text-muted-foreground ml-1">{unit}</span>
          </p>
          {sub && (
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{sub}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          {noDataText ?? '—'}
        </p>
      )}
    </div>
  );
}

function ProjectRow({ project }: { project: ProjectDetail }) {
  const pc = getPhaseConfig(project.phase);
  const phaseLabel = pc.label;
  const phaseColor = pc.badge;

  const metrics = [
    project.nitrogenT > 0 && `${formatDanishNumber(project.nitrogenT)} T N`,
    project.extractionHa > 0 && `${formatDanishNumber(Math.round(project.extractionHa))} ha udtagning`,
    project.afforestationHa > 0 && `${formatDanishNumber(Math.round(project.afforestationHa))} ha skov`,
  ].filter(Boolean).join(' · ');

  return (
    <li className="rounded-lg border border-border/60 bg-card/60 p-2.5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-foreground leading-snug min-w-0 truncate">
          {project.name}
        </span>
        <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 flex-shrink-0 ${phaseColor}`}>
          {phaseLabel}
        </span>
      </div>
      {project.measureName && (
        <p className="text-[10px] text-muted-foreground">{project.measureName}</p>
      )}
      {metrics && (
        <p className="text-[10px] text-muted-foreground mt-0.5">{metrics}</p>
      )}
    </li>
  );
}
