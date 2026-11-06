import type { FremskrivningStageId } from '@/lib/fremskrivning';
import type { FremskrivningUrlState } from '../types';
import { DEFAULT_FREMSKRIVNING } from '../defaults';
import { PERMALINK_KEYS } from '../schema';

const VALID_STAGES = new Set<string>([
  'godkendt', 'forundersoegt', 'skitse',
  'ksf_skov', 'nst_gennemfoert', 'nst_igang', 'ksf_lavbund',
]);

/** Encodes explicit "all optional stages off" — avoids `?frem=` abutting `#section`. */
export const FREMSKRIVNING_EMPTY_TOKEN = 'ingen';

export function decodeFremskrivning(params: URLSearchParams): FremskrivningUrlState {
  const explicit = params.has(PERMALINK_KEYS.frem);
  const raw = params.get(PERMALINK_KEYS.frem);
  const activeStages = new Set<Exclude<FremskrivningStageId, 'anlagt'>>();
  if (raw && raw !== FREMSKRIVNING_EMPTY_TOKEN) {
    for (const token of raw.split(',')) {
      const t = token.trim();
      if (VALID_STAGES.has(t)) {
        activeStages.add(t as Exclude<FremskrivningStageId, 'anlagt'>);
      }
    }
  }
  return { activeStages, explicit };
}

export function applyFremskrivningToParams(
  params: URLSearchParams,
  state: FremskrivningUrlState,
  defaults: FremskrivningUrlState = DEFAULT_FREMSKRIVNING,
): void {
  params.delete(PERMALINK_KEYS.frem);
  if (state.explicit && state.activeStages.size > 0) {
    params.set(PERMALINK_KEYS.frem, [...state.activeStages].sort().join(','));
  } else if (state.explicit && state.activeStages.size === 0) {
    // Explicit empty selection (only anlagt) — never use empty string (collides visually with #hash).
    params.set(PERMALINK_KEYS.frem, FREMSKRIVNING_EMPTY_TOKEN);
  }
}

/** Convert URL state to StageSelection overrides for FremskrivningCard. */
export function fremskrivningToSelectionOverrides(
  state: FremskrivningUrlState,
  optionalStageIds: Exclude<FremskrivningStageId, 'anlagt'>[],
): Partial<Record<Exclude<FremskrivningStageId, 'anlagt'>, boolean>> {
  if (!state.explicit) return {};
  const out: Partial<Record<Exclude<FremskrivningStageId, 'anlagt'>, boolean>> = {};
  for (const id of optionalStageIds) {
    out[id] = state.activeStages.has(id);
  }
  return out;
}

/** Build URL state from active optional stages (always explicit). */
export function activeStagesToFremskrivning(
  activeStages: Set<Exclude<FremskrivningStageId, 'anlagt'>>,
): FremskrivningUrlState {
  return { activeStages, explicit: true };
}

/** @deprecated Use activeStagesToFremskrivning */
export function selectionOverridesToFremskrivning(
  overrides: Partial<Record<Exclude<FremskrivningStageId, 'anlagt'>, boolean>>,
  optionalStageIds: Exclude<FremskrivningStageId, 'anlagt'>[],
): FremskrivningUrlState {
  const activeStages = new Set<Exclude<FremskrivningStageId, 'anlagt'>>();
  for (const id of optionalStageIds) {
    if (overrides[id]) activeStages.add(id);
  }
  return { activeStages, explicit: true };
}
