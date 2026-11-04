/**
 * Canonical colour tokens for supplementary (non-MARS) data sources.
 *
 * These are the single source of truth used across:
 *   - ProjectFunnel supplement cards
 *   - ProjectActivityChart area series
 *   - DenmarkMap / KommuneMap circle markers and legends
 *   - KommunePage toggle buttons
 *   - ProjectDetailPanel source badges
 *
 * KSF (Klimaskovfonden) uses two palettes:
 *   - LIGHT PURPLE for Skovrejsning (afforestation pillar) — distinct from MARS
 *     "Anlagt" emerald (#10b981) and NST deep violet (#7c3aed)
 *   - ORANGE for Lavbund (extraction pillar)
 *
 * NST (Naturstyrelsen) uses deep violet throughout to avoid collision with the
 * "Godkendt" MARS phase blue (#3b82f6).
 */

export interface SeriesColor {
  /** Border / line / icon colour */
  stroke: string;
  /** Light background fill for area charts */
  fill: string;
  /** Solid foreground text / dot colour */
  text: string;
  /** Translucent background for badges and cards */
  bg: string;
  /** Tailwind border class (for toggle buttons, badges) */
  borderClass: string;
  /** Tailwind active-state classes (for toggle buttons) */
  activeClass: string;
}

/** Klimaskovfonden — Skovrejsning (afforestation, light purple) */
export const KSF_COLOR_SKOV: SeriesColor = {
  stroke:      '#c084fc',  // purple-400 — lighter than NST, distinct from MARS anlagt
  fill:        '#faf5ff',
  text:        '#9333ea',  // purple-600 for text/icons
  bg:          '#c084fc18',
  borderClass: 'border-purple-400',
  activeClass: 'border-purple-400 bg-purple-50 text-purple-800',
};

/** Klimaskovfonden — Lavbund (extraction, orange) */
export const KSF_COLOR_LAVBUND: SeriesColor = {
  stroke:      '#f97316',  // bright orange — matches funnel bar
  fill:        '#fff7ed',
  text:        '#c2410c',  // darker for text/icons
  bg:          '#f9731615',
  borderClass: 'border-orange-500',
  activeClass: 'border-orange-400 bg-orange-50 text-orange-800',
};

/**
 * Naturstyrelsen — always purple.
 * Purple avoids collision with the "Godkendt" MARS phase blue (#3b82f6).
 */
export const NST_COLOR: SeriesColor = {
  stroke:      '#7c3aed',
  fill:        '#f5f3ff',
  text:        '#7c3aed',
  bg:          '#7c3aed15',
  borderClass: 'border-violet-600',
  activeClass: 'border-violet-500 bg-violet-50 text-violet-800',
};

/** §3-arealer — teal */
export const SECTION3_COLOR: SeriesColor = {
  stroke:      '#0d9488',
  fill:        '#f0fdfa',
  text:        '#0d9488',
  bg:          '#0d948815',
  borderClass: 'border-teal-600',
  activeClass: 'border-teal-500 bg-teal-50 text-teal-800',
};

/** Natura 2000 — indigo */
export const NATURA2000_COLOR: SeriesColor = {
  stroke:      '#4338ca',
  fill:        '#eef2ff',
  text:        '#4338ca',
  bg:          '#4338ca15',
  borderClass: 'border-indigo-600',
  activeClass: 'border-indigo-500 bg-indigo-50 text-indigo-800',
};

/**
 * Lookup by supplement source ID.
 * For KSF the Skovrejsning palette is the default; callers that know the
 * pillar context should use KSF_COLOR_LAVBUND when in the extraction pillar.
 */
export const SUPPLEMENT_COLOR_BY_ID: Record<string, SeriesColor> = {
  ksf:       KSF_COLOR_SKOV,
  nst:       NST_COLOR,
  section3:  SECTION3_COLOR,
  natura2000: NATURA2000_COLOR,
};
