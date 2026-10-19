import { parseKommuneMapViewState, applyKommuneMapViewState } from '@/lib/kommune-map-params';
import type { KommuneMapViewState } from '@/lib/kommune-map-params';

export function decodeKommuneMap(params: URLSearchParams): KommuneMapViewState {
  return parseKommuneMapViewState(params);
}

export function applyKommuneMapToParams(
  params: URLSearchParams,
  state: KommuneMapViewState,
): void {
  applyKommuneMapViewState(params, state);
}

export { parseKommuneMetricParam } from '@/lib/kommune-map-params';
