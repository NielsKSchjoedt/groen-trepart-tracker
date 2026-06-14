import type { PanelState } from '../types';
import { DEFAULT_PANELS } from '../defaults';
import { PERMALINK_KEYS } from '../schema';

export function decodePanels(params: URLSearchParams): PanelState {
  return {
    opland: params.get(PERMALINK_KEYS.opland),
    plan: params.get(PERMALINK_KEYS.plan),
    kystvand: params.get(PERMALINK_KEYS.kystvand),
    vandplan: params.get(PERMALINK_KEYS.vandplan),
  };
}

export function applyPanelsToParams(
  params: URLSearchParams,
  state: PanelState,
  defaults: PanelState = DEFAULT_PANELS,
): void {
  for (const key of [PERMALINK_KEYS.opland, PERMALINK_KEYS.plan, PERMALINK_KEYS.kystvand, PERMALINK_KEYS.vandplan] as const) {
    params.delete(key);
  }
  if (state.opland) params.set(PERMALINK_KEYS.opland, state.opland);
  if (state.plan) params.set(PERMALINK_KEYS.plan, state.plan);
  if (state.kystvand) params.set(PERMALINK_KEYS.kystvand, state.kystvand);
  if (state.vandplan) params.set(PERMALINK_KEYS.vandplan, state.vandplan);
}

/** Geography panels are mutually exclusive with project panel on national map. */
export function clearGeoPanels(params: URLSearchParams): void {
  params.delete(PERMALINK_KEYS.opland);
  params.delete(PERMALINK_KEYS.plan);
  params.delete(PERMALINK_KEYS.kystvand);
}

export const PROJECT_PARAM = PERMALINK_KEYS.projekt;
