import { useMemo, useState, useEffect } from 'react';
import { formatDanishNumber } from '@/lib/format';
import type { DashboardData, ProjectCounts, KlimaskovfondenProject, NaturstyrelsenSkovProject } from '@/lib/types';
import { loadKlimaskovfondenProjects, loadNaturstyrelsenSkovProjects } from '@/lib/data';
import { usePillar } from '@/lib/pillars';
import type { PillarId } from '@/lib/pillars';
import { GitPullRequestArrow, Pencil, ClipboardCheck, ShieldCheck, Hammer, TreePine, Landmark, Droplets } from 'lucide-react';
import { NatureWatermark } from './NatureWatermark';
import { InfoTooltip } from './InfoTooltip';

interface ProjectFunnelProps {
  data: DashboardData;
}

const stages = [
  { key: 'sketches' as const, label: 'Skitser', sublabel: 'Indledende tegninger', icon: Pencil, color: 'hsl(150 20% 78%)' },
  { key: 'assessed' as const, label: 'Forundersøgelse', sublabel: 'Forundersøgelsestilsagn', icon: ClipboardCheck, color: 'hsl(152 30% 60%)' },
  { key: 'approved' as const, label: 'Godkendt', sublabel: 'Klar til anlæg', icon: ShieldCheck, color: 'hsl(152 44% 45%)' },
  { key: 'established' as const, label: 'Anlagt', sublabel: 'Færdige projekter', icon: Hammer, color: 'hsl(95 55% 48%)' },
];

/** Phase mapping from projectDetail.phase to our stage keys */
const PHASE_TO_STAGE: Record<string, keyof ProjectCounts> = {
  preliminary: 'assessed',
  approved: 'approved',
  established: 'established',
};

/**
 * Compute pillar-specific project counts by filtering individual projects
 * that have a non-zero effect for the given pillar.
 *
 * Each MARS project can contribute to multiple pillars simultaneously
 * (e.g. a wetland project reduces nitrogen AND extracts lowland).
 * This function counts only those relevant to the selected pillar.
 */
function computePillarCounts(
  data: DashboardData,
  pillarId: PillarId,
): ProjectCounts {
  const counts: ProjectCounts = { sketches: 0, assessed: 0, approved: 0, established: 0 };

  const effectField = {
    nitrogen: 'nitrogenT',
    extraction: 'extractionHa',
    afforestation: 'afforestationHa',
  }[pillarId];

  if (!effectField) return counts;

  for (const plan of data.plans) {
    // Count sketch projects with effect > 0
    for (const sk of plan.sketchProjects) {
      if ((sk as Record<string, unknown>)[effectField] as number > 0) {
        counts.sketches++;
      }
    }
    // Count detailed projects (assessed/approved/established) with effect > 0
    for (const proj of plan.projectDetails) {
      const stage = PHASE_TO_STAGE[proj.phase];
      if (stage && (proj as Record<string, unknown>)[effectField] as number > 0) {
        counts[stage]++;
      }
    }
  }

  return counts;
}

/** Pillar-specific descriptions for the funnel header */
const PILLAR_FUNNEL_DESCRIPTIONS: Record<string, { title: string; subtitle: (total: number) => string; tooltip: string }> = {
  nitrogen: {
    title: 'Kvælstof-projekter',
    subtitle: (total) => `${formatDanishNumber(total)} projekter med kvælstofreducerende effekt`,
    tooltip: 'Projekter fra MARS-databasen der har en dokumenteret kvælstofreducerende effekt (N-reduktion > 0 ton/år). Samme projekt kan bidrage til flere delmål.',
  },
  extraction: {
    title: 'Lavbunds-projekter',
    subtitle: (total) => `${formatDanishNumber(total)} projekter med areal til lavbundsudtag`,
    tooltip: 'Projekter der bidrager til udtag af kulstofrige lavbundsjorde (ekstraktions-areal > 0 ha). Mange projekter har effekt på tværs af delmål.',
  },
  afforestation: {
    title: 'Skovrejsnings-projekter',
    subtitle: (total) => `${formatDanishNumber(total)} MARS-projekter med skovrejsningsareal`,
    tooltip: 'MARS-projekter der bidrager til skovrejsning (skovrejsningsareal > 0 ha). Klimaskovfondens frivillige og Naturstyrelsens statslige projekter vises separat nedenfor.',
  },
  nature: {
    title: 'Naturprojekter',
    subtitle: (_total) => 'Projekter fra alle typer virkemidler i MARS',
    tooltip: 'For beskyttet natur-delmålet vises den samlede projekt-pipeline — alle MARS-projekter uanset specifikt virkemiddel. Naturbeskyttelse afhænger af den samlede indsats.',
  },
};

export function ProjectFunnel({ data }: ProjectFunnelProps) {
  const { activePillar } = usePillar();
  const [ksfProjects, setKsfProjects] = useState<KlimaskovfondenProject[]>([]);
  const [nstProjects, setNstProjects] = useState<NaturstyrelsenSkovProject[]>([]);

  useEffect(() => {
    loadKlimaskovfondenProjects().then(setKsfProjects);
    loadNaturstyrelsenSkovProjects().then(setNstProjects);
  }, []);

  const pillarCounts = useMemo(
    () => computePillarCounts(data, activePillar),
    [data, activePillar],
  );

  const ksfAfforestationCount = ksfProjects.filter((p) => p.projekttyp === 'Skovrejsning').length;
  const ksfTotalHa = Math.round(ksfProjects.filter((p) => p.projekttyp === 'Skovrejsning').reduce((s, p) => s + p.areaHa, 0));

  const ksfLowlandCount = ksfProjects.filter((p) => p.projekttyp === 'Lavbund').length;
  const ksfLowlandHa = Math.round(ksfProjects.filter((p) => p.projekttyp === 'Lavbund').reduce((s, p) => s + p.areaHa, 0));

  const nstMatchedProjects = nstProjects.filter((p) => p.centroid);
  const nstOngoing = nstMatchedProjects.filter((p) => p.status === 'ongoing');
  const nstCompleted = nstMatchedProjects.filter((p) => p.status === 'completed');
  const nstTotalHa = Math.round(nstMatchedProjects.reduce((s, p) => s + (p.areaHa ?? 0), 0));

  // For nature, show the full national pipeline (all projects contribute indirectly)
  // For nitrogen/extraction/afforestation, show pillar-specific counts
  const isNature = activePillar === 'nature';
  const { projects } = data.national;
  const displayCounts = isNature ? projects : pillarCounts;

  const counts = [displayCounts.sketches, displayCounts.assessed, displayCounts.approved, displayCounts.established];
  const totalProjects = counts.reduce((a, b) => a + b, 0);
  const maxCount = Math.max(...counts, 1);

  const desc = PILLAR_FUNNEL_DESCRIPTIONS[activePillar] ?? PILLAR_FUNNEL_DESCRIPTIONS.nitrogen;

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-10 relative overflow-hidden">
      <div className="absolute -left-6 bottom-8 opacity-[0.10] hidden lg:block">
        <NatureWatermark animal="heron" size={140} />
      </div>
      <div className="absolute right-4 top-4 opacity-[0.09] hidden md:block">
        <NatureWatermark animal="seal" size={100} className="scale-x-[-1]" />
      </div>
      <div className="absolute left-1/3 top-2 opacity-[0.07] hidden lg:block animate-gentle-sway">
        <NatureWatermark animal="butterfly" size={50} />
      </div>
      <div className="absolute right-1/4 bottom-4 opacity-[0.08] hidden lg:block">
        <NatureWatermark animal="cod" size={80} className="rotate-[-15deg]" />
      </div>
      <div className="absolute left-8 top-16 opacity-[0.07] hidden xl:block">
        <NatureWatermark animal="eel" size={70} className="rotate-[20deg]" />
      </div>
      <div className="flex items-center gap-2.5 mb-2">
        <GitPullRequestArrow className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
          {desc.title}
        </h2>
        <InfoTooltip
          title={desc.title}
          content={
            <>
              <p>{desc.tooltip}</p>
              <p><strong>Skitser:</strong> Indledende projektforslag.<br/>
              <strong>Forundersøgelse:</strong> Forundersøgelsestilsagn givet — fagligt gennemgået.<br/>
              <strong>Godkendt:</strong> Tilsagn givet, klar til anlæg.<br/>
              <strong>Anlagt:</strong> Fysisk gennemført — kun disse har realiseret miljøeffekt.</p>
            </>
          }
          source="MARS API (Miljøstyrelsen)"
          side="right"
        />
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        {desc.subtitle(totalProjects)}
      </p>

      <div className="space-y-4">
        {stages.map((stage, i) => {
          const count = counts[i];
          const widthPct = Math.max((count / maxCount) * 100, 4);
          const conversionRate = i > 0 && counts[i - 1] > 0
            ? ((count / counts[i - 1]) * 100).toFixed(0)
            : null;

          return (
            <div key={stage.key}>
              {i > 0 && (
                <div className="flex items-center gap-2 ml-6 mb-2 -mt-1">
                  <div className="w-px h-4 bg-border" />
                  <span className="text-[11px] text-muted-foreground bg-muted/70 px-2 py-0.5 rounded-full">
                    ↓ {conversionRate}% videre
                  </span>
                </div>
              )}

              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: stage.color + '20' }}
                >
                  <stage.icon className="w-5 h-5" style={{ color: stage.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div>
                      <span className="text-sm font-semibold text-foreground">{stage.label}</span>
                      <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{stage.sublabel}</span>
                    </div>
                    <span
                      className="text-lg font-bold tabular-nums"
                      style={{ color: stage.color, fontFamily: "'Fraunces', serif" }}
                    >
                      {formatDanishNumber(count)}
                    </span>
                  </div>
                  <div className="h-3.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: stage.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 rounded-xl bg-muted/50 border border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Gennemførelsesrate (skitse → anlagt)
          </span>
          <span className="font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
            {displayCounts.sketches > 0 ? ((displayCounts.established / displayCounts.sketches) * 100).toFixed(1) : 0}%
          </span>
        </div>
      </div>

      {activePillar === 'extraction' && ksfLowlandCount > 0 && (
        <div className="mt-6 p-4 rounded-xl border-2 border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800/40">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#f9731620' }}
            >
              <Droplets className="w-5 h-5" style={{ color: '#c2410c' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1">
                <div>
                  <span className="text-sm font-semibold text-foreground">Klimaskovfonden</span>
                  <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">Lavbundsprojekter · {formatDanishNumber(ksfLowlandHa)} ha</span>
                </div>
                <span
                  className="text-lg font-bold tabular-nums"
                  style={{ color: '#c2410c', fontFamily: "'Fraunces', serif" }}
                >
                  {formatDanishNumber(ksfLowlandCount)}
                </span>
              </div>
              <div className="h-3.5 w-full rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: '100%',
                    backgroundColor: '#f97316',
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Alle projekter er anlagte (frivillige lavbundsprojekter). Data fra Klimaskovfondens WFS.
              </p>
            </div>
          </div>
        </div>
      )}

      {activePillar === 'afforestation' && ksfAfforestationCount > 0 && (
        <div className="mt-6 p-4 rounded-xl border-2 border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800/40">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#22c55e20' }}
            >
              <TreePine className="w-5 h-5" style={{ color: '#15803d' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1">
                <div>
                  <span className="text-sm font-semibold text-foreground">Klimaskovfonden</span>
                  <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">Frivillig skovrejsning · {formatDanishNumber(ksfTotalHa)} ha</span>
                </div>
                <span
                  className="text-lg font-bold tabular-nums"
                  style={{ color: '#15803d', fontFamily: "'Fraunces', serif" }}
                >
                  {formatDanishNumber(ksfAfforestationCount)}
                </span>
              </div>
              <div className="h-3.5 w-full rounded-full bg-green-100 dark:bg-green-900/30 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: '100%',
                    backgroundColor: '#22c55e',
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Alle projekter er anlagte (frivillige skovrejsningsprojekter). Data fra Klimaskovfondens WFS.
              </p>
            </div>
          </div>
        </div>
      )}

      {activePillar === 'afforestation' && nstMatchedProjects.length > 0 && (
        <div className="mt-4 p-4 rounded-xl border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800/40">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#3b82f620' }}
            >
              <Landmark className="w-5 h-5" style={{ color: '#1e40af' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1">
                <div>
                  <span className="text-sm font-semibold text-foreground">Naturstyrelsen</span>
                  <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">Statslig skovrejsning · {formatDanishNumber(nstTotalHa)} ha</span>
                </div>
                <span
                  className="text-lg font-bold tabular-nums"
                  style={{ color: '#1e40af', fontFamily: "'Fraunces', serif" }}
                >
                  {formatDanishNumber(nstMatchedProjects.length)}
                </span>
              </div>
              <div className="h-3.5 w-full rounded-full bg-blue-100 dark:bg-blue-900/30 overflow-hidden">
                <div className="flex h-full">
                  <div
                    className="h-full rounded-l-full transition-all duration-700 ease-out"
                    style={{
                      width: `${nstMatchedProjects.length > 0 ? (nstOngoing.length / nstMatchedProjects.length) * 100 : 0}%`,
                      backgroundColor: '#3b82f6',
                    }}
                  />
                  <div
                    className="h-full rounded-r-full transition-all duration-700 ease-out"
                    style={{
                      width: `${nstMatchedProjects.length > 0 ? (nstCompleted.length / nstMatchedProjects.length) * 100 : 0}%`,
                      backgroundColor: '#818cf8',
                    }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {formatDanishNumber(nstOngoing.length)} igangværende · {formatDanishNumber(nstCompleted.length)} afsluttede. Data fra MiljøGIS WFS (skovdrift).
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
