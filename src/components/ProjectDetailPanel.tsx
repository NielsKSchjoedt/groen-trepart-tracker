import { X, Trees, ExternalLink, MapPin, Calendar, Ruler, Tag, Building2 } from 'lucide-react';
import { formatDanishNumber } from '@/lib/format';
import type { SelectedProject } from '@/lib/project-selection';
import { KSF_COLOR_SKOV, KSF_COLOR_LAVBUND, NST_COLOR } from '@/lib/supplement-colors';

interface ProjectDetailPanelProps {
  project: SelectedProject;
  /** Name of the coastal/catchment feature the project sits in */
  featureName?: string;
  onClose: () => void;
}

/**
 * Side panel shown when a circle marker (KSF or NST project) is clicked
 * on the map. Mirrors the layout of DetailPanel / CoastalWaterDetailPanel
 * for visual consistency.
 *
 * @example <ProjectDetailPanel project={selected} onClose={close} />
 */
export function ProjectDetailPanel({ project, featureName, onClose }: ProjectDetailPanelProps) {
  if (project.source === 'klimaskovfonden') {
    return <KsfPanel project={project.project} featureName={featureName} onClose={onClose} />;
  }
  return <NstPanel project={project.project} featureName={featureName} onClose={onClose} />;
}

/** Detail row used by both panel variants. */
function InfoRow({ icon: Icon, label, children }: { icon: typeof Trees; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-foreground">{children}</p>
      </div>
    </div>
  );
}

/** Source badge with color. */
function SourceBadge({ source, isSkov = true }: { source: 'klimaskovfonden' | 'naturstyrelsen'; isSkov?: boolean }) {
  const config = source === 'klimaskovfonden'
    ? { label: 'Klimaskovfonden', color: isSkov ? KSF_COLOR_SKOV.text : KSF_COLOR_LAVBUND.text, bg: isSkov ? KSF_COLOR_SKOV.bg : KSF_COLOR_LAVBUND.bg }
    : { label: 'Naturstyrelsen', color: NST_COLOR.text, bg: NST_COLOR.bg };
  return (
    <span
      className="inline-flex items-center text-[11px] font-medium rounded-full px-2.5 py-0.5"
      style={{ color: config.color, backgroundColor: config.bg }}
    >
      {config.label}
    </span>
  );
}

/** Status badge with contextual color. */
function StatusBadge({ label, variant }: { label: string; variant: 'green' | 'blue' | 'amber' | 'gray' }) {
  const colors = {
    green: { color: '#15803d', bg: '#15803d15' },
    blue: { color: '#1e40af', bg: '#1e40af15' },
    amber: { color: '#92400e', bg: '#92400e15' },
    gray: { color: '#525252', bg: '#52525215' },
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

function KsfPanel({ project, featureName, onClose }: { project: KlimaskovfondenProject; featureName?: string; onClose: () => void }) {
  const isSkov = project.projekttyp === 'Skovrejsning';
  const typeLabel = isSkov ? 'Skovrejsning' : 'Lavbundsprojekt';
  const statusLabel = isSkov ? 'Anlagt (frivillig skovrejsning)' : 'Anlagt (lavbundsudtag)';
  const areaStr = project.areaHa < 10
    ? project.areaHa.toFixed(1).replace('.', ',')
    : formatDanishNumber(Math.round(project.areaHa));

  return (
    <div className="bg-background border-l border-border h-full overflow-y-auto p-6 relative">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
        aria-label="Luk"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>

      <h2
        className="text-lg font-bold text-foreground pr-8 mb-2"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Klimaskovfonden {project.sagsnummer}
      </h2>

      <div className="flex flex-wrap gap-1.5 mb-5">
        <SourceBadge source="klimaskovfonden" isSkov={isSkov} />
        <StatusBadge label={statusLabel} variant={isSkov ? 'green' : 'amber'} />
      </div>

      <div className="mb-5">
        <InfoRow icon={Tag} label="Type">{typeLabel}</InfoRow>
        <InfoRow icon={Ruler} label="Areal">{areaStr} ha</InfoRow>
        <InfoRow icon={Calendar} label="Årgang">{project.aargang}</InfoRow>
        {featureName && (
          <InfoRow icon={MapPin} label="Kystvandsopland">{featureName}</InfoRow>
        )}
      </div>

      <div className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground leading-relaxed">
        <p className="mb-2">
          <strong>Klimaskovfonden</strong> er en privat fond der rejser skov og udtager lavbundsjorde
          med frivillige lodsejere. Projekterne bidrager til Den Grønne Trepartsaftales skovrejsnings-
          og lavbundsmål.
        </p>
        <p>Arealet er beregnet fra polygongeometri i Klimaskovfondens WFS-tjeneste.</p>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <a
          href="https://klimaskovfonden.dk"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>klimaskovfonden.dk</span>
        </a>
      </div>
    </div>
  );
}

function NstPanel({ project, featureName, onClose }: { project: NaturstyrelsenSkovProject; featureName?: string; onClose: () => void }) {
  const isOngoing = project.status === 'ongoing';
  const statusLabel = isOngoing ? 'Igangværende' : 'Afsluttet';
  const areaStr = project.areaHa != null
    ? project.areaHa < 10
      ? project.areaHa.toFixed(1).replace('.', ',')
      : formatDanishNumber(Math.round(project.areaHa))
    : 'Ukendt';

  return (
    <div className="bg-background border-l border-border h-full overflow-y-auto p-6 relative">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
        aria-label="Luk"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>

      <h2
        className="text-lg font-bold text-foreground pr-8 mb-2"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {project.name}
      </h2>

      <div className="flex flex-wrap gap-1.5 mb-5">
        <SourceBadge source="naturstyrelsen" />
        <StatusBadge label={statusLabel} variant={isOngoing ? 'blue' : 'gray'} />
      </div>

      <div className="mb-5">
        <InfoRow icon={Trees} label="Type">Statslig skovrejsning</InfoRow>
        <InfoRow icon={Ruler} label="Areal">{areaStr} ha</InfoRow>
        {project.district && (
          <InfoRow icon={Building2} label="Distrikt">{project.district}</InfoRow>
        )}
        {featureName && (
          <InfoRow icon={MapPin} label="Kystvandsopland">{featureName}</InfoRow>
        )}
      </div>

      <div className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground leading-relaxed">
        <p className="mb-2">
          <strong>Naturstyrelsen</strong> varetager statslig skovrejsning på offentligt ejede arealer.
          Projekterne er en del af den nationale skovrejsningsindsats under Den Grønne Trepartsaftale.
        </p>
        <p>Arealet er beregnet fra polygongeometri i MiljøGIS WFS (Naturstyrelsens arealoversigt).</p>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-4">
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Se på naturstyrelsen.dk</span>
        </a>
      </div>
    </div>
  );
}
