import type { Chapter } from './chapters';

export const KOMMUNE_RANGLISTE_CHAPTER: Chapter = {
  id: 'rangliste',
  navLabel: 'Ranglister',
  eyebrow: 'Kommunerne, mål for mål',
  question: 'Fem mål. Fem ranglister.',
};

export const KOMMUNE_GEOGRAFI_CHAPTER: Chapter = {
  id: 'geografi',
  navLabel: 'Kort',
  eyebrow: 'Hvor sker indsatsen?',
  question: 'Se kommunerne på kortet',
};

/** Master table of all 98 municipalities — scroll anchor for StickyNav. */
export const KOMMUNE_LISTE_CHAPTER: Chapter = {
  id: 'kommuneliste',
  navLabel: 'Den fulde liste',
  eyebrow: 'Alle kommuner, side om side',
  question: 'Den fulde liste',
};

export const KOMMUNE_RANGLISTE_INTRO =
  'Tre leveringsmål — lavbund, skov og kvælstof — målt ift. ansvar, ikke rå hektar. Standardvisning: kun anlagt; udvid fasefilteret for pipeline. Skov inkluderer MARS + KSF + NST.';

export const KOMMUNE_GEOGRAFI_INTRO =
  'Vælg et indsatsområde og fasefilter (standard: kun anlagt). Klik en kommune på kortet for at dykke ned i den enkelte kommune.';

export const KOMMUNE_LISTE_INTRO =
  'Alle 98 kommuner på lavbund, skov og kvælstof på én gang. Samme filtre som ranglisten ovenfor — område, måleenhed og projektfaser. Klik en kolonne for at sortere, søg din egen kommune, eller klik en række for detaljer.';

/**
 * Narrative chapters for `/kommuner` (storytelling scroll + StickyNav).
 *
 * @example getKommuneChapters().map((c) => c.id) // ['rangliste', 'geografi', 'kommuneliste']
 */
export function getKommuneChapters(): Chapter[] {
  return [
    KOMMUNE_RANGLISTE_CHAPTER,
    KOMMUNE_GEOGRAFI_CHAPTER,
    KOMMUNE_LISTE_CHAPTER,
  ];
}
