import type { ProjectOpenState, ProjectSource } from '../types';
import { PERMALINK_KEYS } from '../schema';

const PREFIXES: ProjectSource[] = ['mars', 'ksf', 'nst'];

export function buildProjectParam(source: ProjectSource, id: string, featureName?: string): string {
  const key = `${source}:${id}`;
  return featureName ? `${key}|${featureName}` : key;
}

/** Parse `projekt=mars:<id>[|name]` — never throws. */
export function parseProjectParam(raw: string | null): ProjectOpenState | null {
  if (!raw) return null;
  const pipeIdx = raw.indexOf('|');
  const key = pipeIdx >= 0 ? raw.slice(0, pipeIdx) : raw;
  const featureName = pipeIdx >= 0 ? raw.slice(pipeIdx + 1) : undefined;
  for (const prefix of PREFIXES) {
    const p = `${prefix}:`;
    if (key.startsWith(p)) {
      const id = key.slice(p.length);
      if (!id) return null;
      return { source: prefix, id, featureName: featureName || undefined };
    }
  }
  return null;
}

export function decodeProjectOpen(params: URLSearchParams): ProjectOpenState | null {
  return parseProjectParam(params.get(PERMALINK_KEYS.projekt));
}

export function applyProjectOpenToParams(
  params: URLSearchParams,
  state: ProjectOpenState | null,
): void {
  params.delete(PERMALINK_KEYS.projekt);
  if (state) {
    params.set(
      PERMALINK_KEYS.projekt,
      buildProjectParam(state.source, state.id, state.featureName),
    );
  }
}

/** @deprecated Use parseProjectParam — kept for mars-project-url re-export. */
export function parseMarsGeoIdFromUrl(raw: string | null): string | null {
  const parsed = parseProjectParam(raw);
  return parsed?.source === 'mars' ? parsed.id : null;
}

export function marsProjectUrlKey(geoId: string): string {
  return buildProjectParam('mars', geoId);
}

export const PROJECT_PARAM = PERMALINK_KEYS.projekt;

export { PERMALINK_KEYS };
