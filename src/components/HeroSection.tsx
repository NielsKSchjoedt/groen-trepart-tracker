import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArcGauge } from './ArcGauge';
import { CountdownTimer } from './CountdownTimer';
import { NatureWatermark } from './NatureWatermark';
import type { Animal } from './NatureWatermark';
import { ShareButton } from './ShareButton';
import { usePillar, PILLAR_CONFIGS, type PillarId } from '@/lib/pillars';
import { loadCO2Emissions, loadCoastalWaterStatus } from '@/lib/data';
import { GOAL_STATUS_META } from '@/lib/projections';
import {
  buildMeasures,
  buildEffectDomains,
  buildIndsatsComposite,
  domainsForMeasure,
  measuresForDomain,
  type MeasureId,
  type EffectDomainId,
} from '@/lib/model';
import { buildHeroConclusion } from '@/lib/hero-conclusion';
import { DELMAAL_CHAPTER } from '@/lib/chapters';
import type { DashboardData, CO2EmissionsData, CoastalWaterStatusData } from '@/lib/types';
import { Leaf, TreePine, Hand } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';
import { ViewSwitcher } from './ViewSwitcher';
import { HintCallout } from './HintCallout';
import { useFirstVisitHint } from '@/hooks/useFirstVisitHint';
import { IndsatsRow } from './IndsatsRow';
import { FlowConnectors } from './FlowConnectors';
import { EffectRow } from './EffectRow';

interface HeroSectionProps {
  data: DashboardData;
  /** Sentinel placed just below the title; StickyNav slides in once it scrolls past the top. */
  heroSentinelRef?: React.RefObject<HTMLDivElement>;
}

/** Active flow selection (hover only) — either a virkemiddel, an effekt, or nothing. */
type FlowSelection =
  | { kind: 'measure'; id: MeasureId }
  | { kind: 'domain'; id: EffectDomainId }
  | null;

export function HeroSection({ data, heroSentinelRef }: HeroSectionProps) {
  const { activePillar, setActivePillar, config } = usePillar();
  const pillarHint = useFirstVisitHint('hero-delmål-hint', 15_000);

  /** Always on overview; on pillar routes only until dismissed or a card is chosen. */
  const showPillarHint = activePillar === null || pillarHint.visible;

  const handlePillarSelect = useCallback(
    (pillarId: PillarId) => {
      pillarHint.dismiss();
      setActivePillar(pillarId);
    },
    [pillarHint, setActivePillar],
  );

  const [co2Data, setCo2Data] = useState<CO2EmissionsData | null>(null);
  const [coastalStatus, setCoastalStatus] = useState<CoastalWaterStatusData | null>(null);
  useEffect(() => {
    loadCO2Emissions().then(setCo2Data);
    loadCoastalWaterStatus().then(setCoastalStatus);
  }, []);

  // Hover highlights the relevant flows; clicking a card drills into its pillar.
  const [hovered, setHovered] = useState<FlowSelection>(null);
  const activeMeasure = hovered?.kind === 'measure' ? hovered.id : null;
  const activeDomain = hovered?.kind === 'domain' ? hovered.id : null;

  const onHoverMeasure = (id: MeasureId | null) =>
    setHovered(id ? { kind: 'measure', id } : null);
  const onHoverDomain = (id: EffectDomainId | null) =>
    setHovered(id ? { kind: 'domain', id } : null);

  const measures = useMemo(() => buildMeasures(data), [data]);
  const effectDomains = useMemo(
    () => buildEffectDomains(data, co2Data, coastalStatus),
    [data, co2Data, coastalStatus],
  );
  const composite = useMemo(() => buildIndsatsComposite(data), [data]);
  const compositeMeta = GOAL_STATUS_META[composite.status];
  const conclusion = useMemo(
    () => buildHeroConclusion(composite, effectDomains, measures),
    [composite, effectDomains, measures],
  );

  // Selected pillar (route) maps back to its virkemiddel/effekt so the flow stays lit.
  const selectedMeasure = activePillar
    ? (measures.find((m) => m.pillarId === activePillar)?.id ?? null)
    : null;
  const selectedDomain = activePillar
    ? (effectDomains.find((d) => d.pillarId === activePillar)?.id ?? null)
    : null;

  // Flow lines: hover replaces selection entirely (never mix hover + valgt pillar).
  const flowMeasure = hovered !== null ? activeMeasure : selectedMeasure;
  const flowDomain = hovered !== null ? activeDomain : selectedDomain;

  const highlightedDomains = activeMeasure
    ? new Set(domainsForMeasure(activeMeasure))
    : null;
  const highlightedMeasures = activeDomain
    ? new Set(measuresForDomain(activeDomain))
    : null;

  return (
    <section className="relative w-full overflow-x-hidden pb-14 pt-10 text-center md:pb-20">
      <ViewSwitcher />

      <div className="pointer-events-none absolute left-8 top-6 opacity-[0.08]">
        <Leaf className="h-32 w-32 animate-gentle-sway text-primary" strokeWidth={1} />
      </div>
      <div className="pointer-events-none absolute bottom-4 right-10 opacity-[0.07]">
        <TreePine className="h-40 w-40 text-nature-moss" strokeWidth={1} />
      </div>
      <div className="pointer-events-none absolute right-1/4 top-1/3 hidden opacity-[0.06] md:block">
        <Leaf className="h-20 w-20 rotate-45 text-nature-leaf" strokeWidth={1} />
      </div>

      {(activePillar ? config.watermarks : (['deer', 'butterfly', 'heron', 'owl'] as Animal[]))
        .slice(0, 4)
        .map((animal, i) => {
          const positions = [
            'absolute bottom-16 left-4 hidden opacity-[0.10] lg:block',
            'absolute right-6 top-20 hidden animate-gentle-sway opacity-[0.12] md:block',
            'absolute left-1/4 top-40 hidden opacity-[0.08] lg:block',
            'absolute bottom-32 right-1/4 hidden opacity-[0.09] md:block',
          ];
          const sizes = [150, 70, 60, 90];
          return (
            <div
              key={`${animal}-${i}`}
              className={`pointer-events-none transition-opacity duration-300 ${positions[i]}`}
            >
              <NatureWatermark animal={animal} size={sizes[i]} />
            </div>
          );
        })}

      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
        Fra løfter og aftaler til virkelighed
      </p>

      <h1
        className="mb-3 text-4xl font-bold tracking-tight text-foreground md:text-6xl"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Er vi på sporet?
      </h1>
      <p
        className="mb-8 text-lg text-muted-foreground md:text-xl"
        style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}
      >
        — til et grønt Danmark
      </p>

      {/* Sentinel: StickyNav slides in once the title scrolls past the top of the viewport */}
      {heroSentinelRef && <div ref={heroSentinelRef} aria-hidden="true" />}

      {activePillar && (
        <div className="mb-8 flex justify-center">
          <ShareButton pillarLabel={config.label} />
        </div>
      )}

      {/* Indsats gauge — area-weighted skov + lavbund anlagt */}
      <div className="relative mb-4">
        <ArcGauge
          value={Math.round(composite.builtPct)}
          max={100}
          pct={composite.builtPct}
          projectedPct={composite.projectedPct}
          unit="%"
          subText="af areal-virkemidlerne anlagt"
          label="Samlet indsats — skovrejsning og lavbundsarealer ført ud i virkeligheden (kvælstof vises separat i ton)"
          size={240}
          statusLabel={compositeMeta.label}
          statusColor={compositeMeta.color}
          statusIcon={compositeMeta.icon}
        />
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <InfoTooltip
            title="Hvad viser indsats-måleren?"
            content={
              <>
                <p>
                  <strong>Bygger vi det?</strong> Tallet viser hvor stor en andel af trepartens
                  arealomlægning (skov + lavbund) der er fysisk anlagt — ikke effekten i naturen.
                </p>
                <p>
                  Ydre bue = lineær fremskrivning: hvor langt vi forventes at nå ved nuværende tempo
                  inden skov-målets deadline. Kvælstof-vådområder vises som eget virkemiddel
                  nedenfor (ton N, ikke hektar).
                </p>
                <p>
                  Effekterne (klima, vandmiljø, natur) vises separat nedenfor og summeres aldrig til
                  ét samlet tal.
                </p>
              </>
            }
            source="Beregnet på baggrund af data fra MARS, KF25 og Miljøstyrelsen"
            articleLink="maal-virkemidler-og-effekt"
            methodLink="#metode"
            size={13}
          />
        </div>
      </div>

      {/* "Kort sagt" — dynamisk hovedkonklusion, genereret fra live-tallene. */}
      <div
        className="mx-auto mb-10 max-w-xl rounded-2xl bg-muted/40 px-5 py-4 text-left"
        style={{ borderLeft: `3px solid ${conclusion.color}` }}
      >
        <p
          className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: conclusion.color }}
        >
          Kort sagt
        </p>
        <p
          className="mb-2.5 text-xl leading-snug text-foreground"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {conclusion.verdict}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {conclusion.buildLine} {conclusion.effectLine}
          <InfoTooltip
            title="Hvordan er konklusionen regnet?"
            content={
              <>
                <p>
                  Baseret på faktisk implementering (anlagt) og lineær fremskrivning til hvert
                  virkemiddels deadline. Skovrejsning, lavbundsarealer og kvælstof-vådområder
                  vurderes hver for sig — ikke som ét gennemsnit på tværs af CO₂ og beskyttet natur.
                </p>
                <p>
                  Effekterne (klima, natur, vandmiljø) er forsinkede og delvist drevet udefra og
                  vejes aldrig sammen til ét tal — de beskrives hver for sig.
                </p>
              </>
            }
            articleLink="saadan-maaler-vi"
            methodLink="#metode"
            size={12}
            className="ml-1 align-middle"
          />
        </p>
      </div>

      {/* Flow: virkemidler → effekter. This is now the canonical "delmaal" chapter
          — each card drills into its official pillar and carries the Klimarådet badge. */}
      <div id={DELMAAL_CHAPTER.id} lang="da" className="mx-auto max-w-3xl scroll-mt-20 px-4 text-left">
        <p className="mb-1.5 text-center text-xs font-semibold uppercase tracking-widest text-primary/80">
          {DELMAAL_CHAPTER.eyebrow}
        </p>
        <h2
          className="mb-6 text-center text-xl font-bold tracking-tight text-foreground md:text-2xl"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {DELMAAL_CHAPTER.question}
        </h2>
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.12em] text-primary">
          Det vi vil gøre
        </p>
        <IndsatsRow
          measures={measures}
          activeMeasure={activeMeasure}
          activeDomain={activeDomain}
          highlightedMeasures={highlightedMeasures}
          selectedPillar={activePillar}
          klimaraadet={data.national.klimaraadet}
          onHover={onHoverMeasure}
          onSelect={handlePillarSelect}
        />

        {/* Hint sits in the gap between card rows — centred on flow band + row label */}
        <div className={`relative ${showPillarHint ? 'min-h-[6.5rem] sm:min-h-[7rem]' : ''}`}>
          {showPillarHint && (
            <HintCallout
              icon={Hand}
              text="Vælg et delmål for at dykke ned i detaljerne"
              arrow="left"
              onDismiss={activePillar === null ? () => {} : pillarHint.dismiss}
              className="absolute z-40 left-1/2 top-1/2 w-[calc(100%-0.5rem)] max-w-[15rem] -translate-x-1/2 -translate-y-1/2 sm:left-auto sm:right-1 sm:w-max sm:max-w-[14rem] sm:translate-x-0"
            />
          )}
          <FlowConnectors
            activeMeasure={flowMeasure}
            activeDomain={flowDomain}
            showLabel={activePillar === null}
          />
          <p className="mb-2 mt-1 text-sm font-bold uppercase tracking-[0.12em] text-primary">
            Det vi vil opnå
          </p>
        </div>
        <EffectRow
          domains={effectDomains}
          activeDomain={activeDomain}
          activeMeasure={activeMeasure}
          highlightedDomains={highlightedDomains}
          selectedPillar={activePillar}
          klimaraadet={data.national.klimaraadet}
          onHover={onHoverDomain}
          onSelect={handlePillarSelect}
        />

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          {activePillar ? (
            <>
              Viser nu detaljer for{' '}
              <span className="font-semibold" style={{ color: config.accentColor }}>
                {config.label}
              </span>{' '}
              nedenfor. Klik et andet kort for at skifte.
            </>
          ) : !showPillarHint ? (
            'Klik på et kort for at dykke ned i tal, projekter og kort for det enkelte mål.'
          ) : null}
        </p>

        <p className="mt-4 flex items-start justify-center gap-1.5 text-center text-[11px] italic text-amber-700/90">
          <InfoTooltip
            title="Hvorfor vises effekter hver for sig?"
            content={
              <p>
                Effekterne er forsinkede og delvist drevet udefra (fx CO₂ mest fra energisektoren,
                beskyttet natur via politiske udpegninger). Derfor vises de hver for sig — aldrig
                vejet sammen til ét tal.
              </p>
            }
            articleLink="fra-virkemiddel-til-effekt"
            size={12}
            className="mt-0.5 shrink-0"
          />
          <span>
            Effekterne er forsinkede og delvist drevet udefra — derfor vises de hver for sig, aldrig
            vejet sammen til ét tal.
          </span>
        </p>
      </div>

      {(() => {
        // Hvert delmål har sin egen frist (config.deadlineYear er autoritativ —
        // targets.deadline i data er fast 2030 og må ikke bruges her).
        // Natur har ingen fast årsfrist (politiske udpegninger) → ingen nedtælling.
        const NO_FIRM_DEADLINE: PillarId[] = ['nature'];

        if (activePillar) {
          if (NO_FIRM_DEADLINE.includes(activePillar)) {
            return (
              <p className="mt-10 text-center text-xs italic text-muted-foreground">
                {config.label} har ingen fast årsfrist — fremskridt sker via politiske
                udpegninger, ikke en projekt-deadline.
              </p>
            );
          }
          return (
            <div className="mt-10">
              <CountdownTimer
                deadline={`${config.deadlineYear}-12-31`}
                title={`Tid til frist for ${config.label}`}
              />
            </div>
          );
        }

        // Forside: vis den nærmeste bindende frist (kvælstof 2027).
        const nearest = PILLAR_CONFIGS.filter((p) => !NO_FIRM_DEADLINE.includes(p.id)).reduce(
          (a, b) => (b.deadlineYear < a.deadlineYear ? b : a),
        );
        return (
          <div className="mt-10">
            <CountdownTimer
              deadline={`${nearest.deadlineYear}-12-31`}
              title={`Næste frist — ${nearest.label}`}
            />
          </div>
        );
      })()}
    </section>
  );
}
