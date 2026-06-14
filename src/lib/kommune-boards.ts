import { formatDanishNumber } from '@/lib/format';
import {
  standingsCell,
  type StandingsLensKey,
  type StandingsMode,
} from '@/lib/kommune-ranking';
import type {
  KlimaregnskabData,
  KommuneBenchmarkData,
  KommuneRankingData,
} from '@/lib/types';

/**
 * Unified rangliste-board model. Five Trepart-mål share one podium UI:
 *
 * - Three "levering"-boards (lavbund, skov, kvælstof) are driven by the global
 *   Ift. ansvar/Absolut toggle — they measure delivery relative to a kommune's
 *   andel af naturpotentiale.
 * - Two "status"-boards (natur, CO₂) measure a current state rather than
 *   Trepart-levering, so they carry their own per-board måleenhed toggle.
 *
 * Each board produces a ranked list of {@link BoardEntry} so the podium and the
 * 4–10 list render identically regardless of the underlying data source.
 */

export type BoardKey = 'lavbund' | 'skov' | 'kvaelstof' | 'natur' | 'co2';

/** Whether a board ranks delivery-vs-responsibility or a current status. */
export type BoardKind = 'levering' | 'status';

/**
 * Explicit, human-readable formula for a måleenhed. `ratio` renders as a visual
 * fraction (top ÷ bottom); `sum` is a plain total with no division.
 */
export type BoardFormula =
  | { kind: 'ratio'; top: string; bottom: string; result: string }
  | { kind: 'sum'; expr: string; result: string };

export interface BoardOption {
  id: string;
  /** Short label for the toggle pill. */
  label: string;
  /** Board subtitle shown for this option. */
  sub: string;
  /** Plain-language meaning of the måleenhed (what it tells you). */
  desc: string;
  /** Concrete, visual formula — exactly which number is divided by / subtracted from which. */
  formula: BoardFormula;
  /** When true, a lower raw value means a better (higher) rank. */
  lowerIsBetter?: boolean;
}

export interface BoardDef {
  key: BoardKey;
  label: string;
  full: string;
  /** Brand tone (hex) for the indsatsmål. */
  tone: string;
  kind: BoardKind;
  /** Data source line shown in the explainer/tooltips. */
  source: string;
  /**
   * When true, the active option follows the GLOBAL Ift. ansvar/Absolut toggle
   * instead of a per-board control. Also marks the board as sortable in the
   * master table (its key maps to a StandingsLensKey).
   */
  global: boolean;
  options: BoardOption[];
}

export const BOARDS: BoardDef[] = [
  {
    key: 'lavbund',
    label: 'Lavbund',
    full: 'Lavbundsudtagning',
    tone: '#a16207',
    kind: 'levering',
    source: 'MARS-projektdata + naturpotentiale (DCE 30 %)',
    global: true,
    options: [
      {
        id: 'relativ',
        label: 'Ift. ansvar',
        sub: 'Udtaget lavbund ift. potentiale',
        desc: 'Hvor meget lavbund kommunen har udtaget, sat i forhold til hvad dens andel af landet tilsiger.',
        formula: {
          kind: 'ratio',
          top: 'Kommunens andel af alt udtaget lavbund i DK',
          bottom: 'Kommunens andel af DK’s samlede naturpotentiale',
          result: '1,0× = lige stor andel = som forventet. 2,0× = dobbelt så meget som ansvaret.',
        },
      },
      {
        id: 'absolut',
        label: 'Absolut',
        sub: 'Udtaget lavbund i hektar',
        desc: 'Det rå antal hektar lavbund, der er udtaget — uden hensyn til kommunens størrelse.',
        formula: {
          kind: 'sum',
          expr: 'Sum af kommunens egne udtagne hektar lavbund',
          result: 'Intet divideres. Store kommuner ligger naturligt højt.',
        },
      },
    ],
  },
  {
    key: 'skov',
    label: 'Skov',
    full: 'Skovrejsning',
    tone: '#15803d',
    kind: 'levering',
    source: 'MARS + KSF + NST + naturpotentiale (DCE 30 %)',
    global: true,
    options: [
      {
        id: 'relativ',
        label: 'Ift. ansvar',
        sub: 'Ny skov ift. potentiale',
        desc: 'Hvor meget ny skov kommunen har rejst, sat i forhold til hvad dens andel af landet tilsiger.',
        formula: {
          kind: 'ratio',
          top: 'Kommunens andel af al ny skov i DK',
          bottom: 'Kommunens andel af DK’s samlede naturpotentiale',
          result: '1,0× = lige stor andel = som forventet. 2,0× = dobbelt så meget som ansvaret.',
        },
      },
      {
        id: 'absolut',
        label: 'Absolut',
        sub: 'Ny skov i hektar',
        desc: 'Det rå antal hektar ny skov — uden hensyn til kommunens størrelse.',
        formula: {
          kind: 'sum',
          expr: 'Sum af kommunens egne nye skovhektar',
          result: 'Intet divideres. Store kommuner ligger naturligt højt.',
        },
      },
    ],
  },
  {
    key: 'kvaelstof',
    label: 'Kvælstof',
    full: 'Kvælstofreduktion',
    tone: '#0d9488',
    kind: 'levering',
    source: 'MARS-projektdata + indsatsbehov pr. opland',
    global: true,
    options: [
      {
        id: 'relativ',
        label: 'Ift. ansvar',
        sub: 'Reduceret N ift. indsatsbehov',
        desc: 'Hvor meget kvælstof kommunen har reduceret, sat i forhold til dens indsatsbehov.',
        formula: {
          kind: 'ratio',
          top: 'Kommunens andel af al N-reduktion i DK',
          bottom: 'Kommunens andel af det samlede indsatsbehov',
          result: '1,0× = lige stor andel = som forventet. 2,0× = dobbelt så meget som behovet.',
        },
      },
      {
        id: 'absolut',
        label: 'Absolut',
        sub: 'Reduceret N i ton',
        desc: 'Det rå antal ton kvælstof reduceret — uden hensyn til kommunens behov.',
        formula: {
          kind: 'sum',
          expr: 'Sum af kommunens egne reducerede ton N',
          result: 'Intet divideres. Store kommuner ligger naturligt højt.',
        },
      },
    ],
  },
  {
    key: 'natur',
    label: 'Natur',
    full: 'Beskyttet natur',
    tone: '#4d7c0f',
    kind: 'status',
    source: 'Benchmark B2/B4 (§3, Natura 2000, fredninger, naturpotentiale)',
    global: false,
    options: [
      {
        id: 'beskyttet',
        label: 'Beskyttet i dag',
        sub: 'Andel af naturværdi beskyttet',
        desc: 'Hvor stor en del af kommunens værdifulde natur der allerede er beskyttet i dag.',
        formula: {
          kind: 'ratio',
          top: 'Beskyttet naturværdi-areal i kommunen (ha)',
          bottom: 'Kommunens samlede naturværdi-areal (ha)',
          result: 'Vises i %. Højere = mere af naturen er sikret (§3, Natura 2000, fredninger).',
        },
      },
      {
        id: 'projektnatur',
        label: 'Natur berørt af projekter',
        sub: 'Projektareal på kortlagt natur (ha)',
        desc: 'Hvor mange hektar af kommunens trepart-projekter der ligger oven på kortlagt natur (biodiversitetskortet). Projekter er klippet til kommunegrænser, så areal ikke tælles dobbelt. En stærk indikator for naturpotentiale — IKKE en garanti for, at naturen reelt forbedres.',
        formula: {
          kind: 'sum',
          expr: 'Projektareal i kommunen der overlapper DCE-biodiversitetskortet (ha)',
          result: 'Vises i hektar. Højere = projekterne rører mere kortlagt natur. Indikator, ikke garanti.',
        },
      },
    ],
  },
  {
    key: 'co2',
    label: 'CO₂',
    full: 'CO₂-udledning',
    tone: '#525252',
    kind: 'status',
    source: 'Energistyrelsen — klimaregnskabet.dk (2018–2023). National CO₂ på forsiden måler mod 1990.',
    global: false,
    options: [
      {
        id: 'reduktion',
        label: 'Reduktion',
        sub: 'Fald i udledning 2018 → 2023',
        desc: 'Hvor meget kommunen har skåret af sin samlede udledning siden 2018.',
        formula: {
          kind: 'ratio',
          top: 'Udledning 2018 − udledning 2023 (ton CO₂e)',
          bottom: 'Udledning 2018 (ton CO₂e)',
          result: 'Vises i %. Højere = større fald. Dækker alle sektorer (scope 1+2).',
        },
      },
      {
        id: 'prCapita',
        label: 'Pr. indbygger',
        sub: 'Ton CO₂e pr. indbygger (2023)',
        desc: 'Udledning pr. indbygger i 2023 — lavest placeres øverst.',
        formula: {
          kind: 'ratio',
          top: 'Kommunens samlede udledning 2023 (ton CO₂e)',
          bottom: 'Antal indbyggere i kommunen (2023)',
          result: 'Vises i ton pr. person. Lavest = øverst på listen.',
        },
        lowerIsBetter: true,
      },
    ],
  },
];

/** Master-table sort key for the three global (levering) boards. */
const LENS_KEY: Record<'lavbund' | 'skov' | 'kvaelstof', StandingsLensKey> = {
  lavbund: 'idxLavbund',
  skov: 'idxSkov',
  kvaelstof: 'idxKvaelstof',
};

export function boardLensKey(key: BoardKey): StandingsLensKey | null {
  if (key === 'lavbund' || key === 'skov' || key === 'kvaelstof') return LENS_KEY[key];
  return null;
}

export interface BoardContext {
  ranking: KommuneRankingData;
  klimaregnskab: KlimaregnskabData | null;
  benchmark: KommuneBenchmarkData | null;
  /** Drives the active option for global (levering) boards. */
  globalMode: StandingsMode;
}

export interface BoardEntry {
  kode: string;
  navn: string;
  region: string;
  /** Higher = better placement (direction already normalised). */
  sort: number;
  /** Display phrase, e.g. "6,7 gange forventet", "58 % beskyttet", "31 % ned". */
  phrase: string;
  /** Global rank (1-based) across all kommuner with data on this metric. */
  rank: number;
}

/** Resolve the active option id for a board given the global mode. */
export function activeOptionId(def: BoardDef, globalMode: StandingsMode, localId: string): string {
  if (def.global) return globalMode === 'absolut' ? 'absolut' : 'relativ';
  return localId;
}

interface RawValue {
  value: number;
  phrase: string;
}

function marsValue(
  ctx: BoardContext,
  kode: string,
  lensKey: StandingsLensKey,
  optionId: string,
): RawValue | null {
  const row = ctx.ranking.byKommune[kode];
  if (!row) return null;
  const cell = standingsCell(row, lensKey, optionId === 'absolut' ? 'absolut' : 'relativ');
  if (cell.sort < 0) return null;
  return { value: cell.sort, phrase: cell.phrase };
}

function naturValue(ctx: BoardContext, kode: string, optionId: string): RawValue | null {
  if (optionId === 'projektnatur') {
    const ha = ctx.ranking.byKommune[kode]?.projektNaturBiodiversitetHa;
    if (ha == null || Number.isNaN(ha)) return null;
    return { value: ha, phrase: `${formatDanishNumber(Math.round(ha))} ha natur` };
  }
  const pct = ctx.benchmark?.b4?.byKommune[kode]?.pctVaerdiBeskyttet;
  if (pct == null || Number.isNaN(pct)) return null;
  return { value: pct, phrase: `${formatDanishNumber(Math.round(pct))} % beskyttet` };
}

function co2Value(ctx: BoardContext, kode: string, optionId: string): RawValue | null {
  const km = ctx.klimaregnskab?.kommuner.find((k) => k.kommuneKode === kode);
  if (!km) return null;
  if (optionId === 'prCapita') {
    const pcArr = km.udledningPrCapita;
    const pc = pcArr[pcArr.length - 1];
    if (pc == null || Number.isNaN(pc)) return null;
    return { value: pc, phrase: `${formatDanishNumber(pc, 1)} t/pers.` };
  }
  const series = km.samletUdledning;
  if (series.length < 2 || !series[0]) return null;
  const red = ((series[0] - series[series.length - 1]) / series[0]) * 100;
  const r = Math.round(red);
  const phrase = r >= 0 ? `${formatDanishNumber(r)} % ned` : `${formatDanishNumber(-r)} % op`;
  return { value: red, phrase };
}

function rawValueFor(def: BoardDef, ctx: BoardContext, kode: string, optionId: string): RawValue | null {
  if (def.kind === 'levering') {
    const lensKey = boardLensKey(def.key);
    return lensKey ? marsValue(ctx, kode, lensKey, optionId) : null;
  }
  if (def.key === 'natur') return naturValue(ctx, kode, optionId);
  return co2Value(ctx, kode, optionId);
}

/**
 * Build the full ranked list for a board + active option. Direction is
 * normalised so the returned `sort` is always "higher = better"; ranks are
 * assigned across all kommuner that have data, then the caller filters by
 * region for display.
 */
export function buildBoardEntries(def: BoardDef, optionId: string, ctx: BoardContext): BoardEntry[] {
  const option = def.options.find((o) => o.id === optionId) ?? def.options[0];
  const entries: BoardEntry[] = [];

  for (const row of ctx.ranking.kommuner) {
    const raw = rawValueFor(def, ctx, row.kode, option.id);
    if (!raw) continue;
    entries.push({
      kode: row.kode,
      navn: row.kommuneNavn,
      region: row.region,
      sort: option.lowerIsBetter ? -raw.value : raw.value,
      phrase: raw.phrase,
      rank: 0,
    });
  }

  entries.sort((a, b) => b.sort - a.sort);
  entries.forEach((e, i) => {
    e.rank = i + 1;
  });
  return entries;
}
