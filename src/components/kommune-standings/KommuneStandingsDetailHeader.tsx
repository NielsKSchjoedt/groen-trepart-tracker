import type { KommuneRankingData, KommuneRankingRow } from '@/lib/types';
import { idxPhrase, rankOnAxis } from '@/lib/kommune-ranking';
import { formatDanishNumber } from '@/lib/format';
import { InfoTooltip } from '@/components/InfoTooltip';

interface KommuneStandingsDetailHeaderProps {
  row: KommuneRankingRow;
  ranking: KommuneRankingData;
}

/** The three real "effort" goals — all measure progress, more is better. */
const INDSATS_MAAL = [
  { key: 'idxLavbund', label: 'Lavbund taget ud af drift', tone: '#a16207' },
  { key: 'idxSkov', label: 'Ny skov rejst', tone: '#15803d' },
  { key: 'idxKvaelstof', label: 'Kvælstof reduceret', tone: '#0d9488' },
] as const;

/**
 * The "forventet" baseline (index = 1,0×) sits at a fixed point on every track
 * so the three goals are directly comparable and the marker means the same
 * thing everywhere. The track tops out at 4× — higher values cap the bar but
 * keep their precise figure in the label.
 */
const TRACK_MAX_IDX = 2.5;
const BASELINE_PCT = 40;

function fillPct(idx: number | null): number {
  if (idx == null || idx <= 0) return 0;
  return Math.min((idx / TRACK_MAX_IDX) * 100, 100);
}

type StatusKind = 'over' | 'on' | 'under' | 'none';

interface IndsatsStatus {
  kind: StatusKind;
  word: string;
  detail: string;
}

function statusOf(idx: number | null): IndsatsStatus {
  if (idx == null) return { kind: 'none', word: 'Ingen data', detail: '' };
  if (idx <= 0) return { kind: 'under', word: 'Ikke begyndt', detail: '' };
  const detail = idxPhrase(idx);
  if (idx >= 3) return { kind: 'over', word: 'Langt foran', detail };
  if (idx >= 1.5) return { kind: 'over', word: 'Foran', detail };
  if (idx >= 0.85) return { kind: 'on', word: 'På sporet', detail };
  return { kind: 'under', word: 'Under forventet', detail };
}

const BAR_COLOR: Record<StatusKind, string> = {
  over: '#15803d',
  on: '#86c267',
  under: '#b4b2a9',
  none: '#d3d1c7',
};

const PILL_CLASS: Record<StatusKind, string> = {
  over: 'text-emerald-800 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40',
  on: 'text-stone-600 bg-stone-100 dark:text-stone-300 dark:bg-stone-800/50',
  under: 'text-stone-600 bg-stone-100 dark:text-stone-300 dark:bg-stone-800/50',
  none: 'text-stone-500 bg-stone-100 dark:text-stone-400 dark:bg-stone-800/50',
};

/**
 * Naturindsats breakdown for the kommune detail panel.
 *
 * Three effort goals (lavbund, skov, kvælstof) are shown against a visible
 * "forventet" baseline so over/under is intuitive. Naturkvalitet (B3) is
 * deliberately separated below — it measures a *need*, not project progress,
 * and is not a Grøn Trepart target.
 */
export function KommuneStandingsDetailHeader({
  row,
  ranking,
}: KommuneStandingsDetailHeaderProps) {
  const total = ranking.kommuner.length;
  const gap = row.kvalitetGapPct;

  return (
    <div className="mb-5 pb-5 border-b border-border">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
        Naturindsatsen — ift. forventet
      </p>
      <p className="text-xs text-muted-foreground mb-3.5">
        Hver søjle måles mod det, kommunen forventes at levere ud fra sin
        andel af naturpotentialet ({formatDanishNumber(row.ansvarPct, 1)}% af landet).
        <InfoTooltip
          title="Forventet niveau"
          content="Kommunens andel af nationalt naturpotentiale (DCE 30 %). Et fagligt stand-in for forventet bidrag — ikke en politisk forpligtelse. Den lodrette streg på søjlen markerer dette niveau (1,0×)."
          size={11}
          side="right"
        />
      </p>

      <div className="space-y-3.5">
        {INDSATS_MAAL.map((m) => {
          const idx = row[m.key];
          const status = statusOf(idx);
          const rank = rankOnAxis(ranking, row.kode, m.key);
          return (
            <div key={m.key}>
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: m.tone }}
                />
                <span className="text-xs font-semibold text-foreground">{m.label}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  <span
                    className={`text-[11px] font-semibold rounded-md px-1.5 py-0.5 whitespace-nowrap ${PILL_CLASS[status.kind]}`}
                  >
                    {status.word}
                  </span>
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
                {rank != null && <span>nr. {rank} af {total}</span>}
              </p>
            </div>
          );
        })}
      </div>

      {/* Naturkvalitet — a need-indicator, not a Trepart goal. Kept separate. */}
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
