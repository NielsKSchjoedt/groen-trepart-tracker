import {
  standingsCell,
  type MetricPaceRatios,
  type StandingsLensKey,
  type StandingsMode,
} from '@/lib/kommune-ranking';
import type { KommuneRankingData } from '@/lib/types';

/**
 * Rangliste-board model. The three Grøn Trepart delivery goals (lavbund, skov,
 * kvælstof) share one podium UI and are all measured the same way: how much of
 * the kommune's OWN part of the national goal is godkendt or anlagt.
 *
 * Natur and CO₂ used to have boards too, but they measure a state, not
 * Trepart-delivery (Tårnby topped "natur" on geography; CO₂ was driven by
 * energy plants and an accounting artefact on Læsø), so they are shown as
 * context on the map and the kommune pages instead of being ranked.
 */

export type BoardKey = 'lavbund' | 'skov' | 'kvaelstof';

/**
 * Explicit, human-readable formula for a måleenhed. `ratio` renders as a visual
 * fraction (top ÷ bottom); `sum` is a plain total with no division.
 */
export type BoardFormula =
  | { kind: 'ratio'; top: string; bottom: string; result: string }
  | { kind: 'sum'; expr: string; result: string };

export interface BoardOption {
  id: StandingsMode;
  /** Short label for the toggle pill. */
  label: string;
  /** Board subtitle shown for this option. */
  sub: string;
  /** Plain-language meaning of the måleenhed (what it tells you). */
  desc: string;
  /** Concrete, visual formula — exactly which number is divided by which. */
  formula: BoardFormula;
}

export interface BoardDef {
  key: BoardKey;
  label: string;
  full: string;
  /** Brand tone (hex) for the indsatsmål. */
  tone: string;
  /** Data source line shown in the explainer/tooltips. */
  source: string;
  /** How the kommune's part of the goal is set — shown on the explainer. */
  ansvarNote: string;
  options: BoardOption[];
}

/** The three måleenheder, shared by every board apart from wording, units and deadline. */
function options(noun: string, goalNoun: string, unit: string, deadline: number): BoardOption[] {
  return [
    {
      id: 'relativ',
      label: 'Andel af ansvar',
      sub: `Godkendt + anlagt ${noun} i % af kommunens andel`,
      desc: `Hvor stor en del af kommunens egen andel af ${goalNoun} der er godkendt eller anlagt. Små og store kommuner sammenlignes på lige fod, fordi hver måles mod sin egen andel.`,
      formula: {
        kind: 'ratio',
        top: `Godkendt + anlagt ${noun} i kommunen (${unit})`,
        bottom: `Kommunens andel af det nationale mål (${unit})`,
        result: '100 % = kommunen har hele sin andel godkendt eller anlagt.',
      },
    },
    {
      id: 'maal',
      label: 'Mod målet',
      sub: `Tempo mod ${deadline}`,
      desc: `Om kommunen er i det tempo, dens andel kræver for at nå fristen i ${deadline} — ikke om den er foran de andre kommuner.`,
      formula: {
        kind: 'ratio',
        top: 'Andel af kommunens ansvar, der er godkendt eller anlagt (%)',
        bottom: `Andel af tiden fra aftalen til ${deadline}, der er gået (%)`,
        result: '1,0× = præcis på sporet. Under 1,0× = bagud, uanset placering ift. naboerne.',
      },
    },
    {
      id: 'absolut',
      label: 'Absolut',
      sub: `Godkendt + anlagt ${noun} (${unit})`,
      desc: `Den rå mængde ${noun} — uden hensyn til, hvor stor en del af målet kommunen har.`,
      formula: {
        kind: 'sum',
        expr: `Sum af kommunens godkendte og anlagte ${noun} (${unit})`,
        result: 'Intet divideres. Kommuner med meget landbrugsjord ligger naturligt højt.',
      },
    },
  ];
}

export const BOARDS: BoardDef[] = [
  {
    key: 'lavbund',
    label: 'Lavbund',
    full: 'Lavbundsudtagning',
    tone: '#a16207',
    source: 'MARS-projekter og -planer · DCA kulstofkort 2022 · Danmarks Statistik (AREALDK)',
    ansvarNote:
      'Kommunens andel af de 140.000 ha: MARS-oplandenes lavbundspotentiale fordelt efter, hvor den dyrkede kulstofrige jord ligger.',
    options: options('lavbund', 'lavbundsmålet', 'ha', 2030),
  },
  {
    key: 'skov',
    label: 'Skov',
    full: 'Skovrejsning',
    tone: '#15803d',
    source: 'MARS-projekter · Klimaskovfonden · Danmarks Statistik (AREALDK)',
    ansvarNote:
      'Kommunens andel af de 250.000 ha følger dens andel af landets landbrugsareal — skovmålet har ingen geografisk fordeling. Tæller MARS og Klimaskovfonden fra 2024; Naturstyrelsens skove har ingen plantedato og tælles ikke.',
    options: options('skov', 'skovmålet', 'ha', 2045),
  },
  {
    key: 'kvaelstof',
    label: 'Kvælstof',
    full: 'Kvælstofreduktion',
    tone: '#0d9488',
    source: 'MARS-projekter og -planer · Danmarks Statistik (AREALDK)',
    ansvarNote:
      'Kommunens andel af de 12.776 t: hvert MARS-oplands reduktionskrav fordelt efter kommunens landbrugsareal i oplandet. Kommuner, hvis oplande ikke har et krav, rangeres ikke.',
    options: options('kvælstof', 'kvælstofmålet', 't', 2027),
  },
];

/** Master-table sort key per board. */
const LENS_KEY: Record<BoardKey, StandingsLensKey> = {
  lavbund: 'idxLavbund',
  skov: 'idxSkov',
  kvaelstof: 'idxKvaelstof',
};

export function boardLensKey(key: BoardKey): StandingsLensKey {
  return LENS_KEY[key];
}

export interface BoardContext {
  ranking: KommuneRankingData;
  /** Drives the active option on every board. */
  globalMode: StandingsMode;
  /** Per-metric scalars — required for the "Mod målet" option. */
  paceRatios?: MetricPaceRatios;
}

export interface BoardEntry {
  kode: string;
  navn: string;
  region: string;
  /** Higher = better placement. */
  sort: number;
  /** Display phrase, e.g. "34 % af kommunens andel", "1,2× nødvendigt tempo". */
  phrase: string;
  /** Global rank (1-based) across all ranked kommuner. */
  rank: number;
}

/**
 * Build the ranked list for a board in the active mode. Only kommuner with a
 * large enough part of the goal are ranked (see `isRankable`); ranks are
 * assigned across the whole country and the caller filters by region.
 */
export function buildBoardEntries(def: BoardDef, mode: StandingsMode, ctx: BoardContext): BoardEntry[] {
  const lensKey = boardLensKey(def.key);
  const entries: BoardEntry[] = [];

  for (const row of ctx.ranking.kommuner) {
    const cell = standingsCell(row, lensKey, mode, ctx.paceRatios);
    if (cell.sort < 0) continue;
    entries.push({
      kode: row.kode,
      navn: row.kommuneNavn,
      region: row.region,
      sort: cell.sort,
      phrase: cell.phrase,
      rank: 0,
    });
  }

  entries.sort((a, b) => b.sort - a.sort);
  entries.forEach((e, i) => {
    // Ties share a rank, so a row of "0 %" does not read as 40th, 41st, 42nd …
    e.rank = i > 0 && e.sort === entries[i - 1].sort ? entries[i - 1].rank : i + 1;
  });
  return entries;
}

/** Number of kommuner listed without a rank on this board (too small a part of the goal). */
export function unrankedCount(def: BoardDef, ctx: BoardContext): number {
  return ctx.ranking.kommuner.length - buildBoardEntries(def, 'relativ', ctx).length;
}
