import { useState } from 'react';
import { Calendar, Droplets, ExternalLink, Info, Mountain, Trees, X } from 'lucide-react';
import { formatDanishNumber } from '@/lib/format';
import type { ProjectDetail, ProjectNatureOverlap, SketchProject, SubsidyScheme } from '@/lib/types';
import { getPhaseConfig, type ProjectPhase } from '@/lib/phase-config';
import { getProjectFilterPhase } from '@/lib/map-projects';
import { ProjectMiniMap } from '@/components/ProjectMiniMap';
import { ProjectNatureOverlapBlock } from '@/components/ProjectNatureOverlapBlock';

export type MarsDetailVariant = 'inline' | 'modal' | 'panel';

export interface MarsProjectDetailContentProps {
  project: ProjectDetail | SketchProject;
  planName?: string;
  featureName?: string;
  variant: MarsDetailVariant;
  scheme?: SubsidyScheme;
  coordinates?: [number, number][] | null;
  natureOverlap?: ProjectNatureOverlap | null;
  showNatureOverlap?: boolean;
  showSourceBadge?: boolean;
  showMarsFooter?: boolean;
  /** When true, title and source badges are omitted (rendered in MarsProjectStickyHeader). */
  hideHeader?: boolean;
  onMiniMapClick?: () => void;
  miniMapHeight?: number;
}

const MARS_COLOR = { text: '#0f766e', bg: '#0f766e18' };

function formatProjectDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

function phaseBadgeVariant(phaseId: ProjectPhase): 'slate' | 'amber' | 'blue' | 'green' {
  if (phaseId === 'established') return 'green';
  if (phaseId === 'approved') return 'blue';
  if (phaseId === 'preliminary') return 'amber';
  return 'slate';
}

function StatusBadge({ label, variant }: { label: string; variant: 'green' | 'blue' | 'amber' | 'gray' | 'slate' }) {
  const colors = {
    green: { color: '#15803d', bg: '#15803d15' },
    blue: { color: '#1e40af', bg: '#1e40af15' },
    amber: { color: '#92400e', bg: '#92400e15' },
    gray: { color: '#525252', bg: '#52525215' },
    slate: { color: '#475569', bg: '#47556915' },
  };
  const c = colors[variant];
  return (
    <span
      className="inline-flex items-center text-[11px] font-semibold rounded-full px-2.5 py-0.5"
      style={{ color: c.color, backgroundColor: c.bg }}
    >
      {label}
    </span>
  );
}

/** Sticky title + MARS/status badges for scrollable panel and modal shells. */
export function MarsProjectStickyHeader({
  project,
  planName,
  variant,
  onClose,
}: {
  project: ProjectDetail | SketchProject;
  planName?: string;
  variant: 'panel' | 'modal';
  onClose?: () => void;
}) {
  const phase = getPhaseConfig(getProjectFilterPhase(project));
  const detail = project as Partial<ProjectDetail>;

  return (
    <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-background/95 px-6 py-4 pr-14 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Luk"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {variant === 'panel' ? (
        <h2
          className="text-lg font-bold text-foreground leading-snug"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {project.name}
        </h2>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${phase.dot}`} />
            <h3
              className="text-base font-bold text-foreground leading-snug"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              {project.name}
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className={phase.text}>{phase.label}</span>
            {project.measureName && <span> · {project.measureName}</span>}
            {planName && <span> · {planName}</span>}
          </p>
        </>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          className="inline-flex items-center text-[11px] font-medium rounded-full px-2.5 py-0.5"
          style={{ color: MARS_COLOR.text, backgroundColor: MARS_COLOR.bg }}
        >
          MARS
        </span>
        <StatusBadge label={detail.statusName || phase.label} variant={phaseBadgeVariant(phase.id)} />
      </div>
    </div>
  );
}

/**
 * Shared field layout for MARS project details — used in map side panel,
 * funnel modal, and geography-table accordion.
 */
export function MarsProjectDetailContent({
  project,
  planName,
  featureName,
  variant,
  scheme,
  coordinates,
  natureOverlap,
  showNatureOverlap = false,
  showSourceBadge = false,
  showMarsFooter = false,
  hideHeader = false,
  onMiniMapClick,
  miniMapHeight,
}: MarsProjectDetailContentProps) {
  const [showSchemeDesc, setShowSchemeDesc] = useState(false);
  const phase = getPhaseConfig(getProjectFilterPhase(project));
  const detail = project as Partial<ProjectDetail>;
  const hasMetrics = project.nitrogenT > 0 || project.extractionHa > 0 || project.afforestationHa > 0;
  const applied = formatProjectDate(detail.appliedAt);
  const changed = formatProjectDate(detail.lastChanged);
  const hasSchemeProse = Boolean(scheme?.description || scheme?.applicantText);

  const textSize = variant === 'inline' ? 'text-[11px]' : 'text-[12px]';
  const mapHeight = miniMapHeight ?? (variant === 'inline' ? 160 : 180);

  return (
    <div className={variant === 'inline' ? 'space-y-2' : 'space-y-3'}>
      {variant === 'modal' && !hideHeader && (
        <>
          <div className="mb-1 flex items-center gap-1.5 pr-8">
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${phase.dot}`} />
            <h3 className="text-base font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
              {project.name}
            </h3>
          </div>
          <p className="mb-1 text-xs text-muted-foreground">
            <span className={phase.text}>{phase.label}</span>
            {project.measureName && <span> · {project.measureName}</span>}
            {planName && <span> · {planName}</span>}
          </p>
        </>
      )}

      {showSourceBadge && !hideHeader && (
        <div className="flex flex-wrap gap-1.5">
          <span
            className="inline-flex items-center text-[11px] font-medium rounded-full px-2.5 py-0.5"
            style={{ color: MARS_COLOR.text, backgroundColor: MARS_COLOR.bg }}
          >
            MARS
          </span>
          <StatusBadge label={detail.statusName || phase.label} variant={phaseBadgeVariant(phase.id)} />
        </div>
      )}

      <div className={`grid grid-cols-2 gap-x-3 gap-y-1.5 ${textSize}`}>
        <div>
          <span className="text-muted-foreground">Status:</span>{' '}
          <span className={`font-medium ${phase.text}`}>{detail.statusName || phase.label}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Type:</span>{' '}
          <span className="font-medium text-foreground">{project.measureName || '—'}</span>
        </div>
        {project.areaHa > 0 && (
          <div>
            <span className="text-muted-foreground">Areal:</span>{' '}
            <span className="font-medium text-foreground">{formatDanishNumber(project.areaHa, 1)} ha</span>
          </div>
        )}
        {planName && (
          <div>
            <span className="text-muted-foreground">Plan:</span>{' '}
            <span className="font-medium text-foreground">{planName}</span>
          </div>
        )}
        {featureName && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Kystvandsopland:</span>{' '}
            <span className="font-medium text-foreground">{featureName}</span>
          </div>
        )}
        {detail.kommuneNavn && (
          <div>
            <span className="text-muted-foreground">Kommune:</span>{' '}
            <span className="font-medium text-foreground">{detail.kommuneNavn}</span>
          </div>
        )}
      </div>

      {hasMetrics && (
        <div className={`flex flex-wrap gap-3 ${textSize}`}>
          {project.nitrogenT > 0 && (
            <div className="flex items-center gap-1">
              <Droplets className="h-3.5 w-3.5 text-nature-water" />
              <span className="text-muted-foreground">N-reduktion:</span>
              <span className="font-semibold text-foreground">{formatDanishNumber(project.nitrogenT, 3)} ton</span>
            </div>
          )}
          {project.extractionHa > 0 && (
            <div className="flex items-center gap-1">
              <Mountain className="h-3.5 w-3.5 text-nature-earth" />
              <span className="text-muted-foreground">Udtaget:</span>
              <span className="font-semibold text-foreground">{formatDanishNumber(project.extractionHa, 1)} ha</span>
            </div>
          )}
          {project.afforestationHa > 0 && (
            <div className="flex items-center gap-1">
              <Trees className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Skov:</span>
              <span className="font-semibold text-foreground">{formatDanishNumber(project.afforestationHa, 1)} ha</span>
            </div>
          )}
        </div>
      )}

      {showNatureOverlap && natureOverlap && (
        <ProjectNatureOverlapBlock ov={natureOverlap} compact={variant === 'inline'} />
      )}

      {project.schemeName && (
        <div className={textSize}>
          <span className="text-muted-foreground">Tilskudsordning:</span>{' '}
          <span className="text-foreground">{project.schemeName}</span>
          {project.schemeOrg && <span className="text-muted-foreground"> ({project.schemeOrg})</span>}
          {hasSchemeProse && (
            <button
              type="button"
              onClick={() => setShowSchemeDesc((v) => !v)}
              className="ml-1.5 inline-flex items-center align-middle text-muted-foreground transition-colors hover:text-foreground"
              aria-expanded={showSchemeDesc}
              aria-label="Hvad går denne ordning ud på?"
              title="Hvad går denne ordning ud på?"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          )}
          {hasSchemeProse && showSchemeDesc && (
            <div className="mt-1.5 space-y-1.5 rounded-lg bg-muted/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              {scheme?.description && <p>{scheme.description}</p>}
              {scheme?.applicantText && (
                <p>
                  <span className="font-medium text-foreground">Hvem kan ansøge: </span>
                  {scheme.applicantText}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/70">
                Beskrivelsen gælder ordningstypen, ikke det enkelte projekt. MARS offentliggør ikke en beskrivelse pr. projekt.
              </p>
            </div>
          )}
        </div>
      )}

      {(applied || changed) && (
        <div className={`flex flex-wrap gap-4 ${textSize}`}>
          {applied && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Ansøgt:</span>
              <span className="text-foreground">{applied}</span>
            </div>
          )}
          {changed && (
            <div>
              <span className="text-muted-foreground">Senest opdateret:</span>{' '}
              <span className="text-foreground">{changed}</span>
            </div>
          )}
        </div>
      )}

      {coordinates && coordinates.length >= 3 && (
        <ProjectMiniMap coordinates={coordinates} height={mapHeight} onClick={onMiniMapClick} />
      )}

      {detail.schemeUrl && (
        <a
          href={detail.schemeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 font-medium text-primary transition-colors hover:text-primary/80 ${variant === 'inline' ? 'text-[11px]' : 'text-xs'}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Se tilskudsordning
        </a>
      )}

      {showMarsFooter && (
        <div className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground leading-relaxed">
          <p>
            Data fra <strong>MARS</strong> (Miljøstyrelsens Arealovervågningssystem) — den officielle
            projektdatabase for Den Grønne Trepart.
          </p>
        </div>
      )}
    </div>
  );
}
