import { useMemo } from 'react';
import { Info } from 'lucide-react';
import type { ByPipelinePhaseRoot, CancelledMetrics, DriftFinansiering, PipelineMainPhase } from '@/lib/types';
import {
  PIPELINE_PHASE_CONFIGS,
  PIPELINE_CANCELLED_META,
  getPipelinePhaseConfig,
} from '@/lib/phase-config';

const PHASE_MAIN: PipelineMainPhase[] = [
  'sketch',
  'preliminary_grant',
  'preliminary_done',
  'establishment_grant',
  'established',
];

type PillarKey = 'nitrogen' | 'extraction' | 'afforestation';

const FIELD: Record<PillarKey, 'nitrogenT' | 'extractionHa' | 'afforestationHa'> = {
  nitrogen: 'nitrogenT',
  extraction: 'extractionHa',
  afforestation: 'afforestationHa',
};

function phaseMetric(
  root: ByPipelinePhaseRoot,
  pillar: PillarKey,
  phase: PipelineMainPhase,
): number {
  const row = root[pillar][phase];
  const f = FIELD[pillar];
  if (phase === 'sketch' && row.subStates) {
    return row.subStates.kladde[f] + row.subStates.ansoegt[f];
  }
  return row[f];
}

function phaseCount(
  root: ByPipelinePhaseRoot,
  pillar: PillarKey,
  phase: PipelineMainPhase,
): number {
  const row = root[pillar][phase];
  if (phase === 'sketch' && row.subStates) {
    return row.subStates.kladde.count + row.subStates.ansoegt.count;
  }
  return row.count;
}

export interface PhaseBreakdownProps {
  pillar: PillarKey;
  byPipelinePhase: ByPipelinePhaseRoot | undefined;
  cancelled: CancelledMetrics | undefined;
  driftFinansiering: DriftFinansiering | undefined;
  title?: string;
}

/**
 * Effekt/areal pr. DN/MARS-fase. ProjectFunnel is the canonical count-based
 * pipeline; this component shows the same phases weighted by the active metric.
 */
export function PhaseBreakdown({
  pillar,
  byPipelinePhase,
  cancelled,
  driftFinansiering,
  title = 'Effekt/areal fordelt på DNs 5 faser',
}: PhaseBreakdownProps) {
  const { segments, total, unitLabel, sketchDetail } = useMemo(() => {
    if (!byPipelinePhase) {
      return { segments: [] as { key: string; value: number; count: number; pct: number; color: string; label: string }[], total: 0, unitLabel: '', sketchDetail: null as null | { k: number; a: number; kc: number; ac: number } };
    }
    const f = FIELD[pillar];
    const unit =
      f === 'nitrogenT' ? 'ton N' : 'ha';
    const vals: { key: string; value: number; count: number; color: string; label: string }[] = [];
    for (const ph of PHASE_MAIN) {
      const v = phaseMetric(byPipelinePhase, pillar, ph);
      const count = phaseCount(byPipelinePhase, pillar, ph);
      const conf = getPipelinePhaseConfig(ph);
      vals.push({ key: ph, value: v, count, color: conf.hex, label: conf.shortLabel });
    }
    const t = vals.reduce((s, x) => s + x.value, 0);
    const segs = vals.map((x) => ({
      ...x,
      pct: t > 0 ? (x.value / t) * 100 : 0,
    }));
    const sk = byPipelinePhase[pillar].sketch;
    const kd = sk.subStates?.kladde?.[f] ?? 0;
    const an = sk.subStates?.ansoegt?.[f] ?? 0;
    const kc = sk.subStates?.kladde?.count ?? 0;
    const ac = sk.subStates?.ansoegt?.count ?? 0;
    return {
      segments: segs,
      total: t,
      unitLabel: unit,
      sketchDetail: t > 0 && (kd > 0 || an > 0 || kc > 0 || ac > 0) ? { k: kd, a: an, kc, ac } : null,
    };
  }, [byPipelinePhase, pillar]);

  if (!byPipelinePhase) {
    return null;
  }

  return (
    <section
      className="w-full max-w-5xl mx-auto px-4 py-6 border-t border-border/60"
      aria-labelledby="phase-breakdown-title"
    >
      <h3
        id="phase-breakdown-title"
        className="text-sm font-semibold text-foreground tracking-tight mb-1"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {title}
      </h3>
      <p className="text-xs text-muted-foreground mb-3 max-w-2xl">
        Samme administrative faser som projektlisten ovenfor, men vægtet efter MARS'
        {' '}{pillar === 'nitrogen' ? 'kvælstofeffekt' : pillar === 'extraction' ? 'udtagningsareal' : 'tilplantningsareal'}.
      </p>

      <div className="flex h-6 w-full max-w-3xl overflow-hidden rounded-md border border-border/40 shadow-sm">
        {segments.map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${s.value.toLocaleString('da-DK', { maximumFractionDigits: 1 })} ${unitLabel}, ${s.count.toLocaleString('da-DK')} projekter`}
            className="min-w-0 h-full min-w-[2px] transition-all duration-300"
            style={{
              flexGrow: Math.max(s.pct, 0.1),
              flexBasis: 0,
              background: `linear-gradient(180deg, ${s.color}cc 0%, ${s.color} 100%)`,
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        {PIPELINE_PHASE_CONFIGS.map((c) => {
          const seg = segments.find((x) => x.key === c.id);
          if (!seg) return null;
          return (
            <span key={c.id} className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.hex }} />
              {c.label}: {seg.value.toLocaleString('da-DK', { maximumFractionDigits: 1 })} {unitLabel}
              {' '}({seg.count.toLocaleString('da-DK')} projekter)
            </span>
          );
        })}
      </div>
      {sketchDetail && (
        <p className="text-[10px] text-muted-foreground mt-1">
          Skitse heraf: kladde {sketchDetail.k.toLocaleString('da-DK', { maximumFractionDigits: 1 })} {unitLabel}
          {' '}({sketchDetail.kc.toLocaleString('da-DK')} projekter) · ansøgt{' '}
          {sketchDetail.a.toLocaleString('da-DK', { maximumFractionDigits: 1 })} {unitLabel}
          {' '}({sketchDetail.ac.toLocaleString('da-DK')} projekter)
        </p>
      )}
      {cancelled && cancelled.totalCount > 0 && (
        <p className="text-[10px] mt-3 flex items-start gap-1.5 text-rose-800/90 dark:text-rose-200/90">
          <span
            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full"
            style={{ background: PIPELINE_CANCELLED_META.hex }}
            aria-hidden
          />
          <span>
            <span className="font-medium">Frafald (side-metrik): </span>
            {cancelled.totalCount.toLocaleString('da-DK')} projekter, ca. {cancelled.totalHa.toLocaleString('da-DK', { maximumFractionDigits: 1 })} ha
            (MARS: opgivet/afslag efter fase)
          </span>
        </p>
      )}

      {driftFinansiering && !driftFinansiering.afsat && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200/60 bg-amber-50/80 px-2.5 py-2 text-[10px] text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-100">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
          <p>
            <span className="font-semibold">Drift: </span>
            {driftFinansiering.label} ({driftFinansiering.sources.join(', ')}). Virkemidler efter 2030/2045
            følger ikke fuldt MARS’ projektdimension — vises ikke som pipeline-segmenter.
          </p>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/80 mt-2">
        Total i de 5 faser: {total.toLocaleString('da-DK', { maximumFractionDigits: 1 })} {unitLabel}
      </p>
      {pillar === 'afforestation' && (
        <p className="text-[10px] text-muted-foreground/80 mt-1">
          Forvaltningsplanstatus for natur-/skovprojekter: ukendt i MARS (datagap).
        </p>
      )}
    </section>
  );
}
