import type { ReactNode } from 'react';
import { Droplets, Trees, Mountain, ExternalLink } from 'lucide-react';
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
import { KommuneMetricCard } from '@/components/kommune-detail/KommuneMetricCard';
import { KommuneNatureMetricCard } from '@/components/kommune-detail/KommuneNatureMetricCard';
import { ProjectActivityChart } from '@/components/ProjectActivityChart';
import { ProjectList } from '@/components/ProjectList';
import type { KommuneMetric } from '@/lib/kommune-metrics';
import { KSF_COLOR_SKOV, KSF_COLOR_LAVBUND } from '@/lib/supplement-colors';
import { CO2SectorChart } from '@/components/CO2SectorChart';
import { CO2TrendChart } from '@/components/CO2TrendChart';
import { KommuneNaturBenchmark } from '@/components/KommuneNaturBenchmark';
import { KommuneProcesFremdrift } from '@/components/KommuneProcesFremdrift';
import { hasProcesData } from '@/lib/kommune-proces';
import { KommuneOplandeOverlay } from '@/components/KommuneOplandeOverlay';
import { KommuneDetailBlock } from '@/components/kommune-detail/KommuneDetailBlock';
import type { DashboardData, ProjectChangelog } from '@/lib/types';

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
  ranking,
  natureBenchmark,
}: Pick<
  KommuneDetailPageBodyProps,
  'kommune' | 'ksfProjects' | 'nstProjects' | 'ranking' | 'natureBenchmark'
>) {
  const totalAffTotal = kommune.afforestationTotalHa;
  const ksfTotal = ksfProjects.reduce((s, p) => s + (p.areaHa || 0), 0);
  const nstTotal = nstProjects.reduce((s, p) => s + (p.areaHa || 0), 0);
  const rankingRow = ranking?.byKommune[kommune.kode] ?? null;
  const dce30Ha = natureBenchmark?.b1.byKommune[kommune.kode]?.dce30Ha ?? null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-3">
        <KommuneMetricCard
          icon={<Droplets className="w-4 h-4 text-teal-600" />}
          label="Kvælstof"
          value={kommune.nitrogenT}
          unit="ton N"
          kommune={kommune}
          marsPhaseMetric="nitrogenT"
        />
        <KommuneMetricCard
          icon={<Mountain className="w-4 h-4 text-amber-700" />}
          label="Lavbund"
          value={kommune.extractionHa}
          unit="ha"
          kommune={kommune}
          marsPhaseMetric="extractionHa"
        />
        <KommuneMetricCard
          icon={<Trees className="w-4 h-4 text-green-700" />}
          label="Skovrejsning"
          value={totalAffTotal}
          unit="ha"
          sub={totalAffTotal > 0 ? [
            kommune.afforestationMarsHa > 0 && `MARS ${formatDanishNumber(Math.round(kommune.afforestationMarsHa))} ha`,
            ksfTotal > 0 && `KSF ${formatDanishNumber(Math.round(ksfTotal))} ha`,
            nstTotal > 0 && `NST ${formatDanishNumber(Math.round(nstTotal))} ha`,
          ].filter(Boolean).join(' · ') : undefined}
          kommune={kommune}
          marsPhaseMetric="afforestationHa"
          extraAnlagt={ksfTotal + nstTotal}
        />
        <KommuneNatureMetricCard
          kommune={kommune}
          rankingRow={rankingRow}
          dce30Ha={dce30Ha}
          noDataText="Ikke opdelt per kommune"
        />
      </div>
    </div>
  );
}

/** Proces & fremdrift — pipeline, momentum og nabosammenligning. */
export function KommuneDetailPhaseProfile({
  kommune,
  plans,
  changelog,
  borderNeighborNavne = [],
}: {
  kommune: KommuneMetrics;
  plans: DashboardData['plans'];
  changelog: ProjectChangelog | null;
  borderNeighborNavne?: string[];
}) {
  if (!hasProcesData({ plans }, kommune.navn)) return null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5">
      <KommuneProcesFremdrift
        kommuneNavn={kommune.navn}
        plans={plans}
        changelog={changelog}
        borderNeighborNavne={borderNeighborNavne}
      />
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
