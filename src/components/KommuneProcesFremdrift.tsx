import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, TrendingUp } from 'lucide-react';
import { InfoTooltip } from '@/components/InfoTooltip';
import { formatDanishNumber } from '@/lib/format';
import { getPhaseConfig } from '@/lib/phase-config';
import {
  averageNeighborMetrics,
  buildComparisonKommuneGroups,
  computeKommuneProces,
  computeNationalProces,
  defaultComparisonKommune,
  listKommunerWithProcesData,
  type KommuneProcesMetrics,
} from '@/lib/kommune-proces';
import type { DashboardData, ProjectChangelog } from '@/lib/types';

interface KommuneProcesFremdriftProps {
  kommuneNavn: string;
  plans: DashboardData['plans'];
  changelog: ProjectChangelog | null;
  /** Nabokommuner med fælles kommunegrænse (DAWA). */
  borderNeighborNavne?: string[];
}

type PhaseBarData = {
  preliminary: number;
  approved: number;
  established: number;
  godkendtPlus: number;
};

const PHASE_BAR_ORDER = ['preliminary', 'approved', 'established'] as const;

function ProcesPhaseStackedBar({
  label,
  data,
  hideLabel = false,
}: {
  label: string;
  data: PhaseBarData;
  hideLabel?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {!hideLabel && (
        <span className="w-28 shrink-0 text-xs font-medium text-foreground truncate" title={label}>
          {label}
        </span>
      )}
      <div className={`${hideLabel ? 'w-full' : 'flex-1'} h-3.5 rounded-full bg-muted overflow-hidden flex`}>
        {PHASE_BAR_ORDER.map((ph) => {
          const cfg = getPhaseConfig(ph);
          return (
            <div
              key={ph}
              className="h-full transition-all duration-500"
              style={{ width: `${data[ph]}%`, backgroundColor: cfg.hex }}
              title={`${cfg.label}: ${formatDanishNumber(data[ph])}%`}
            />
          );
        })}
      </div>
      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {formatDanishNumber(data.godkendtPlus)}%
      </span>
    </div>
  );
}

function ProcesMetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      <p className="text-sm font-bold text-foreground tabular-nums leading-snug">{value}</p>
      {sub && (
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{sub}</p>
      )}
    </div>
  );
}

function toPhaseBarData(metrics: {
  faser: { preliminary: number; approved: number; established: number };
  godkendtPlus: number;
}): PhaseBarData {
  return {
    preliminary: metrics.faser.preliminary,
    approved: metrics.faser.approved,
    established: metrics.faser.established,
    godkendtPlus: metrics.godkendtPlus,
  };
}

/**
 * "Proces & fremdrift" — lokal pipeline-momentum, nabosammenligning og milepæle.
 */
export function KommuneProcesFremdrift({
  kommuneNavn,
  plans,
  changelog,
  borderNeighborNavne = [],
}: KommuneProcesFremdriftProps) {
  const data = useMemo(() => ({ plans }), [plans]);

  const own = useMemo(
    () => computeKommuneProces(data, kommuneNavn, undefined, changelog),
    [data, kommuneNavn, changelog],
  );

  const national = useMemo(
    () => computeNationalProces(data, undefined, changelog),
    [data, changelog],
  );

  const trepartNeighborMetricsMap = useMemo(() => {
    const map = new Map<string, KommuneProcesMetrics>();
    for (const navn of own.naboer) {
      map.set(navn, computeKommuneProces(data, navn, undefined, changelog));
    }
    return map;
  }, [data, own.naboer, changelog]);

  const trepartNeighborAvg = useMemo(
    () => averageNeighborMetrics([...trepartNeighborMetricsMap.values()]),
    [trepartNeighborMetricsMap],
  );

  const comparisonGroups = useMemo(() => {
    const allWithData = listKommunerWithProcesData(data);
    return buildComparisonKommuneGroups(kommuneNavn, allWithData, borderNeighborNavne);
  }, [data, kommuneNavn, borderNeighborNavne]);

  const hasComparisonOptions = comparisonGroups.border.length + comparisonGroups.other.length > 0;

  const defaultCompareNavn = useMemo(
    () => defaultComparisonKommune(
      comparisonGroups,
      (navn) => computeKommuneProces(data, navn, undefined, changelog),
    ),
    [comparisonGroups, data, changelog],
  );

  const [selectedCompareNavn, setSelectedCompareNavn] = useState<string | null>(null);
  const activeCompareNavn = selectedCompareNavn ?? defaultCompareNavn;

  const compareMetrics = useMemo(
    () => (activeCompareNavn
      ? computeKommuneProces(data, activeCompareNavn, undefined, changelog)
      : null),
    [data, activeCompareNavn, changelog],
  );

  useEffect(() => {
    setSelectedCompareNavn(null);
  }, [kommuneNavn]);

  const godkendtPlusDiff = compareMetrics
    ? own.godkendtPlus - compareMetrics.godkendtPlus
    : 0;

  const diffLabel = !compareMetrics
    ? undefined
    : godkendtPlusDiff === 0
      ? `som ${activeCompareNavn}`
      : `${godkendtPlusDiff > 0 ? '+' : ''}${formatDanishNumber(Math.round(godkendtPlusDiff))} pp ift. ${activeCompareNavn}`;

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <h3
              className="text-base font-bold text-foreground leading-snug"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              Proces &amp; fremdrift
            </h3>
            <InfoTooltip
              title="Lokal fremdrift"
              content={(
                <>
                  Andel af kommunens MARS-projekter i hver fase — målt i hektar, ikke antal.
                  Gennemsnitsbjælken «Trepart-naboer» er for kommuner i samme lokale trepart
                  (delt vandoplandsplan). Dropdown-sammenligningen bruger derimod grænsenaboer
                  (fælles kommunegrænse) først — ikke det samme som trepart.
                </>
              )}
              source="MARS projektdetaljer (SGAV)"
              articleLink="hvem-godkender-projekterne"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Hvor langt er projekterne i faserne — og hvordan ser det ud i forhold til grænsenaboer og landet?
          </p>
        </div>
      </header>

      {/* 1. Stacked phase bars */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Fasefordeling (hektar)
          </p>
          <p className="text-[10px] text-muted-foreground">Godkendt el. anlagt →</p>
        </div>
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          {PHASE_BAR_ORDER.map((ph) => {
            const cfg = getPhaseConfig(ph);
            return (
              <span key={ph} className="inline-flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-sm"
                  style={{ backgroundColor: cfg.hex }}
                />
                {cfg.label}
              </span>
            );
          })}
        </div>
        <div className="space-y-2">
          <ProcesPhaseStackedBar label={kommuneNavn} data={toPhaseBarData(own)} />
          {own.naboer.length > 0 && (
            <ProcesPhaseStackedBar
              label="Trepart-naboer gns."
              data={toPhaseBarData(trepartNeighborAvg)}
            />
          )}
          <ProcesPhaseStackedBar label="Landsplan" data={toPhaseBarData(national)} />
        </div>
      </div>

      {/* 2. Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <ProcesMetricCard
          label="Rykket en fase · 6 mdr"
          value={`${formatDanishNumber(own.momentum6mdr.projekter)} proj · ${formatDanishNumber(own.momentum6mdr.ha)} ha`}
          sub="Seneste faseaktivitet (antal og hektar)"
        />
        <ProcesMetricCard
          label="Median i forundersøgelse"
          value={own.medianMdr.preliminary != null
            ? `${formatDanishNumber(own.medianMdr.preliminary)} mdr`
            : '—'}
          sub={own.medianMdr.approved != null
            ? `Godkendt: ${formatDanishNumber(own.medianMdr.approved)} mdr`
            : undefined}
        />
        <ProcesMetricCard
          label="Godkendt el. anlagt"
          value={`${formatDanishNumber(own.godkendtPlus)}%`}
          sub={diffLabel}
        />
      </div>

      {/* 3. Milepæls-tidslinje */}
      {own.milepaele.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Seneste milepæle
          </p>
          <p className="text-[10px] text-muted-foreground mb-3">
            Projekt-tælling — seneste registrerede faseaktivitet pr. projekt
          </p>
          <ul className="space-y-2">
            {own.milepaele.map((m, i) => {
              const phaseCfg = getPhaseConfig(m.phase);
              return (
              <li
                key={`${m.navn}-${m.dato}-${i}`}
                className="flex items-start gap-2 text-xs"
              >
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {m.dato}
                </span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${phaseCfg.badge}`}>
                  {m.label}
                </span>
                <span className="text-foreground leading-snug min-w-0">
                  <span className="font-medium">{m.navn}</span>
                  <span className="text-muted-foreground"> · {m.measure}</span>
                </span>
              </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 4. Nabosammenligning */}
      {hasComparisonOptions && (
        <div className="rounded-xl border border-border/80 bg-muted/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={2} />
            <p className="text-sm font-semibold text-foreground">Nabosammenligning</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Sammenlign med enhver kommune — grænsenaboer (fælles kommunegrænse) vises først.
            Bjælken «Trepart-naboer gns.» ovenfor er et andet begreb: gennemsnit for kommuner
            i samme lokale trepart (fx kan Horsens og Odense dele plan, uden at være grænsenaboer).
          </p>
          <label className="block mb-4">
            <span className="text-xs font-medium text-muted-foreground mb-1 block">Sammenlign med</span>
            <select
              value={activeCompareNavn ?? ''}
              onChange={(e) => setSelectedCompareNavn(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {comparisonGroups.border.length > 0 && (
                <optgroup label="Grænsenaboer">
                  {comparisonGroups.border.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </optgroup>
              )}
              {comparisonGroups.other.length > 0 && (
                <optgroup label="Øvrige kommuner">
                  {comparisonGroups.other.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          {compareMetrics && activeCompareNavn && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {kommuneNavn}
                </p>
                <ProcesPhaseStackedBar label="" data={toPhaseBarData(own)} hideLabel />
                <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                  <p>Momentum: {formatDanishNumber(own.momentum6mdr.projekter)} proj · {formatDanishNumber(own.momentum6mdr.ha)} ha</p>
                  <p>Godkendt+: {formatDanishNumber(own.godkendtPlus)}%</p>
                  {own.mix.length > 0 && (
                    <p>Mix: {own.mix.map((m) => `${m.measure} ${m.pct}%`).join(' · ')}</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {activeCompareNavn}
                </p>
                <ProcesPhaseStackedBar label="" data={toPhaseBarData(compareMetrics)} hideLabel />
                <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                  <p>Momentum: {formatDanishNumber(compareMetrics.momentum6mdr.projekter)} proj · {formatDanishNumber(compareMetrics.momentum6mdr.ha)} ha</p>
                  <p>Godkendt+: {formatDanishNumber(compareMetrics.godkendtPlus)}%</p>
                  {compareMetrics.mix.length > 0 && (
                    <p>Mix: {compareMetrics.mix.map((m) => `${m.measure} ${m.pct}%`).join(' · ')}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Forbeholds-boks */}
      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <BookOpen className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" strokeWidth={2} />
        <div className="leading-relaxed space-y-2">
          <p>
            Tilsagn gives af SGAV, ikke kommunen. Tempoet afhænger også af styrelsens sagsbehandling
            og lodsejernes frivillighed — kommunen er én aktør i kæden, ikke den der godkender projekterne.
          </p>
          <p>
            Projektantal og hektar kan pege hver sin vej: en kommune med mange små projekter kan
            have høj tælling men lav hektar-andel i senere faser, og omvendt.
          </p>
          <p>
            Identisk median-tid på tværs af kommuner tyder ofte på fælles SGAV-kadence i sagsbehandling,
            ikke lokal kapacitet alene.
          </p>
          <Link
            to="/videnscenter/hvem-godkender-projekterne"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Læs mere i Videnscenter
          </Link>
        </div>
      </div>
    </div>
  );
}
