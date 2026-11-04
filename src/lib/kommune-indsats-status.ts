import { idxPhrase, paceIdx, type StandingsLensKey } from '@/lib/kommune-ranking';
import { paceStatusOf } from '@/lib/kommune-goal-pace';

/**
 * Shared model for the three Grøn Trepart "effort" goals (lavbund, skov,
 * kvælstof). Single source of truth for both the kommune hero chips and the
 * detailed standings breakdown, so status wording AND the per-measure
 * explanations stay in sync with the rangliste boards in `kommune-boards.ts`.
 *
 * Every goal is measured the same way: how much of the kommune's OWN part of
 * the national goal is godkendt or anlagt — see `buildDynamicRanking` and
 * `etl/build_kommune_ansvar.py` for how that part is set.
 */
export const INDSATS_MAAL = [
  {
    key: 'idxLavbund',
    label: 'Lavbund taget ud af drift',
    short: 'Lavbund',
    tone: '#a16207',
    absUnit: 'ha',
    explain: 'Hvor stor en del af kommunens andel af lavbundsmålet (140.000 ha) der er godkendt eller anlagt.',
    formula: 'Godkendt + anlagt lavbund i kommunen ÷ kommunens andel af målet. Andelen er MARS-oplandenes lavbundspotentiale fordelt efter, hvor den dyrkede kulstofrige jord ligger.',
    source: 'MARS-projekter og -planer · DCA kulstofkort 2022 · Danmarks Statistik (AREALDK)',
  },
  {
    key: 'idxSkov',
    label: 'Ny skov rejst',
    short: 'Skov',
    tone: '#15803d',
    absUnit: 'ha',
    explain: 'Hvor stor en del af kommunens andel af skovmålet (250.000 ha) der er godkendt eller plantet. Tæller MARS og Klimaskovfonden fra 2024 — ikke Naturstyrelsens skove, som ikke har en plantedato.',
    formula: 'Godkendt + anlagt skov (MARS) + Klimaskovfonden fra 2024 ÷ kommunens andel af målet. Andelen følger kommunens andel af landets landbrugsareal.',
    source: 'MARS-projekter · Klimaskovfonden · Danmarks Statistik (AREALDK)',
  },
  {
    key: 'idxKvaelstof',
    label: 'Kvælstof reduceret',
    short: 'Kvælstof',
    tone: '#0d9488',
    absUnit: 't',
    explain: 'Hvor stor en del af kommunens andel af kvælstofmålet (12.776 t) der er godkendt eller anlagt.',
    formula: 'Kvælstofeffekt af godkendte + anlagte projekter ÷ kommunens andel af målet. Andelen er MARS-oplandenes reduktionskrav fordelt efter kommunens landbrugsareal i hvert opland.',
    source: 'MARS-projekter og -planer · Danmarks Statistik (AREALDK)',
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

/** How to read a share-of-ansvar track, reused across the per-measure tooltips. */
export const ANSVAR_NOTE =
  'Søjlen er kommunens egen andel af målet; 100 % = hele andelen. Stregen viser, hvor langt kommunen burde være nu, hvis den skal nå sin andel til fristen.';

export type StatusKind = 'over' | 'on' | 'under' | 'none';

export interface IndsatsStatus {
  kind: StatusKind;
  word: string;
  detail: string;
}

/**
 * Status for a share of the kommune's own part of a goal, judged against the
 * time that has passed (`ratio` = 1 ÷ time elapsed). The detail line keeps the
 * plain share ("34 % af kommunens andel").
 */
export function statusOf(share: number | null, ratio: number | null): IndsatsStatus {
  const status = paceStatusOf(paceIdx(share, ratio));
  return share != null && share > 0 ? { ...status, detail: idxPhrase(share) } : status;
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
