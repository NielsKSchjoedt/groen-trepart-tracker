import type { KommuneRankingData, KommuneRankingRow } from '@/lib/types';
import { haForAxis, rankOnAxis, type StandingsLensKey, type StandingsMode } from '@/lib/kommune-ranking';
import { formatDanishNumber } from '@/lib/format';
import type { KommunePhase } from '@/lib/kommune-metrics';
import { InfoTooltip } from '@/components/InfoTooltip';
import { PhaseFilterPopover } from '@/components/PhaseFilterPopover';
import { BAR_COLOR, FORVENTET_NIVEAU_NOTE, INDSATS_MAAL, statusOf } from '@/lib/kommune-indsats-status';
import { IndsatsStatusValue } from '@/components/kommune-detail/IndsatsMaalChip';

interface KommuneStandingsDetailHeaderProps {
  row: KommuneRankingRow;
  ranking: KommuneRankingData;
  /** Page layout: no duplicate section chrome (chapter heading covers it). */
  variant?: 'default' | 'embedded';
  /**
   * Optional måleenhed + projektfase controls. When `onModeChange`,
   * `selectedPhases` and `onPhasesChange` are all provided, a control row is
   * rendered and the bars follow the chosen mode — full parity with the
   * rangliste. When omitted, the section is read-only at Ift. ansvar.
   */
  mode?: StandingsMode;
  onModeChange?: (m: StandingsMode) => void;
  selectedPhases?: Set<KommunePhase>;
  onPhasesChange?: (phases: Set<KommunePhase>) => void;
}

/**
 * The "forventet" baseline (index = 1,0×) sits at a fixed point on every track
 * so the three goals are directly comparable and the marker means the same
 * thing everywhere. The track tops out at 2,5× — higher values cap the bar but
 * keep their precise figure in the label.
 */
const TRACK_MAX_IDX = 2.5;
const BASELINE_PCT = 40;

function fillPct(idx: number | null): number {
  if (idx == null || idx <= 0) return 0;
  return Math.min((idx / TRACK_MAX_IDX) * 100, 100);
}

/** Count of kommuner with a non-null index on this axis (rangliste denominator). */
function idxDataCount(ranking: KommuneRankingData, key: StandingsLensKey): number {
  return ranking.kommuner.reduce((n, k) => n + (k[key] != null ? 1 : 0), 0);
}

/** Count of kommuner with a positive absolute delivery on this axis. */
function absDataCount(ranking: KommuneRankingData, key: StandingsLensKey): number {
  return ranking.kommuner.reduce((n, k) => n + (haForAxis(k, key) > 0 ? 1 : 0), 0);
}

/**
 * Naturindsats breakdown for the kommune detail panel.
 *
 * Three effort goals (lavbund, skov, kvælstof) are shown against a visible
 * "forventet" baseline (Ift. ansvar) or as raw hectares/tons (Absolut).
 * Naturkvalitet is deliberately separated below — it measures a *need*, not
 * project progress, and is not a Grøn Trepart target, so the måleenhed toggle
 * does not affect it.
 */
export function KommuneStandingsDetailHeader({
  row,
  ranking,
  variant = 'default',
  mode = 'relativ',
  onModeChange,
  selectedPhases,
  onPhasesChange,
}: KommuneStandingsDetailHeaderProps) {
  const gap = row.kvalitetGapPct;
  const embedded = variant === 'embedded';
  const isAbs = mode === 'absolut';
  const showControls = !!onModeChange && !!onPhasesChange && !!selectedPhases;

  return (
    <div className={embedded ? '' : 'mb-5 pb-5 border-b border-border'}>
      {!embedded && (
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Naturindsatsen — {isAbs ? 'absolut' : 'ift. forventet'}
        </p>
      )}

      <p className={`text-sm text-muted-foreground leading-relaxed ${embedded ? 'mb-4' : 'text-xs mb-3.5'}`}>
        {isAbs ? (
          <>Absolut levering — rå hektar og ton, uden hensyn til kommunens størrelse. Søjlen viser kommunen ift. landets største leverandør.</>
        ) : (
          <>
            Alle tre mål måles mod kommunens andel af nationalt naturpotentiale
            ({formatDanishNumber(row.ansvarPct, 1)}% af landet). 1,0× = som forventet.
            Tryk (i) ved hver linje for den præcise beregning.
            <InfoTooltip
              title="Sådan læses søjlerne"
              content={
                <>
                  <p>Hver søjle viser kommunens levering som et indeks mod dens forventede niveau. {FORVENTET_NIVEAU_NOTE}</p>
                  <p>Forventet niveau er et fagligt stand-in for forventet bidrag — ikke en politisk forpligtelse. Alle tre mål bruger kommunens andel af nationalt naturpotentiale (DCE 30 %) som nævner.</p>
                </>
              }
              size={11}
              side="right"
            />
          </>
        )}
      </p>

      {showControls && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label="Måleenhed">
            {([
              { id: 'relativ' as const, label: 'Ift. ansvar' },
              { id: 'absolut' as const, label: 'Absolut' },
            ]).map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onModeChange!(o.id)}
                aria-pressed={mode === o.id}
                className={[
                  'rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                  mode === o.id
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-border/40'
                    : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[8px]" />
          <PhaseFilterPopover
            selected={selectedPhases!}
            onChange={onPhasesChange!}
            tooltipContent="Vælg hvilke MARS-projektfaser der tæller med i kommunens tal. Standard er kun anlagt — udvid for at inkludere godkendt og forundersøgelse. Skitser tæller aldrig med."
          />
        </div>
      )}

      <div className="space-y-3.5">
        {INDSATS_MAAL.map((m) => {
          if (isAbs) {
            const ha = haForAxis(row, m.key);
            const hasData = ha > 0;
            const maxHa = ranking.kommuner.reduce((mx, k) => Math.max(mx, haForAxis(k, m.key)), 0);
            const withData = absDataCount(ranking, m.key);
            const rank = hasData
              ? ranking.kommuner.reduce((n, k) => n + (haForAxis(k, m.key) > ha ? 1 : 0), 0) + 1
              : null;
            const fill = maxHa > 0 ? Math.min((ha / maxHa) * 100, 100) : 0;
            return (
              <div key={m.key}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: m.tone }} />
                  <span className="text-xs font-semibold text-foreground">{m.label}</span>
                  <InfoTooltip
                    title={m.label}
                    content={
                      <>
                        <p>Rå mængde leveret af kommunens egne projekter — uden at dele med kommunens størrelse.</p>
                        <p className="text-foreground">Sum af kommunens leverede {m.absUnit === 't' ? 'ton kvælstof' : 'hektar'}</p>
                      </>
                    }
                    size={11}
                    side="right"
                  />
                  <span className="ml-auto text-sm font-bold tabular-nums text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
                    {hasData ? `${formatDanishNumber(Math.round(ha))} ${m.absUnit}` : 'Ingen data'}
                  </span>
                </div>

                <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all"
                    style={{ width: `${fill}%`, backgroundColor: m.tone, opacity: 0.8 }}
                  />
                </div>

                <p className="text-[10px] text-muted-foreground mt-1">
                  {rank != null ? <span>nr. {rank} af {withData}</span> : <span>—</span>}
                </p>
              </div>
            );
          }

          const idx = row[m.key];
          const status = statusOf(idx);
          const hasData = idx != null;
          const rank = hasData ? rankOnAxis(ranking, row.kode, m.key) : null;
          const withData = idxDataCount(ranking, m.key);
          return (
            <div key={m.key}>
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: m.tone }}
                />
                <span className="text-xs font-semibold text-foreground">{m.label}</span>
                <InfoTooltip
                  title={m.label}
                  content={
                    <>
                      <p>{m.explain}</p>
                      <p className="text-foreground">{m.formula}</p>
                      <p>{FORVENTET_NIVEAU_NOTE}</p>
                    </>
                  }
                  source={m.source}
                  size={11}
                  side="right"
                />
                <span className="ml-auto">
                  <IndsatsStatusValue status={status} />
                </span>
              </div>

              {/* Track with fixed "forventet" baseline marker */}
              <div className="relative h-2.5 rounded-full bg-muted overflow-visible">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all"
                  style={{ width: `${fillPct(idx)}%`, backgroundColor: BAR_COLOR[status.kind] }}
                />
                <span
                  className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-foreground/70 rounded"
                  style={{ left: `${BASELINE_PCT}%` }}
                  aria-hidden="true"
                />
              </div>

              <p className="text-[10px] text-muted-foreground mt-1">
                {status.detail && <span>{status.detail}</span>}
                {status.detail && rank != null && ' · '}
                {rank != null && <span>nr. {rank} af {withData}</span>}
              </p>
            </div>
          );
        })}
      </div>

      {isAbs && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/80 px-3 py-1.5 text-[11px] text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          <span className="font-bold">⚠</span>
          <span>
            <strong>Absolut levering</strong> belønner store kommuner med meget areal — det siger lidt om indsats <em>ift. ansvar</em>.
          </span>
        </p>
      )}

      {/* Naturkvalitet — a need-indicator, not a Trepart goal. Kept separate; unaffected by måleenhed. */}
      <div className="mt-4 pt-4 border-t border-border/70">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2 h-2 rounded-sm flex-shrink-0 bg-amber-600" />
          <span className="text-xs font-semibold text-foreground">Beskyttet natur der dyrkes</span>
          <InfoTooltip
            title="Beskyttet natur der dyrkes"
            content="Hvor stor en del af kommunens fredede natur (Natura 2000) der i dag reelt er landbrug. Det er ikke et Grøn Trepart-mål, men en indikator for forbedringsbehov: høj andel = meget udpeget natur kunne genoprettes. Lav andel = naturen er allerede natur."
            size={11}
            side="right"
          />
          <span className="ml-auto text-sm font-bold tabular-nums text-amber-700" style={{ fontFamily: "'Fraunces', serif" }}>
            {gap == null ? '—' : `${formatDanishNumber(gap, 0)}%`}
          </span>
        </div>
        {gap != null && (
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-amber-500/70"
              style={{ width: `${Math.min(gap, 100)}%` }}
            />
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">
          {gap == null
            ? 'Ingen data for denne kommune.'
            : 'Måler behov, ikke indsats — derfor holdt adskilt fra de tre mål ovenfor.'}
        </p>
      </div>
    </div>
  );
}
