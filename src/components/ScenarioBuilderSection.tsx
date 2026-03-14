import { useState, useEffect } from 'react';
import { FlaskConical, Leaf, Shield } from 'lucide-react';
import { CountdownProjection } from './CountdownProjection';
import { InfoTooltip } from './InfoTooltip';
import { getPillarProjectionData } from '@/lib/projections';
import { usePillar } from '@/lib/pillars';
import { loadCO2Emissions } from '@/lib/data';
import { formatDanishNumber } from '@/lib/format';
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
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm max-w-lg">
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

  const [co2Data, setCo2Data] = useState<CO2EmissionsData | null>(null);
  useEffect(() => {
    loadCO2Emissions().then(setCo2Data);
  }, []);

  const projectionData = getPillarProjectionData(activePillar, data, co2Data);

  if (!projectionData) {
    if (activePillar === 'nature') {
      return (
        <section className="w-full max-w-4xl mx-auto px-4 py-10">
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
    <section className="w-full max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2.5 mb-2">
        <FlaskConical className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
          Scenariebygger: {config.label}
        </h2>
        <InfoTooltip
          title="Scenariebygger — hvad nu hvis?"
          content={
            <>
              <p>Projekter gennemgår en lang pipeline (skitse → forundersøgelse → godkendelse → anlæg), og der forventes en <em>naturlig acceleration</em> efterhånden som flere projekter modnes.</p>
              <p>Scenariebyggeren lader dig simulere: <strong>hvad hvis alle godkendte eller forundersøgte projekter var anlagt i dag?</strong> Vælg en fase i dropdown-menuen for at se, hvordan prognosen ændrer sig.</p>
              <p>For CO₂ bruges KF25-klimafremskrivningen og har ingen pipeline-scenarier.</p>
            </>
          }
          side="right"
        />
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        Hvad nu hvis? — simulér {config.label.toLowerCase()}-fremskridtet med flere projektfaser
      </p>
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
      />
    </section>
  );
}
