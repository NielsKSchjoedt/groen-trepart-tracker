import type { PillarId } from './pillars';

/**
 * A single narrative chapter on the national/pillar view. Each chapter answers
 * one plain-language question and owns a scroll anchor used by both the section
 * indicator (StickyNav) and the scrollspy.
 */
export interface Chapter {
  /** Anchor id (without leading '#'); also the scroll target */
  id: string;
  /** Short label shown in the section indicator */
  navLabel: string;
  /** Small eyebrow label above the chapter heading */
  eyebrow: string;
  /** The plain-language question the chapter answers (the big heading) */
  question: string;
}

/** Chapter shown in both overview and every pillar view: the five løfter. */
export const DELMAAL_CHAPTER: Chapter = {
  id: 'delmaal',
  navLabel: 'Målene',
  eyebrow: 'Forstå fremdriften på de fem delmål',
  question: 'Hvor langt er vi nået?',
};

/** Chapter shown in both overview and every pillar view: financing. */
export const OEKONOMI_CHAPTER: Chapter = {
  id: 'oekonomi',
  navLabel: 'Økonomi',
  eyebrow: 'Forstå hvor pengene skal komme fra',
  question: 'Er der penge nok til at nå målene?',
};

/** Lead copy for the økonomi chapter — shared by overview and pillar views. */
export const OEKONOMI_INTRO =
  'Aftalen er bakket op af milliarder — men trepartsøkonomien er ikke ét tal. ' +
  'Pengene løber i to adskilte strømme, og en tredje regning, driften, er endnu ikke afsat.';

export const PROJEKTER_CHAPTER: Chapter = {
  id: 'projekter',
  navLabel: 'Projekter',
  eyebrow: 'Forstå projekterne der skal få os i mål',
  question: 'Hvad gør vi konkret?',
};

export const FREMSKRIVNING_CHAPTER: Chapter = {
  id: 'fremskrivning',
  navLabel: 'Fremskrivning',
  eyebrow: 'Hvad nu hvis vi fortsætter i samme tempo?',
  question: 'Hvor langt rækker det — og når vi det i tide?',
};

export const GEOGRAFI_CHAPTER: Chapter = {
  id: 'geografi',
  navLabel: 'Udforsk geografi',
  eyebrow: 'Udforsk geografien',
  question: 'Hvor i Danmark sker det?',
};

/** Lead paragraph for the geography chapter — one per pillar with map data. */
const GEOGRAFI_INTRO: Record<Exclude<PillarId, 'co2'>, string> = {
  nitrogen:
    'Kvælstof er det eneste delmål der er fagligt forankret i vandgeografien: hvert kystvandopland har sit eget reduktionskrav. Derfor er kystvandoplande grundkortet — og du kan skifte til de 23 hovedvandoplande. Selve projekterne ligger altid ovenpå.',
  extraction:
    'Lavbundsudtag har ikke en naturlig vandgeografi. Tallene vises pr. kystvandopland, fordi det er dér de lokale treparter registrerer og summerer projekterne — ikke fordi lavbund “hører til” et kystvand. Baggrunden er altså mest planlægnings-kontekst; det centrale er projekterne (og Klimaskovfondens arealer) ovenpå.',
  afforestation:
    'Skovrejsning har heller ingen iboende vandgeografi — projekterne er bare registreret pr. kystvandopland hos de lokale treparter. Se baggrunden som kontekst og fokusér på projekterne: kortet samler MARS, Klimaskovfonden og Naturstyrelsen, så du ser hvor der faktisk plantes skov.',
  nature:
    'Naturmålet (20 % beskyttet natur) har ingen vandgeografi. Den meningsfulde enhed er kommuner og den faktiske natur (§3, Natura 2000, biodiversitetskort). Derfor er den farvede baggrund som udgangspunkt slået fra — her handler kortet om overlappet mellem projekter og eksisterende natur.',
};

/** Scannable slash hints for the interactive map — what layers and toggles unlock. */
const MAP_LAYER_HINTS: Record<Exclude<PillarId, 'co2'>, string> = {
  nitrogen: 'Sammenlign vandoplande / se reduktion mod mål / tjek kystvandenes tilstand',
  extraction: 'Find lavbundspotentialet / følg projekter pr. opland / se Klimaskovfondens arealer',
  afforestation: 'Se hvor skoven vokser / sammenlign vandoplande / find statslige og fondsprojekter',
  nature: 'Forstå hvor naturen er / se genopretningspotentiale / læg biodiversitetskort på',
};

/**
 * Plain-language intro for the geography chapter on pillar pages.
 *
 * @example getGeografiIntro('nitrogen')
 */
export function getGeografiIntro(pillarId: Exclude<PillarId, 'co2'>): string {
  return GEOGRAFI_INTRO[pillarId];
}

/**
 * Slash-separated hints shown under "Kort over Danmark" — what the map layers do
 * for the active pillar.
 *
 * @example getMapLayerHints('nature') // "Forstå hvor naturen er / ..."
 */
export function getMapLayerHints(pillarId: Exclude<PillarId, 'co2'>): string {
  return MAP_LAYER_HINTS[pillarId];
}

export const CO2DATA_CHAPTER: Chapter = {
  id: 'co2',
  navLabel: 'CO₂-data',
  eyebrow: 'Danmarks vej mod 70 %-målet',
  question: 'Hvordan ser udledningen ud?',
};

/**
 * Build the ordered chapter list for the active context.
 *
 * - Overview (no pillar): kun de to letvægtskapitler (løfter + økonomi).
 * - CO₂: løfter → CO₂-data → økonomi (ingen projekt-pipeline eller kort).
 * - Øvrige delmål: løfter → projekter → geografi → fremskrivning → økonomi.
 *
 * @param activePillar - Active pillar id, or null on the overview page
 * @example getChapters('extraction') // [delmaal, projekter, geografi, fremskrivning, oekonomi]
 */
export function getChapters(activePillar: PillarId | null): Chapter[] {
  if (activePillar === null) {
    return [DELMAAL_CHAPTER, OEKONOMI_CHAPTER];
  }
  if (activePillar === 'co2') {
    return [DELMAAL_CHAPTER, CO2DATA_CHAPTER, OEKONOMI_CHAPTER];
  }
  return [
    DELMAAL_CHAPTER,
    PROJEKTER_CHAPTER,
    GEOGRAFI_CHAPTER,
    FREMSKRIVNING_CHAPTER,
    OEKONOMI_CHAPTER,
  ];
}

/**
 * Section hash after picking a delmål from the overview map picker — keeps
 * the viewport on the map instead of jumping to the page top.
 */
export function getPillarMapPickHash(pillarId: PillarId): string {
  return pillarId === 'co2' ? CO2DATA_CHAPTER.id : 'kort';
}

/** Extra scroll anchors beyond {@link getChapters} (nested map viewport, overview picker). */
export function getExtraHashScrollIds(activePillar: PillarId | null): string[] {
  if (activePillar === null) return ['kort-udforsk'];
  if (activePillar === 'co2') return [];
  return ['kort'];
}
