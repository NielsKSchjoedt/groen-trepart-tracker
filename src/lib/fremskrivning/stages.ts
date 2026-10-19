import type {
  FremskrivningMarsStageId,
  FremskrivningPillarId,
  FremskrivningStageData,
  FremskrivningStageId,
  FremskrivningStageMeta,
  StageSelection,
} from './types';

const STAGE_ORDER: FremskrivningMarsStageId[] = ['anlagt', 'godkendt', 'forundersoegt', 'skitse'];

const BASE_STAGES: Record<FremskrivningMarsStageId, Omit<FremskrivningStageMeta, 'description' | 'kind'> & { descriptions: Record<FremskrivningPillarId, string> }> = {
  anlagt: {
    id: 'anlagt',
    kind: 'mars',
    marsPhase: 'established',
    label: 'Gennemførte',
    certainty: 'Realiseret',
    certColor: '#16a34a',
    opacity: 1,
    locked: true,
    descriptions: {
      nitrogen:
        'Færdige projekter, der er i drift. Det eneste, der tæller med i den faktiske fremdrift i dag.',
      extraction:
        'Færdige projekter, hvor arealet er gennemført. Det eneste, der tæller med i den faktiske fremdrift i dag.',
      afforestation:
        'Færdige projekter, hvor skoven er etableret. Det eneste, der tæller med i den faktiske fremdrift i dag.',
    },
  },
  godkendt: {
    id: 'godkendt',
    kind: 'mars',
    marsPhase: 'establishment_grant',
    label: 'Godkendte',
    certainty: 'Høj sikkerhed',
    certColor: '#65a30d',
    opacity: 0.6,
    locked: false,
    descriptions: {
      nitrogen:
        'Finansieret og godkendt — venter på at blive gennemført. Bliver de til virkelighed, kommer effekten.',
      extraction:
        'Finansieret og godkendt — venter på at blive gennemført. Bliver de til virkelighed, kommer arealet med.',
      afforestation:
        'Finansieret og godkendt — venter på at blive gennemført. Bliver de til virkelighed, kommer arealet med.',
    },
  },
  forundersoegt: {
    id: 'forundersoegt',
    kind: 'mars',
    marsPhase: 'preliminary_grant',
    label: 'Forundersøgelse',
    certainty: 'Middel',
    certColor: '#eab308',
    opacity: 0.38,
    locked: false,
    descriptions: {
      nitrogen:
        'Under faglig vurdering. Lovende, men en del falder fra, inden de bliver til projekter.',
      extraction:
        'Under faglig vurdering. Lovende, men en del falder fra, inden de bliver til projekter.',
      afforestation:
        'Under faglig vurdering. Lovende, men en del falder fra, inden de bliver til projekter.',
    },
  },
  skitse: {
    id: 'skitse',
    kind: 'mars',
    marsPhase: 'sketch',
    label: 'Skitser',
    certainty: 'Lav — tidlig idé',
    certColor: '#dc2626',
    opacity: 0.2,
    locked: false,
    dashed: true,
    descriptions: {
      nitrogen:
        'Tidlige ansøgninger og idéer. Langt størstedelen af pipelinen — men med stor usikkerhed om, hvor mange der nogensinde gennemføres.',
      extraction:
        'Tidlige ansøgninger og idéer. Langt størstedelen af pipelinen — men med stor usikkerhed om, hvor mange der nogensinde gennemføres.',
      afforestation:
        'Tidlige ansøgninger og idéer. Langt størstedelen af pipelinen — men med stor usikkerhed om, hvor mange der nogensinde gennemføres.',
    },
  },
};

export function getStageMetas(pillar: FremskrivningPillarId): FremskrivningStageMeta[] {
  return STAGE_ORDER.map((id) => {
    const base = BASE_STAGES[id];
    return {
      id: base.id,
      kind: base.kind,
      marsPhase: base.marsPhase,
      label: base.label,
      certainty: base.certainty,
      certColor: base.certColor,
      opacity: base.opacity,
      locked: base.locked,
      dashed: base.dashed,
      description: base.descriptions[pillar],
    };
  });
}

export const DEFAULT_MARS_STAGE_SELECTION: Record<
  Exclude<FremskrivningMarsStageId, 'anlagt'>,
  boolean
> = {
  godkendt: false,
  forundersoegt: false,
  skitse: false,
};

/** @deprecated Use buildEffectiveSelection — kept for imports. */
export const DEFAULT_STAGE_SELECTION = DEFAULT_MARS_STAGE_SELECTION;

function defaultSelectedForStage(stage: FremskrivningStageData): boolean {
  if (stage.locked) return true;
  if (stage.kind === 'supplement_completed' || stage.kind === 'supplement_ongoing') return true;
  return DEFAULT_MARS_STAGE_SELECTION[stage.id as Exclude<FremskrivningMarsStageId, 'anlagt'>] ?? false;
}

export function buildEffectiveSelection(
  stages: FremskrivningStageData[],
  overrides: StageSelection = {},
): Record<Exclude<FremskrivningStageId, 'anlagt'>, boolean> {
  const out = {} as Record<Exclude<FremskrivningStageId, 'anlagt'>, boolean>;
  for (const stage of stages) {
    if (stage.locked || stage.id === 'anlagt') continue;
    out[stage.id] = overrides[stage.id] ?? defaultSelectedForStage(stage);
  }
  return out;
}

export function isStageActive(
  stage: FremskrivningStageData,
  selection: StageSelection = {},
): boolean {
  if (stage.locked || stage.id === 'anlagt') return true;
  const effective = buildEffectiveSelection(
    [stage],
    selection,
  );
  return effective[stage.id as Exclude<FremskrivningStageId, 'anlagt'>] ?? defaultSelectedForStage(stage);
}

export function getActiveStages(
  stages: FremskrivningStageData[],
  selection: StageSelection,
): FremskrivningStageData[] {
  return stages.filter((s) => isStageActive(s, selection));
}
