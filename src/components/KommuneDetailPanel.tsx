import { X, Droplets, Trees, Mountain, Leaf, ExternalLink, Factory } from 'lucide-react';
import type { KommuneMetrics, ProjectDetail, SketchProject, KlimaskovfondenProject, NaturstyrelsenSkovProject, KommuneCO2Data } from '@/lib/types';
import { formatDanishNumber } from '@/lib/format';
import { MarsProjectPhaseBadges } from '@/components/MarsProjectPhaseBadges';
import { ProjectActivityChart } from './ProjectActivityChart';
import { ProjectList } from './ProjectList';
import type { KommuneMetric } from '@/lib/kommune-metrics';
import { PROJECT_COUNT_STAGES } from '@/lib/kommune-metrics';
import { KSF_COLOR_SKOV, KSF_COLOR_LAVBUND } from '@/lib/supplement-colors';
import { CO2SectorChart } from './CO2SectorChart';
import { CO2TrendChart } from './CO2TrendChart';
import { KommuneNaturBenchmark } from './KommuneNaturBenchmark';
import type { KommuneBenchmarkData, KommuneRankingData, KommuneTrepartLink } from '@/lib/types';
import { KommuneStandingsDetailHeader } from '@/components/kommune-standings/KommuneStandingsDetailHeader';
import { KommunePhaseVsNational } from '@/components/kommune-standings/KommunePhaseVsNational';
import { KommuneOplandeOverlay } from '@/components/KommuneOplandeOverlay';
import type { KommuneOplandeData } from '@/lib/types';

interface KommuneDetailPanelProps {
  kommune: KommuneMetrics;
  /** MARS projects in this municipality filtered from the plan data */
  projectDetails: ProjectDetail[];
  /** MARS sketch projects in this municipality (from the same plans) */
  sketchProjects?: SketchProject[];
  /** KSF projects in this municipality */
  ksfProjects: KlimaskovfondenProject[];
  /** NST projects in this municipality */
  nstProjects: NaturstyrelsenSkovProject[];
  /** Active metric — used to pick the correct KSF chart colour */
  activeMetric?: KommuneMetric;
  /** Full CO₂ time-series from Klimaregnskabet (optional — shown when available) */
  co2Data?: KommuneCO2Data | null;
  /** Sprint 4 nature benchmark metrics (B1/B2/B3), loaded monthly */
  natureBenchmark?: KommuneBenchmarkData | null;
  /** Sprint 6 competition ranking row */
  ranking?: KommuneRankingData | null;
  /** Sprint 6 opland overlap */
  oplande?: KommuneOplandeData | null;
  /** Curated link to the kommune's own Grøn Trepart entry page (optional) */
  trepartLink?: KommuneTrepartLink | null;
  onClose?: () => void;
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
 * @param natureBenchmark - Optional Sprint 4 B1/B2/B3 benchmark data
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
  sketchProjects = [],
  ksfProjects,
  nstProjects,
  activeMetric,
  co2Data,
  natureBenchmark,
  ranking,
  oplande,
  trepartLink,
  onClose,
}: KommuneDetailPanelProps) {

  const ksfColor = activeMetric === 'extraction' ? KSF_COLOR_LAVBUND : KSF_COLOR_SKOV;
  const totalAffTotal = kommune.afforestationTotalHa;
  const ksfTotal = ksfProjects.reduce((s, p) => s + (p.areaHa || 0), 0);
  const nstTotal = nstProjects.reduce((s, p) => s + (p.areaHa || 0), 0);

  const hasPhases = PROJECT_COUNT_STAGES.some(
    ({ countField }) => kommune.projectsByPhase[countField] > 0,
  );

  const showCO2First = activeMetric === 'co2' && !!co2Data;
  const hasMarsProjects = projectDetails.length > 0 || sketchProjects.length > 0;
  const hasSupplements = ksfProjects.length > 0 || nstProjects.length > 0;
  const hasAnyProjects = hasMarsProjects || hasSupplements;
  const activityCount = projectDetails.length + ksfProjects.length + nstProjects.length;

  const co2Charts = co2Data && (
    <div className="space-y-4">
      <CO2SectorChart data={co2Data} />
      <CO2TrendChart data={co2Data} />
      <p className="text-xs text-muted-foreground">
        Kilde:{' '}
        <a
          href="https://klimaregnskabet.dk"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Energi- og CO₂-regnskabet, Energistyrelsen
        </a>
      </p>
    </div>
  );

  const co2Section = co2Data && (
    <div className={showCO2First ? 'mb-5' : 'mt-5 pt-5 border-t border-border'}>
      <div className="flex items-center gap-1.5 mb-3">
        <Factory className="w-4 h-4 text-slate-500" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          CO₂-udledning
        </p>
      </div>
      {co2Charts}
    </div>
  );

  return (
    <div className="bg-background border-l border-border h-full overflow-y-auto p-5 relative">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          aria-label="Luk"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      <h2
        className="text-lg font-bold text-foreground pr-8 mb-0.5"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {kommune.navn}
      </h2>
      <p className="text-xs text-muted-foreground mb-3">
        {kommune.region} · {kommune.projectCount} MARS-projekt{kommune.projectCount !== 1 ? 'er' : ''}
      </p>

      {trepartLink?.url && (
        <a
          href={trepartLink.url}
          target="_blank"
          rel="noopener noreferrer"
          title={trepartLink.note || undefined}
          className="inline-flex items-center gap-1.5 mb-4 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          Se hvad {kommune.navn} Kommune selv siger om trepart
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </a>
      )}

      {ranking?.byKommune[kommune.kode] && (
        <KommuneStandingsDetailHeader row={ranking.byKommune[kommune.kode]} ranking={ranking} />
      )}

      {ranking && <KommunePhaseVsNational kommune={kommune} ranking={ranking} />}

      {oplande && (
        <div className="mb-5">
          <KommuneOplandeOverlay kommuneKode={kommune.kode} data={oplande} showNationalLink={false} />
        </div>
      )}

      {/* CO₂ section — shown first when CO₂ metric is active */}
      {showCO2First && co2Section}

      {/* 2×2 metric grid */}
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2.5">
        {showCO2First ? 'Øvrige indsatsområder' : 'Indsatsområder'}
      </p>
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
          label="Lavbund"
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
          label="Beskyttet natur (§3+N2000)"
          value={kommune.naturePotentialHa}
          unit="ha"
          color="emerald"
          noDataText="Ikke opdelt per kommune"
        />
      </div>

      <KommuneNaturBenchmark kommuneKode={kommune.kode} benchmark={natureBenchmark ?? null} />

      {/* Phase distribution */}
      {hasPhases && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Projektfaser
          </p>
          <MarsProjectPhaseBadges kommune={kommune} />
        </div>
      )}

      {/* Project activity timeline */}
      <ProjectActivityChart
        projectDetails={projectDetails}
        ksfProjects={ksfProjects}
        nstProjects={nstProjects}
        ksfColor={ksfColor}
      />

      {/* MARS project list — full accordion with mini-map and scheme details */}
      {(projectDetails.length > 0 || sketchProjects.length > 0) && (
        <div className="mb-5" id="kommune-projekter">
          <ProjectList
            projectDetails={projectDetails}
            sketchProjects={sketchProjects}
            naturePotentials={[]}
            activePillar={activeMetric ?? 'nitrogen'}
            title="MARS-projekter"
            flat
          />
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

      {/* CO₂ section — shown at bottom when a non-CO₂ metric is active */}
      {!showCO2First && co2Section}
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
    <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
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

interface SupplementItem {
  key: string;
  primary: string;
  secondary: string;
  href?: string;
}

function SupplementProjectGroup({
  label,
  count,
  items,
}: {
  label: string;
  count: number;
  items: SupplementItem[];
}) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-2">
        {label}
        <span className="text-muted-foreground font-normal"> · {count} projekt{count !== 1 ? 'er' : ''}</span>
      </p>
      <ul className="divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm bg-muted/10">
            {item.href ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/90 hover:text-primary flex items-center gap-1 min-w-0 truncate"
              >
                {item.primary}
                <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" />
              </a>
            ) : (
              <span className="text-foreground/90 truncate">{item.primary}</span>
            )}
            <span className="text-muted-foreground tabular-nums flex-shrink-0 text-xs">{item.secondary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

