import { AlertTriangle, GitPullRequestArrow, Shield, TrendingUp } from 'lucide-react';
import { HintCallout } from './HintCallout';
import { InfoTooltip } from './InfoTooltip';
import { FremskrivningCard } from './fremskrivning/FremskrivningCard';
import { Co2ProjectionCard } from './fremskrivning/Co2ProjectionCard';
import { usePillar } from '@/lib/pillars';
import { formatDanishNumber } from '@/lib/format';
import { useFirstVisitHint } from '@/hooks/useFirstVisitHint';
import type { DashboardData } from '@/lib/types';
import type { FremskrivningPillarId } from '@/lib/fremskrivning';

interface ScenarioBuilderSectionProps {
  data: DashboardData;
}

const NATURE_ACCENT = '#166534';
const TARGET_PCT = 20;

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
          <div className="absolute top-0 bottom-0 right-0 w-px bg-foreground/30" />
        </div>
        <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
          <span>Korrigeret for ~30% overlap mellem Natura 2000 og §3</span>
          <span className="tabular-nums font-medium">Mål: {TARGET_PCT}%</span>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/30 px-3 py-2.5 mb-4">
        <span className="text-xs text-amber-800 dark:text-amber-200">
          <span className="font-semibold">~{formatDanishNumber(gapPct, 1)} procentpoint mangler</span>
          {' '}— svarende til ca. {formatDanishNumber(gapKm2)} km² yderligere beskyttet areal
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Naturbeskyttelse ændres gennem politiske beslutninger om arealdesignering — ikke via en løbende projektpipeline som de andre delmål.
        Derfor er der ingen fremskrivning eller scenariebygger for dette delmål.
      </p>
    </div>
  );
}

function Kf26TrepartNote({ data, pillar }: { data: DashboardData; pillar: 'extraction' | 'afforestation' }) {
  const kf26 = data.national.kf26;
  if (!kf26) return null;

  if (pillar === 'extraction') {
    const risk = data.national.klimaraadet?.baggrundsnotatTrepart?.kvantitative;
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-sky-200/70 bg-sky-50/60 px-4 py-3 mb-6 text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100">
        <AlertTriangle className="w-4 h-4 text-sky-700 dark:text-sky-300 flex-shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed space-y-1.5">
          <p>
            <span className="font-semibold">KF26-definitionsnote:</span> KF26 opgør {formatDanishNumber(kf26.lavbundStatusDec2025.underUdtagningHa)} ha kulstofrig lavbund inkl. randarealer som “under udtagning” pr. december 2025. MARS-tallet her er bredere og tæller projektpipeline på tværs af ordninger og faser.
          </p>
          <p>
            Det politiske mål er stadig 140.000 ha i 2030, men KF26 modellerer projektarealet frem mod {kf26.targetsAndHorizons.kf26ExtractionProjectAreaHorizon} og de 70.000 ha kulstofrig jord frem mod {kf26.targetsAndHorizons.kf26ExtractionCarbonRichHorizon}.
            {risk ? ` Klimarådet vurderer, at nuværende afgift på ${risk.nuvAfgiftKrPrTon} kr./ton kun giver ca. ${formatDanishNumber(risk.lavbundRealiseretVedNuvAfgiftHa)} ha kulstofrig lavbund, mod ${formatDanishNumber(risk.lavbundRealiseretVedAnbefaletAfgiftHa)} ha ved ${risk.anbefaletAfgiftKrPrTon} kr./ton.` : null}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200/70 bg-emerald-50/60 px-4 py-3 mb-6 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
      <AlertTriangle className="w-4 h-4 text-emerald-700 dark:text-emerald-300 flex-shrink-0 mt-0.5" />
      <div className="text-xs leading-relaxed space-y-1.5">
        <p>
          <span className="font-semibold">KF26-definitionsnote:</span> KF26 antager nu, at skov plantes 2-3 år efter tilsagn. Derfor slutter den modellerede trepart-skovrejsning i {kf26.targetsAndHorizons.kf26AfforestationRealizationHorizon}, selv om det politiske mål stadig er 250.000 ha inden 2045.
        </p>
        <p>
          Tabel 3.1 i KF26 giver en årlig profil på ca. {formatDanishNumber(kf26.skovProfilSummary.sumNewInitiativesHa)} ha nye initiativer i 2025-2047. Profilen bruges her som officiel forventet tempo-reference, ikke som faktisk realiseret MARS-data.
        </p>
      </div>
    </div>
  );
}

const PIPELINE_PILLARS: FremskrivningPillarId[] = ['nitrogen', 'extraction', 'afforestation'];

export function ScenarioBuilderSection({ data }: ScenarioBuilderSectionProps) {
  const { activePillar, config } = usePillar();
  const scenarioHint = useFirstVisitHint('scenario-builder', 15_000);

  if (activePillar === 'nature') {
    return (
      <section className="w-full max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center gap-2.5 mb-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
            Naturbeskyttelse: status og mål
          </h2>
          <InfoTooltip
            title="Hvorfor ingen fremskrivning?"
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

  if (activePillar === 'co2') {
    return (
      <section className="w-full max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center gap-2.5 mb-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
            CO₂: Klimafremskrivning
          </h2>
          <InfoTooltip
            title="CO₂ — hvad vises her?"
            content={
              <>
                <p>CO₂-grafen stammer fra <strong>KF25 — Klimastatus og -fremskrivning 2025</strong> (Klima-, Energi- og Forsyningsministeriet).</p>
                <p>Der er ingen projektpipeline for CO₂ — implementeringen sker via afgifter, regulering og sektortiltag.</p>
              </>
            }
            side="right"
          />
        </div>
        <p className="text-sm text-muted-foreground mb-8">
          Detaljeret fremskrivning baseret på KF25 — suppleret med KF26’s nye hovedkonklusion om en meget lille 2030-margin
        </p>
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/70 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/40 px-4 py-3 mb-8 max-w-3xl mx-auto">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1.5 leading-relaxed">
            <p><span className="font-semibold">Blandet KF-grundlag.</span> Den detaljerede CO₂-graf bruger stadig <strong>KF25</strong>. KF26-høringsversionen viser, at regeringens 2030-margin er faldet fra ca. 1,5 til ca. 0,4 mio. ton CO₂e.</p>
          </div>
        </div>
        <Co2ProjectionCard />
      </section>
    );
  }

  if (!activePillar || !PIPELINE_PILLARS.includes(activePillar as FremskrivningPillarId)) {
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

  const pillar = activePillar as FremskrivningPillarId;

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2.5 mb-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
          Fremskrivning: {config.label}
        </h2>
        <InfoTooltip
          title="Fremskrivning — hvor langt rækker det?"
          content={
            <>
              <p>Projekter modnes trin for trin — fra skitse til gennemført. Kun gennemførte projekter tæller i den faktiske fremdrift.</p>
              <p>Fremskrivningen viser to ting på én gang: <strong>kursen</strong> (det faktiske tempo, lineært forlænget) og <strong>rækkevidden</strong> (hvor langt pipelinen rækker, hvis du tror flere stadier realiseres).</p>
            </>
          }
          side="right"
        />
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        Prognose baseret på faktiske MARS-projektdata. Vælg hvilke projektstadier du tror bliver til virkelighed — og se hvordan {config.label.toLowerCase()}-målet påvirkes.
      </p>

      {(pillar === 'extraction' || pillar === 'afforestation') && (
        <div className="max-w-3xl mx-auto">
          <Kf26TrepartNote data={data} pillar={pillar} />
        </div>
      )}

      <div className="relative">
        {scenarioHint.visible && (
          <HintCallout
            icon={GitPullRequestArrow}
            text="Tænd for pipeline-stadier og se kurs vs. rækkevidde i grafen"
            arrow="left"
            onDismiss={scenarioHint.dismiss}
            className="absolute left-1/2 -translate-x-1/2 -top-2 sm:left-auto sm:translate-x-0 sm:right-3"
          />
        )}
        <FremskrivningCard data={data} pillar={pillar} />
      </div>
    </section>
  );
}
