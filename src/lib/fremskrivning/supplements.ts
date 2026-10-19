import { KSF_COLOR_LAVBUND, KSF_COLOR_SKOV, NST_COLOR } from '@/lib/supplement-colors';
import type { DashboardData } from '@/lib/types';
import type { FremskrivningPillarId, FremskrivningStageData } from './types';

/** Muted violet for NST projects still in progress (vs. completed). */
const NST_ONGOING_COLOR = '#a78bfa';

export function buildSupplementStages(
  data: DashboardData,
  pillar: FremskrivningPillarId,
): FremskrivningStageData[] {
  const prog = data.national.progress;
  const stages: FremskrivningStageData[] = [];

  if (pillar === 'afforestation') {
    const ksfHa = prog.afforestationKsfHa ?? 0;
    if (ksfHa > 0) {
      stages.push({
        id: 'ksf_skov',
        kind: 'supplement_completed',
        label: 'Klimaskovfonden',
        certainty: 'Realiseret (WFS)',
        certColor: KSF_COLOR_SKOV.stroke,
        opacity: 1,
        locked: false,
        description:
          'Frivillig skovrejsning uden for MARS — registreret via Klimaskovfondens offentlige projektkort. Arealerne tæller som etableret skov.',
        value: ksfHa,
        projectCount: prog.afforestationKsfProjectCount ?? 0,
      });
    }

    const nstCompletedHa = prog.afforestationNstCompletedHa ?? 0;
    if (nstCompletedHa > 0) {
      stages.push({
        id: 'nst_gennemfoert',
        kind: 'supplement_completed',
        label: 'Naturstyrelsen (gennemført)',
        certainty: 'Realiseret (WFS)',
        certColor: NST_COLOR.stroke,
        opacity: 1,
        locked: false,
        description:
          'Statslig skovrejsning matchet i MiljøGIS — projekter markeret som gennemført. Tæller som etableret skov uden for MARS.',
        value: nstCompletedHa,
        projectCount: prog.afforestationNstMatchedCount ?? 0,
      });
    }

    const nstOngoingHa = prog.afforestationNstOngoingHa ?? 0;
    if (nstOngoingHa > 0) {
      stages.push({
        id: 'nst_igang',
        kind: 'supplement_ongoing',
        label: 'Naturstyrelsen (i gang)',
        certainty: 'Høj sikkerhed',
        certColor: NST_ONGOING_COLOR,
        opacity: 0.35,
        locked: false,
        description:
          'Statslige skovprojekter i etablering — arealet er undervejs og forventes realiseret inden for planlagt horisont.',
        value: nstOngoingHa,
        projectCount: prog.afforestationNstMatchedCount ?? 0,
      });
    }
  }

  if (pillar === 'extraction') {
    const ksfLavbundHa = prog.extractionKsfLavbundHa ?? 0;
    if (ksfLavbundHa > 0) {
      stages.push({
        id: 'ksf_lavbund',
        kind: 'supplement_completed',
        label: 'Klimaskovfonden (lavbund)',
        certainty: 'Realiseret (WFS)',
        certColor: KSF_COLOR_LAVBUND.stroke,
        opacity: 1,
        locked: false,
        description:
          'Frivillige lavbundsprojekter via Klimaskovfonden — uden for MARS, men medregnet i lavbundsmålet.',
        value: ksfLavbundHa,
        projectCount: prog.extractionKsfLavbundCount ?? 0,
      });
    }
  }

  return stages;
}

/** Chart stacking: completed supplements at bottom, then MARS pipeline by maturity. */
export function sortStagesForStacking(stages: FremskrivningStageData[]): FremskrivningStageData[] {
  const order: Record<string, number> = {
    ksf_skov: 1,
    ksf_lavbund: 1,
    nst_gennemfoert: 2,
    anlagt: 3,
    nst_igang: 4,
    godkendt: 5,
    forundersoegt: 6,
    skitse: 7,
  };
  return [...stages].sort((a, b) => (order[a.id] ?? 99) - (order[b.id] ?? 99));
}

export function hasSupplementStages(stages: FremskrivningStageData[]): boolean {
  return stages.some((s) => s.kind !== 'mars');
}

export function isKursStage(stage: FremskrivningStageData): boolean {
  return stage.id === 'anlagt' || stage.kind === 'supplement_completed';
}

export function isPotentialStage(stage: FremskrivningStageData): boolean {
  return !isKursStage(stage);
}
