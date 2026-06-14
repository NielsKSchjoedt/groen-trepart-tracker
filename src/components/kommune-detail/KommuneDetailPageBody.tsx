import type { ReactNode } from 'react';
import { Droplets, Trees, Mountain, Leaf, ExternalLink } from 'lucide-react';
import type {
  KommuneMetrics,
  ProjectDetail,
  SketchProject,
  KlimaskovfondenProject,
  NaturstyrelsenSkovProject,
  KommuneCO2Data,
  KommuneBenchmarkData,
  KommuneRankingData,
  KommuneOplandeData,
} from '@/lib/types';
import { formatDanishNumber } from '@/lib/format';
import { MarsProjectPhaseBadges } from '@/components/MarsProjectPhaseBadges';
import { ProjectActivityChart } from '@/components/ProjectActivityChart';
import { ProjectList } from '@/components/ProjectList';
import type { KommuneMetric } from '@/lib/kommune-metrics';
import { PROJECT_COUNT_STAGES } from '@/lib/kommune-metrics';
import { KSF_COLOR_SKOV, KSF_COLOR_LAVBUND } from '@/lib/supplement-colors';
import { CO2SectorChart } from '@/components/CO2SectorChart';
import { CO2TrendChart } from '@/components/CO2TrendChart';
import { KommuneNaturBenchmark } from '@/components/KommuneNaturBenchmark';
import { KommunePhaseVsNational, hasPhaseProfileData } from '@/components/kommune-standings/KommunePhaseVsNational';
import { KommuneOplandeOverlay } from '@/components/KommuneOplandeOverlay';
import { KommuneDetailBlock } from '@/components/kommune-detail/KommuneDetailBlock';

export interface KommuneDetailPageBodyProps {
  kommune: KommuneMetrics;
  projectDetails: ProjectDetail[];
  sketchProjects: SketchProject[];
  ksfProjects: KlimaskovfondenProject[];
  nstProjects: NaturstyrelsenSkovProject[];
  activeMetric?: KommuneMetric;
  co2Data?: KommuneCO2Data | null;
  natureBenchmark?: KommuneBenchmarkData | null;
  ranking?: KommuneRankingData | null;
  oplande?: KommuneOplandeData | null;
}

/** Metric grid + MARS phase badges — «Nøgletal» chapter. */
export function KommuneDetailKeyFigures({
  kommune,
  ksfProjects,
  nstProjects,
}: Pick<KommuneDetailPageBodyProps, 'kommune' | 'ksfProjects' | 'nstProjects'>) {
  const totalAffTotal = kommune.afforestationTotalHa;
  const ksfTotal = ksfProjects.reduce((s, p) => s + (p.areaHa || 0), 0);
  const nstTotal = nstProjects.reduce((s, p) => s + (p.areaHa || 0), 0);
  const hasPhases = PROJECT_COUNT_STAGES.some(
    ({ countField }) => kommune.projectsByPhase[countField] > 0,
  );

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-3">
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

      {hasPhases && (
        <div className="mt-4 pt-4 border-t border-border/60">
          <p className="text-sm font-medium text-foreground mb-1">MARS-projekter efter fase</p>
          <p className="text-xs text-muted-foreground mb-2">
            Registrerede hektar og projektantal pr. fase (lavbund, skov og kvælstof).
          </p>
          <MarsProjectPhaseBadges kommune={kommune} />
        </div>
      )}
    </div>
  );
}

/** Faseprofil vs. landet — own chapter when data exists. */
export function KommuneDetailPhaseProfile({
  kommune,
  ranking,
}: Pick<KommuneDetailPageBodyProps, 'kommune' | 'ranking'>) {
  if (!ranking || !hasPhaseProfileData(kommune, ranking)) return null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5">
      <KommunePhaseVsNational kommune={kommune} ranking={ranking} embedded />
    </div>
  );
}

/** Natur-benchmark + vandoplande — «Natur & opland» chapter. */
export function KommuneDetailNaturSection({
  kommune,
  natureBenchmark,
  oplande,
}: Pick<KommuneDetailPageBodyProps, 'kommune' | 'natureBenchmark' | 'oplande'>) {
  return (
    <div className="space-y-6">
      {oplande && (
        <KommuneOplandeOverlay kommuneKode={kommune.kode} data={oplande} showNationalLink={false} />
      )}
      <KommuneNaturBenchmark
        kommuneKode={kommune.kode}
        benchmark={natureBenchmark ?? null}
        variant="plain"
      />
    </div>
  );
}

/** CO₂ charts from Klimaregnskabet. */
export function KommuneDetailCo2Section({ co2Data }: { co2Data: KommuneCO2Data }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5 space-y-4">
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
}

/** Timeline + project lists — «Projekter» chapter. */
export function KommuneDetailProjectsSection({
  kommune,
  projectDetails,
  sketchProjects,
  ksfProjects,
  nstProjects,
  activeMetric,
}: Pick<
  KommuneDetailPageBodyProps,
  'kommune' | 'projectDetails' | 'sketchProjects' | 'ksfProjects' | 'nstProjects' | 'activeMetric'
>) {
  const ksfColor = activeMetric === 'extraction' ? KSF_COLOR_LAVBUND : KSF_COLOR_SKOV;
  const hasMarsProjects = projectDetails.length > 0 || sketchProjects.length > 0;
  const hasSupplements = ksfProjects.length > 0 || nstProjects.length > 0;
  const hasAnyProjects = hasMarsProjects || hasSupplements;
  const activityCount = projectDetails.length + ksfProjects.length + nstProjects.length;

  if (!hasAnyProjects && activityCount < 3) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Ingen registrerede projekter i {kommune.navn} endnu.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {activityCount >= 3 && (
        <KommuneDetailBlock
          title="Udvikling over tid"
          intro="Kumulativ opbygning siden trepartsaftalen — MARS-faser plus Klimaskovfonden og Naturstyrelsen hvor datoer findes."
        >
          <ProjectActivityChart
            projectDetails={projectDetails}
            ksfProjects={ksfProjects}
            nstProjects={nstProjects}
            ksfColor={ksfColor}
            showTitle={false}
            className=""
            height={200}
          />
        </KommuneDetailBlock>
      )}

      {hasMarsProjects && (
        <KommuneDetailBlock
          id="kommune-projekter"
          title="MARS-projekter"
          intro="Formelle projekter og skitser registreret i MARS med fase, areal og ordning."
        >
          <ProjectList
            projectDetails={projectDetails}
            sketchProjects={sketchProjects}
            naturePotentials={[]}
            activePillar={activeMetric ?? 'nitrogen'}
            hideTitle
            flat
          />
        </KommuneDetailBlock>
      )}

      {hasSupplements && (
        <KommuneDetailBlock
          title="Supplerende kilder"
          intro="Projekter uden for MARS — administreres separat og har ikke projektfasedata i MARS."
        >
          <div className="space-y-5">
            {ksfProjects.length > 0 && (
              <SupplementProjectGroup
                label="Klimaskovfonden"
                count={ksfProjects.length}
                items={ksfProjects.map((p) => ({
                  key: p.sagsnummer,
                  primary: `${p.sagsnummer} · ${p.projekttyp}`,
                  secondary: `${p.areaHa < 10 ? p.areaHa.toFixed(1).replace('.', ',') : Math.round(p.areaHa).toLocaleString('da-DK')} ha`,
                }))}
              />
            )}
            {nstProjects.length > 0 && (
              <SupplementProjectGroup
                label="Naturstyrelsen"
                count={nstProjects.length}
                items={nstProjects.map((p) => ({
                  key: p.name,
                  primary: p.name,
                  href: p.url,
                  secondary: p.areaHa ? `${Math.round(p.areaHa).toLocaleString('da-DK')} ha` : '?',
                }))}
              />
            )}
          </div>
        </KommuneDetailBlock>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  sub,
  noDataText,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  unit: string;
  color?: string;
  sub?: string;
  noDataText?: string;
}) {
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
