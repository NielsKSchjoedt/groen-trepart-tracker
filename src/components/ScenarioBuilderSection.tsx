import { useState, useEffect } from 'react';
import { AlertTriangle, GitPullRequestArrow, Leaf, Shield, TrendingUp } from 'lucide-react';
import { HintCallout } from './HintCallout';
import { CountdownProjection } from './CountdownProjection';
import { InfoTooltip } from './InfoTooltip';
import { getPillarProjectionData } from '@/lib/projections';
import { usePillar } from '@/lib/pillars';
import { loadCO2Emissions } from '@/lib/data';
import { formatDanishNumber } from '@/lib/format';
import { useFirstVisitHint } from '@/hooks/useFirstVisitHint';
import type { DashboardData, CO2EmissionsData } from '@/lib/types';

interface ScenarioBuilderSectionProps {
  data: DashboardData;
}

const NATURE_ACCENT = '#166534';
const TARGET_PCT = 20;

/**
 * Compact bar showing a single component's percentage against the 20% target.
 *
 * @param pct - Component's percentage of Danish land area
 * @param color - Bar fill color
 * @param label - Danish label for the component
 * @param detail - Additional detail text (area, feature count)
 */
function NatureComponentBar({ pct, color, label, detail }: {
  pct: number;
  color: string;
  label: string;
  detail: string;
}) {
  const barPct = Math.min((pct / TARGET_PCT) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{formatDanishNumber(pct, 1)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${barPct}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground leading-tight">{detail}</p>
    </div>
  );
}

/**
 * Nature-specific fallback card shown instead of the scenario builder
 * when nature is the active pillar. Displays the component breakdown
 * (Natura 2000, §3, combined estimate), the gap to the 20% target,
 * and an explanation of why there is no projection.
 *
 * @param data - Full dashboard data with nature progress fields
 */
function NatureStatusCard({ data }: { data: DashboardData }) {
  const { progress } = data.national;
  const combined = progress.natureProtectedPct;
  const natura2000 = progress.natura2000TerrestrialPct;
  const section3 = progress.section3Pct;
  const gapPct = TARGET_PCT - combined;
  const denmarkKm2 = 42_951;
  const gapKm2 = Math.round((gapPct / 100) * denmarkKm2);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4" style={{ color: NATURE_ACCENT }} />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Beskyttet natur — status
        </span>
        <InfoTooltip
          title="Hvordan måles beskyttet natur?"
          content={
            <>
              <p><strong>Målet er 20% juridisk beskyttet landareal inden 2030</strong> — via Natura 2000-udpegning, §3-registrering under Naturbeskyttelsesloven og nye naturnationalparker.</p>
              <p>Natura 2000 og §3 overlapper ca. 30%, så tallene kan ikke lægges sammen direkte. Det kombinerede estimat på ~{formatDanishNumber(combined, 1)}% stammer fra OECD 2024.</p>
              <p>I modsætning til de andre delmål sker fremskridt her ikke via en projektpipeline, men via politiske beslutninger om arealdesignering.</p>
            </>
          }
          source="OECD 2024 / Natura 2000-registret / §3-registret (Miljøstyrelsen)"
          size={12}
          side="right"
        />
      </div>

      <div className="space-y-3 mb-5">
        <NatureComponentBar
          pct={natura2000}
          color="#2563eb"
          label="Natura 2000 (terrestrisk)"
          detail="EU-habitat- og fuglebeskyttelsesområder — 250 udpegede arealer"
        />
        <NatureComponentBar
          pct={section3}
          color="#059669"
          label="§3-beskyttet natur"
          detail="Søer, vandløb, heder, moser, enge m.fl. — 186.628 registreringer"
        />
      </div>

      {/* Combined + gap */}
      <div className="rounded-lg bg-muted/40 p-3 mb-4 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-foreground">Kombineret estimat</span>
          <span className="text-lg font-bold tabular-nums" style={{ color: NATURE_ACCENT, fontFamily: "'Fraunces', serif" }}>
            ~{formatDanishNumber(combined, 1)}%
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden relative">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min((combined / TARGET_PCT) * 100, 100)}%`, backgroundColor: NATURE_ACCENT }}
          />
          {/* 20% target marker */}
          <div className="absolute top-0 bottom-0 right-0 w-px bg-foreground/30" />
        </div>
        <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
          <span>Korrigeret for ~30% overlap mellem Natura 2000 og §3</span>
          <span className="tabular-nums font-medium">Mål: {TARGET_PCT}%</span>
        </div>
      </div>

      {/* Gap indicator */}
      <div className="flex items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/30 px-3 py-2.5 mb-4">
        <Leaf className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <p className="text-xs text-amber-800 dark:text-amber-200">
          <span className="font-semibold">~{formatDanishNumber(gapPct, 1)} procentpoint mangler</span>
          {' '}— svarende til ca. {formatDanishNumber(gapKm2)} km² yderligere beskyttet areal
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Naturbeskyttelse ændres gennem politiske beslutninger om arealdesignering (Natura 2000-udpegning, §3-registrering, naturnationalparker) — ikke via en løbende projektpipeline som de andre delmål.
        Derfor er der ingen lineær fremskrivning eller scenariebygger for dette delmål.
      </p>

      <div className="flex items-center gap-1.5 mt-3 text-[10px] text-muted-foreground">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: NATURE_ACCENT + '80' }} />
        <span>Kilde: OECD 2024 / Natura 2000-registret / §3-registret (Miljøstyrelsen)</span>
      </div>
    </div>
  );
}

/**
 * Standalone section rendering the countdown timer and scenario builder card.
 * Positioned below the pillar status cards so users first see the summary,
 * then can drill into projections and what-if scenarios.
 *
 * For the nature pillar (which has no meaningful projection), renders a
 * dedicated NatureStatusCard instead with component breakdown and gap analysis.
 *
 * @param data - Full dashboard data including pipeline scenarios
 */
export function ScenarioBuilderSection({ data }: ScenarioBuilderSectionProps) {
  const { activePillar, config } = usePillar();
  const scenarioHint = useFirstVisitHint('scenario-builder', 15_000);

  const [co2Data, setCo2Data] = useState<CO2EmissionsData | null>(null);
  useEffect(() => {
    loadCO2Emissions().then(setCo2Data);
  }, []);

  const projectionData = getPillarProjectionData(activePillar, data, co2Data);
  const klim = data.national.klimaraadet;
  const klimVurdering =
    activePillar === 'extraction' || activePillar === 'afforestation'
      ? klim?.vurderinger[activePillar]
      : undefined;

  if (!projectionData) {
    if (activePillar === 'nature') {
      return (
        <section className="w-full max-w-5xl mx-auto px-4 py-10">
          <div className="flex items-center gap-2.5 mb-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
              Naturbeskyttelse: status og mål
            </h2>
            <InfoTooltip
              title="Hvorfor ingen scenariebygger?"
              content={
                <>
                  <p>Naturbeskyttelse ændres gennem politiske beslutninger om arealdesignering — ikke via en projektpipeline som de andre delmål.</p>
                  <p>Derfor viser vi i stedet en statusoversigt over de eksisterende beskyttelseskategorier og afstanden til 20%-målet.</p>
                </>
              }
              side="right"
            />
          </div>
          <p className="text-sm text-muted-foreground mb-8">
            Hvor langt er vi fra 20% juridisk beskyttet landareal?
          </p>
          <NatureStatusCard data={data} />
        </section>
      );
    }

    return (
      <section className="w-full px-4 py-6">
        <div className="max-w-lg mx-auto">
          <div className="rounded-xl border border-border p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground">
              {config.stubMessage || `${config.label}: Ingen kvantitativ fremskrivning tilgængelig endnu`}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2.5 mb-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
          {activePillar === 'co2' ? 'CO₂: Klimafremskrivning' : `Fremskrivning: ${config.label}`}
        </h2>
        <InfoTooltip
          title={activePillar === 'co2' ? 'CO₂ — hvad vises her?' : 'Fremskrivning — hvad nu hvis?'}
          content={
            activePillar === 'co2' ? (
              <>
                <p>CO₂-tallene stammer fra <strong>KF25 — Klimastatus og -fremskrivning 2025</strong> (Klima-, Energi- og Forsyningsministeriet), ikke fra MARS-projektdata.</p>
                <p>Den viste prognose er regeringens officielle fremskrivning af, at Danmark opnår ~{projectionData.projectedOverride ?? ''}% reduktion i 2030 ift. 1990-niveau. Klimaloven kræver 70%.</p>
                <p>Der er ingen projektpipeline for CO₂ — implementeringen sker via afgifter, regulering og sektortiltag, ikke via individuelle MARS-projekter.</p>
              </>
            ) : (
              <>
                <p>Projekter gennemgår en lang pipeline (skitse → forundersøgelse → godkendelse → anlæg), og der forventes en <em>naturlig acceleration</em> efterhånden som flere projekter modnes.</p>
                <p>Scenariebyggeren lader dig simulere: <strong>hvad hvis alle godkendte eller forundersøgte projekter var anlagt i dag?</strong> Vælg en fase i dropdown-menuen for at se, hvordan prognosen ændrer sig.</p>
              </>
            )
          }
          side="right"
        />
      </div>
      <p className={`text-sm text-muted-foreground ${activePillar === 'co2' ? 'mb-4' : 'mb-8'}`}>
        {activePillar === 'co2'
          ? 'Fremskrivning baseret på KF25-rapporten — viser Danmarks samlede drivhusgasudledning mod 2030-målet'
          : `Prognose baseret på faktiske MARS-projektdata. Vælg nedenfor hvilke projektstadier der medregnes, og se hvordan ${config.label.toLowerCase()}-målet påvirkes.`}
      </p>

      {activePillar === 'co2' && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/70 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/40 px-4 py-3 mb-8">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1.5 leading-relaxed">
            <p><span className="font-semibold">Ingen data på konkrete projekter.</span> CO₂-fremgangen er ikke sporet via individuelle MARS-projekter som de øvrige delmål. Informationen her er udelukkende baseret på <strong>KF25 — Klimastatus og -fremskrivning 2025</strong> (KEFM), der er en modelbaseret national fremskrivning.</p>
            <p>Størstedelen af CO₂-reduktionen kommer desuden fra sektorer som energi og industri — <span className="font-medium">ikke direkte fra Den Grønne Treparts initiativer</span>. Aftalen adresserer primært landbrug og LULUCF (arealanvendelse og skov), som kun udgør en del af den samlede nationale udledning.</p>
          </div>
        </div>
      )}
      <div className="relative">
        {scenarioHint.visible && activePillar !== 'co2' && (
          <HintCallout
            icon={GitPullRequestArrow}
            text="Klik på et projektstadium nedenfor og se prognosen ændre sig"
            arrow="left"
            onDismiss={scenarioHint.dismiss}
            className="absolute left-1/2 -translate-x-1/2 -top-2 sm:left-auto sm:translate-x-0 sm:right-3"
          />
        )}
        <CountdownProjection
        deadline={projectionData.deadline}
        achieved={projectionData.achieved}
        target={projectionData.target}
        unit={projectionData.unit}
        accentColor={projectionData.accentColor}
        trackingStart="2024-01-01"
        projectedOverride={projectionData.projectedOverride}
        scenarios={projectionData.scenarios}
        pillarLabel={config.label}
        pillarColor={config.accentColor}
        klimaraadetVurdering={klimVurdering}
        klimaraadetRapportUrl={klim?.url}
      />
      </div>
    </section>
  );
}
