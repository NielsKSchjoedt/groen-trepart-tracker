import type { KommuneMetric } from '@/lib/kommune-metrics';
import type { NationalOverlayToken } from '@/lib/permalink/types';
import { parseMapOverlays, applyMapOverlaysToParams } from '@/lib/permalink/slices/map-national';
import type { PillarId } from '@/lib/pillars';

export type { NationalOverlayToken as KommuneMapOverlayToken };

/** Same default as national map — all Lag layers off until toggled. */
export const DEFAULT_KOMMUNE_MAP_OVERLAYS = new Set<NationalOverlayToken>();

export function parseKommuneMapOverlays(params: URLSearchParams): Set<NationalOverlayToken> {
  const parsed = parseMapOverlays(params);
  // KSF/NST belong to tilvalg= toggles on kommune pages — not Lag panel.
  parsed.delete('ksf');
  parsed.delete('nst');
  return parsed;
}

export function overlaysEqual(
  a: Set<NationalOverlayToken>,
  b: Set<NationalOverlayToken>,
): boolean {
  if (a.size !== b.size) return false;
  for (const token of a) {
    if (!b.has(token)) return false;
  }
  return true;
}

export function applyKommuneMapOverlays(
  params: URLSearchParams,
  overlays: Set<NationalOverlayToken>,
): void {
  applyMapOverlaysToParams(params, overlays, DEFAULT_KOMMUNE_MAP_OVERLAYS);
}

export function patchKommuneMapOverlay(
  overlays: Set<NationalOverlayToken>,
  token: NationalOverlayToken,
  on: boolean,
): Set<NationalOverlayToken> {
  const next = new Set(overlays);
  if (on) next.add(token);
  else next.delete(token);
  return next;
}

/** Map kommune choropleth metric to national pillar for Lag panel + WMS gating. */
export function kommuneMetricToLagPillar(metric: KommuneMetric): PillarId | null {
  if (metric === 'co2') return null;
  return metric;
}

export function isKommuneMapStubMetric(metric: KommuneMetric | null): boolean {
  return metric === 'co2' || metric === null;
}

export { buildMapLagLayerGroups } from '@/lib/map-lag-panel';
