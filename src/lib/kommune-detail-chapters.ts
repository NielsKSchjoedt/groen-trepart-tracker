import type { Chapter } from './chapters';
import { hasProcesData } from '@/lib/kommune-proces';
import type { KommuneMetrics, KommuneRankingData, KommuneCO2Data, Plan } from '@/lib/types';

export const KOMMUNE_DETAIL_STATUS_CHAPTER: Chapter = {
  id: 'status',
  navLabel: 'Status',
  eyebrow: 'Kommunens placering',
  question: 'Hvor står kommunen?',
};

export const KOMMUNE_DETAIL_KORT_CHAPTER: Chapter = {
  id: 'kort',
  navLabel: 'Kort',
  eyebrow: 'Geografi',
  question: 'Se kommunen på kortet',
};

export const KOMMUNE_DETAIL_NOEGLETAL_CHAPTER: Chapter = {
  id: 'noegletal',
  navLabel: 'Nøgletal',
  eyebrow: 'Registreret indsats',
  question: 'Hvad har kommunen leveret?',
};

export const KOMMUNE_DETAIL_FASEPROFIL_CHAPTER: Chapter = {
  id: 'faseprofil',
  navLabel: 'Proces',
  eyebrow: 'Lokal fremdrift',
  question: 'Hvor langt er kommunen i faserne — og hvordan ser det ud i forhold til naboerne?',
};

export const KOMMUNE_DETAIL_NATUR_CHAPTER: Chapter = {
  id: 'natur',
  navLabel: 'Natur & opland',
  eyebrow: 'Geografisk kontekst',
  question: 'Hvordan ser naturen og vandoplandene ud?',
};

export const KOMMUNE_DETAIL_CO2_CHAPTER: Chapter = {
  id: 'co2',
  navLabel: 'CO₂',
  eyebrow: 'Kommunal klimabalance',
  question: 'Hvordan ser udledningen ud?',
};

export const KOMMUNE_DETAIL_PROJEKTER_CHAPTER: Chapter = {
  id: 'projekter',
  navLabel: 'Projekter',
  eyebrow: 'Konkrete indsatser',
  question: 'Hvad sker der i kommunen?',
};

export const KOMMUNE_DETAIL_STATUS_INTRO =
  'Tre leveringsmål — lavbund, skov og kvælstof — målt ift. ansvar mod kommunens andel af nationalt naturpotentiale. 1,0× = som forventet; højere = leverer mere end ansvaret tilsiger.';

export const KOMMUNE_DETAIL_KORT_INTRO =
  'Vælg indsatsområde, fasefilter og supplerende kilder. Kortet fremhæver den valgte kommune — klik en nabokommune for at skifte.';

export const KOMMUNE_DETAIL_NOEGLETAL_INTRO =
  'Samlet registreret indsats på tværs af indsatsområder — uafhængigt af hvilken metrik du har valgt på kortet.';

export const KOMMUNE_DETAIL_FASEPROFIL_INTRO =
  'Andel af kommunens MARS-projekter i hver fase — målt i hektar og sammenlignet med naboer i samme lokale trepart og med landsgennemsnittet. Viser både momentum (antal og hektar) og seneste milepæle.';

export const KOMMUNE_DETAIL_NATUR_INTRO =
  'Vandoplande kommunen overlapper med, og benchmark for beskyttet natur (DCE 30 %, §3 og Natura 2000).';

export const KOMMUNE_DETAIL_CO2_INTRO =
  'Samlet CO₂e-udledning per kommune fra Energi- og CO₂-regnskabet — adskilt fra Grøn Trepart-indsatsen.';

export const KOMMUNE_DETAIL_PROJEKTER_INTRO =
  'Udvikling over tid, MARS-projekter og supplerende kilder — ét kort ad gangen, samme struktur hele vejen ned.';

/** @deprecated Use `Chapter` from `./chapters` */
export type KommuneDetailChapter = Chapter;

export interface KommuneDetailChapterContext {
  kommune: KommuneMetrics;
  ranking: KommuneRankingData | null;
  co2Data: KommuneCO2Data | null;
  /** MARS plan drill-down for proces & fremdrift section. */
  plans: Pick<Plan, 'id' | 'name' | 'projectDetails'>[];
}

/** Ordered StickyNav chapters for a kommune detail page — skips sections without data. */
export function getKommuneDetailChapters(ctx: KommuneDetailChapterContext): Chapter[] {
  const chapters: Chapter[] = [
    KOMMUNE_DETAIL_STATUS_CHAPTER,
    KOMMUNE_DETAIL_KORT_CHAPTER,
    KOMMUNE_DETAIL_NOEGLETAL_CHAPTER,
  ];

  if (hasProcesData({ plans: ctx.plans }, ctx.kommune.navn)) {
    chapters.push(KOMMUNE_DETAIL_FASEPROFIL_CHAPTER);
  }

  chapters.push(KOMMUNE_DETAIL_NATUR_CHAPTER);
  chapters.push(KOMMUNE_DETAIL_PROJEKTER_CHAPTER);

  if (ctx.co2Data) {
    chapters.push(KOMMUNE_DETAIL_CO2_CHAPTER);
  }

  return chapters;
}
