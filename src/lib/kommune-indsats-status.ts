import { idxPhrase, type StandingsLensKey } from '@/lib/kommune-ranking';

/**
 * Shared model for the three Grøn Trepart "effort" goals (lavbund, skov,
 * kvælstof) — all measure progress against a kommune's forventede niveau, so
 * more is better. Single source of truth for both the kommune hero chips and
 * the detailed standings breakdown, so status wording AND the per-measure
 * explanations stay in sync.
 *
 * `explain`/`formula`/`source` mirror the canonical rangliste board
 * definitions in `kommune-boards.ts` (the "ift. ansvar" option) and feed the
 * per-line (i) tooltips on the kommune detail page. All three indices are
 * computed the same way: levering-andel ÷ andel af nationalt naturpotentiale
 * (DCE 30 %) — see `buildDynamicRanking` / `build_kommune_ranking.py`.
 */
export const INDSATS_MAAL = [
  {
    key: 'idxLavbund',
    label: 'Lavbund taget ud af drift',
    short: 'Lavbund',
    tone: '#a16207',
    absUnit: 'ha',
    explain: 'Hvor meget lavbundsjord kommunen har taget ud af drift, sat ift. dens andel af landets naturpotentiale.',
    formula: 'Andel af alt udtaget lavbund i DK ÷ andel af nationalt naturpotentiale (DCE 30 %)',
    source: 'MARS-projektdata + naturpotentiale (DCE 30 %)',
  },
  {
    key: 'idxSkov',
    label: 'Ny skov rejst',
    short: 'Skov',
    tone: '#15803d',
    absUnit: 'ha',
    explain: 'Hvor meget ny skov kommunen har rejst, sat ift. dens andel af landets naturpotentiale. Inkluderer MARS, Klimaskovfonden og Naturstyrelsen.',
    formula: 'Andel af al ny skov i DK ÷ andel af nationalt naturpotentiale (DCE 30 %)',
    source: 'MARS + KSF + NST + naturpotentiale (DCE 30 %)',
  },
  {
    key: 'idxKvaelstof',
    label: 'Kvælstof reduceret',
    short: 'Kvælstof',
    tone: '#0d9488',
    absUnit: 't',
    explain: 'Hvor meget kvælstof kommunens projekter reducerer, sat ift. dens andel af landets naturpotentiale.',
    formula: 'Andel af al N-reduktion i DK ÷ andel af nationalt naturpotentiale (DCE 30 %)',
    source: 'MARS-projektdata + naturpotentiale (DCE 30 %)',
  },
] as const satisfies ReadonlyArray<{
  key: StandingsLensKey;
  label: string;
  short: string;
  tone: string;
  absUnit: 'ha' | 't';
  explain: string;
  formula: string;
  source: string;
}>;

/** Shared "1,0× = som forventet" framing, reused across the per-measure tooltips. */
export const FORVENTET_NIVEAU_NOTE =
  '1,0× = som forventet (de to andele er lige store). Højere = leverer mere end ansvaret tilsiger. Den lodrette streg på søjlen markerer 1,0×.';

export type StatusKind = 'over' | 'on' | 'under' | 'none';

export interface IndsatsStatus {
  kind: StatusKind;
  word: string;
  detail: string;
}

/**
 * Map a forventet-index (1,0× = som forventet) to a plain-language status.
 * Mirrors the thresholds used across the standings UI.
 */
export function statusOf(idx: number | null): IndsatsStatus {
  if (idx == null) return { kind: 'none', word: 'Ingen data', detail: '' };
  if (idx <= 0) return { kind: 'under', word: 'Ikke begyndt', detail: '' };
  const detail = idxPhrase(idx);
  if (idx >= 3) return { kind: 'over', word: 'Langt foran', detail };
  if (idx >= 1.5) return { kind: 'over', word: 'Foran', detail };
  if (idx >= 0.85) return { kind: 'on', word: 'På sporet', detail };
  return { kind: 'under', word: 'Under forventet', detail };
}

/** Bar fill colour per status — used by the standings track. */
export const BAR_COLOR: Record<StatusKind, string> = {
  over: '#15803d',
  on: '#86c267',
  under: '#b4b2a9',
  none: '#d3d1c7',
};

/** Text colour for status values (arrows + label) — neutral chip, no fill. */
export const STATUS_VALUE_CLASS: Record<StatusKind, string> = {
  over: 'text-emerald-700 dark:text-emerald-400',
  on: 'text-foreground',
  under: 'text-amber-800 dark:text-amber-300',
  none: 'text-muted-foreground',
};

/** @deprecated Prefer {@link STATUS_VALUE_CLASS} with arrow chips — kept for legacy call sites. */
export const PILL_CLASS: Record<StatusKind, string> = {
  over: 'text-emerald-800 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40',
  on: 'text-stone-600 bg-stone-100 dark:text-stone-300 dark:bg-stone-800/50',
  under: 'text-stone-600 bg-stone-100 dark:text-stone-300 dark:bg-stone-800/50',
  none: 'text-stone-500 bg-stone-100 dark:text-stone-400 dark:bg-stone-800/50',
};
