import type { EffectDomain, EffectDomainId, MeasureId, EffectReframe } from '@/lib/model';
import type { PillarId } from '@/lib/pillars';
import type { KlimaraadetData } from '@/lib/types';
import { GOAL_STATUS_META } from '@/lib/projections';
import { Check, AlertTriangle } from 'lucide-react';
import { KlimaraadetBadge } from './KlimaraadetBadge';

interface EffectRowProps {
  domains: EffectDomain[];
  /** Directly selected/hovered effect (gets the ring) */
  activeDomain: EffectDomainId | null;
  /** Active measure — used to keep the effects it feeds highlighted */
  activeMeasure: MeasureId | null;
  /** Effects fed by the active measure; null when no measure is active */
  highlightedDomains: Set<EffectDomainId> | null;
  /** Pillar currently driving the page content — its card stays permanently selected */
  selectedPillar: PillarId | null;
  klimaraadet?: KlimaraadetData;
  onHover: (id: EffectDomainId | null) => void;
  /** Navigate to the matching pillar detail page */
  onSelect: (pillarId: PillarId) => void;
}

const NEUTRAL_LIGHT = '#B4B2A9';
const ATTRIBUTION_ACCENT = '#b45309';
/** CO₂-bjælke: resten af økonomien (mørkere grå) vs trepartens del der mangler (lysere grå). */
const REST_GREY = '#888780';
const TREPART_GREY = '#CFCDC4';

function VerdictPill({ label, color, className = '' }: { label: string; color: string; className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] font-semibold ${className}`}
      style={{ color }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function CaveatBox({ text }: { text: string }) {
  return (
    <p className="mt-2 flex items-start gap-1 rounded-md bg-muted/50 px-2 py-1.5 text-[9px] leading-snug text-muted-foreground">
      <AlertTriangle className="mt-px h-2.5 w-2.5 shrink-0 text-amber-600" strokeWidth={2} aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/** Natur: vis kun det aftalen skal flytte (mål − baseline). */
function BaselineGapBody({ r, accent }: { r: Extract<EffectReframe, { kind: 'baseline-gap' }>; accent: string }) {
  const baseW = Math.min(100, (r.baselinePct / r.targetPct) * 100);
  const deltaW = Math.max(0, Math.min(100 - baseW, ((r.currentPct - r.baselinePct) / r.targetPct) * 100));
  return (
    <>
      <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
        Aftalen skal hæve beskyttet natur fra{' '}
        <span className="font-semibold text-foreground">{r.baselinePct.toLocaleString('da-DK')}%</span> til{' '}
        <span className="font-semibold text-foreground">{r.targetPct}%</span> i {r.deadlineYear}.
      </p>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        <div style={{ width: `${baseW}%`, backgroundColor: NEUTRAL_LIGHT }} />
        <div style={{ width: `${deltaW}%`, backgroundColor: accent }} />
      </div>
      <div className="mb-2.5 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9px] text-muted-foreground">
        <LegendDot color={NEUTRAL_LIGHT} label="fandtes ved underskrift" />
        <LegendDot color={accent} label="tilføjet siden 2024" />
        <span className="ml-auto">mål {r.targetPct}%</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-2xl font-black tabular-nums"
          style={{ fontFamily: "'Fraunces', serif", color: GOAL_STATUS_META.behind.color }}
        >
          {r.deltaHeadline}
        </span>
        <span className="text-[10px] leading-tight text-muted-foreground">{r.deltaSub}</span>
      </div>
      <CaveatBox text={r.caveat} />
    </>
  );
}

/** CO₂: hele reduktionen som ét spor — resten af økonomien, trepartens del der
 *  mangler, og den lille del treparten reelt har anlagt. */
function AttributionBody({ r }: { r: Extract<EffectReframe, { kind: 'attribution' }> }) {
  const rest = Math.max(0, Math.min(100, r.restPct));
  const delivered = Math.max(0, Math.min(100, r.deliveredPct));
  return (
    <>
      <p className="mb-2.5 text-[11px] leading-snug text-muted-foreground">{r.contextLine}</p>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        <div style={{ width: `${rest}%`, backgroundColor: REST_GREY }} />
        <div style={{ width: `${delivered}%`, minWidth: delivered > 0 ? 3 : 0, backgroundColor: ATTRIBUTION_ACCENT }} />
        <div className="flex-1" style={{ backgroundColor: TREPART_GREY }} />
      </div>
      <div className="mb-2.5 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9px] text-muted-foreground">
        <LegendDot color={REST_GREY} label="energi & industri" />
        <LegendDot color={TREPART_GREY} label="treparten mangler" />
        <LegendDot color={ATTRIBUTION_ACCENT} label="leveret" />
        <span className="ml-auto">{r.totalLabel}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-2xl font-black leading-none tabular-nums"
          style={{ fontFamily: "'Fraunces', serif", color: GOAL_STATUS_META.behind.color }}
        >
          {r.headline}
        </span>
        <span className="text-[10px] leading-tight text-muted-foreground">{r.headlineSub}</span>
      </div>
      <CaveatBox text={r.caveat} />
    </>
  );
}

/** Vandmiljø: VP3-økologisk tilstand for kystvande — ikke kvælstof-delmålet. */
function EcologicalSnapshotBody({
  d,
  r,
}: {
  d: EffectDomain;
  r: Extract<EffectReframe, { kind: 'ecological-snapshot' }>;
}) {
  const meta = GOAL_STATUS_META[d.status];
  return (
    <>
      <p className="mb-1.5 text-[11px] leading-snug text-muted-foreground">{d.means}</p>
      <p className="mb-2 text-[10px] leading-snug text-muted-foreground">{r.how}</p>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-2xl font-black leading-none tabular-nums"
          style={{ fontFamily: "'Fraunces', serif", color: meta.color }}
        >
          {d.valueText}
        </span>
        <span className="text-[10px] leading-tight text-muted-foreground">{r.valueLabel}</span>
      </div>
      {r.distributionLine && (
        <p className="mt-2 text-[9px] leading-snug text-muted-foreground">{r.distributionLine}</p>
      )}
      <p className="mt-1.5 text-[9px] italic leading-snug text-muted-foreground">{r.note}</p>
      <p className="mt-2.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {d.goalFooter}
      </p>
    </>
  );
}

/** Legacy progress body — reserved if another domain uses kind: 'progress'. */
function ProgressBody({ d }: { d: EffectDomain }) {
  const meta = GOAL_STATUS_META[d.status];
  const r = d.reframe.kind === 'progress' ? d.reframe : null;
  return (
    <>
      <p className="mb-1.5 text-[11px] leading-snug text-muted-foreground">{d.means}</p>
      {r && <p className="mb-2 text-[10px] leading-snug text-muted-foreground">{r.how}</p>}
      <p
        className="text-2xl font-black leading-none tabular-nums"
        style={{ fontFamily: "'Fraunces', serif", color: meta.color }}
      >
        {d.valueText}
      </p>
      {r && <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{r.valueLabel}</p>}
      {r && <p className="mt-1.5 text-[9px] italic leading-snug text-muted-foreground">{r.note}</p>}
      <p className="mt-2.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {d.goalFooter}
      </p>
    </>
  );
}

export function EffectRow({
  domains,
  activeDomain,
  activeMeasure,
  highlightedDomains,
  selectedPillar,
  klimaraadet,
  onHover,
  onSelect,
}: EffectRowProps) {
  const anyActive = activeMeasure !== null || activeDomain !== null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {domains.map((d) => {
        const Icon = d.icon;
        const isDelmaal = d.isDelmaal !== false;
        const isSelected = isDelmaal && selectedPillar !== null && d.pillarId === selectedPillar;
        const isFocused = activeDomain === d.id;
        const isHighlighted = highlightedDomains?.has(d.id) ?? false;
        const dimmed = anyActive && !isFocused && !isHighlighted && !isSelected;
        const vurdering = klimaraadet?.vurderinger[d.pillarId];

        const verdict =
          d.reframe.kind === 'baseline-gap'
            ? { label: d.reframe.verdictLabel, color: GOAL_STATUS_META.behind.color }
            : d.reframe.kind === 'attribution'
              ? { label: d.reframe.verdictLabel, color: ATTRIBUTION_ACCENT }
              : d.reframe.kind === 'ecological-snapshot'
                ? { label: d.reframe.verdictLabel, color: GOAL_STATUS_META[d.status].color }
                : { label: GOAL_STATUS_META[d.status].label, color: GOAL_STATUS_META[d.status].color };

        return (
          <div
            key={d.id}
            role={isDelmaal ? 'button' : undefined}
            tabIndex={isDelmaal ? 0 : undefined}
            aria-label={isDelmaal ? `${d.label} — se detaljer` : `${d.label} — effekt, ikke et delmål`}
            aria-pressed={isDelmaal ? isSelected : undefined}
            className={`flex flex-col overflow-hidden rounded-xl border px-4 py-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isDelmaal ? 'cursor-pointer hover:shadow-md' : 'cursor-default border-dashed opacity-75 saturate-[0.45]'
            } ${
              isSelected || isFocused ? 'shadow-md' : 'border-border shadow-sm'
            } ${dimmed ? 'opacity-35' : isDelmaal ? 'opacity-100' : 'opacity-75'}`}
            style={{
              backgroundColor: isDelmaal ? 'hsl(210 25% 97%)' : 'hsl(210 10% 93%)',
              ...(isSelected
                ? { borderColor: d.accent, borderWidth: 2, boxShadow: `0 0 0 3px ${d.accent}33` }
                : isFocused
                  ? { borderColor: d.accent, borderWidth: 2 }
                  : {}),
            }}
            onMouseEnter={() => onHover(d.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={isDelmaal ? () => onHover(d.id) : undefined}
            onBlur={isDelmaal ? () => onHover(null) : undefined}
            onClick={isDelmaal ? () => onSelect(d.pillarId) : undefined}
            onKeyDown={
              isDelmaal
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(d.pillarId);
                    }
                  }
                : undefined
            }
          >
            <div
              className="-mx-4 -mt-4 mb-3 px-4 pb-2.5 pt-3"
              style={{ backgroundColor: isDelmaal ? `${d.accent}14` : 'transparent' }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: isDelmaal ? `${d.accent}29` : d.accent + '18' }}
                >
                  <Icon className="h-4 w-4" style={{ color: d.accent }} strokeWidth={2} />
                </div>
                {!isDelmaal ? (
                  <span className="ml-auto shrink-0 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {d.effectBadge ?? 'Ikke målsat'}
                  </span>
                ) : isSelected ? (
                  <span
                    className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                    style={{ backgroundColor: d.accent, color: 'white' }}
                  >
                    <Check className="h-2.5 w-2.5" strokeWidth={3} /> Valgt
                  </span>
                ) : (
                  <VerdictPill label={verdict.label} color={verdict.color} className="ml-auto" />
                )}
              </div>
              <h3
                className="mt-1.5 text-[13px] font-semibold leading-tight text-foreground"
                style={isDelmaal ? { color: `color-mix(in srgb, ${d.accent} 78%, black)` } : undefined}
              >
                {d.label}
              </h3>
            </div>

            {d.reframe.kind === 'baseline-gap' ? (
              <BaselineGapBody r={d.reframe} accent={d.accent} />
            ) : d.reframe.kind === 'attribution' ? (
              <AttributionBody r={d.reframe} />
            ) : d.reframe.kind === 'ecological-snapshot' ? (
              <EcologicalSnapshotBody d={d} r={d.reframe} />
            ) : (
              <ProgressBody d={d} />
            )}

            {vurdering && klimaraadet?.url && (
              <div
                className="mt-2 w-full"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="presentation"
              >
                <KlimaraadetBadge vurdering={vurdering} rapportUrl={klimaraadet.url} compact />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
