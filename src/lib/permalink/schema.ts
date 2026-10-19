/**
 * Permalink URL schema — single source of truth for shareable tracker state.
 *
 * Structure: `{path}#{section}?{query}`
 *
 * Path = page route (unchanged). Hash = scroll section (chapter ids from chapters.ts).
 * Query params omitted when they match defaults.
 *
 * ## National pillar pages (`/kvælstof`, `/lavbund`, `/skovrejsning`, `/natur`, …)
 *
 * | Param          | Values | Default |
 * |----------------|--------|---------|
 * | `kort`         | `kystvande`, `hovedvandoplande`, `kommuner`, `skjult` | pillar default |
 * | `overlag`      | comma: `section3`, `natura2000`, `markudledning`, `drikkevand`, `naturpotentialer`, `biodiv`, `vns`, `ksf`, `nst`, `vandlegemer`, `kulstof` | all off |
 * | `faser`        | comma: `skitse`, `foru`, `godk`, `anlagt` | `anlagt` only |
 * | `fuldskaerm`   | `1` | off |
 * | `projektenhed` | `antal`, `areal` | `areal` |
 * | `frem`         | comma: fremskrivning stage ids; `ingen` = all optional off | only `anlagt` (implicit) |
 * | `projekt`      | `mars:<id>`, `ksf:<id>`, `nst:<id>` | — |
 * | `opland`, `plan`, `kystvand`, `vandplan` | panel ids | — |
 *
 * Legacy aliases (decode only): `lag=kyst|opland|kommuner|fra` → `kort`; `bio=…` → `biodiv`; `vns=1` → `vns`.
 *
 * ## Kommune list (`/kommuner`)
 *
 * | Param | Values | Default |
 * |-------|--------|---------|
 * | `sort` | `lavbund`, `skov`, `kvaelstof` | `lavbund` |
 * | `visning` | `ansvar`, `absolut` | `ansvar` |
 * | `region` | region name or `alle` | `alle` |
 * | + kommune map params | `metric`, `faser`, `tilvalg`, `vis`, `skala`, `natur` | see kommune-map-params.ts |
 *
 * ## Kommune detail (`/kommuner/:slug`)
 *
 * Hash sections: `status`, `kort`, `projekter`. Legacy `?fane=projekter` → `#projekter`.
 *
 * @example /lavbund#oekonomi
 * @example /natur#geografi?overlag=section3,natura2000&fuldskaerm=1
 * @example /skovrejsning#geografi?faser=anlagt,foru&overlag=ksf,nst
 * @example /kommuner?sort=skov&visning=ansvar
 * @example /kommuner/aalborg#projekter
 */

export const PERMALINK_KEYS = {
  kort: 'kort',
  overlag: 'overlag',
  faser: 'faser',
  fuldskaerm: 'fuldskaerm',
  projektenhed: 'projektenhed',
  frem: 'frem',
  projekt: 'projekt',
  sort: 'sort',
  visning: 'visning',
  region: 'region',
  fane: 'fane',
  // Legacy (decode)
  lag: 'lag',
  bio: 'bio',
  vns: 'vns',
  opland: 'opland',
  plan: 'plan',
  kystvand: 'kystvand',
  vandplan: 'vandplan',
} as const;
