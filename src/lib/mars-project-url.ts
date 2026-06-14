import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/** URL search-param key shared by map, funnel, and geography table. */
export const MARS_PROJECT_PARAM = 'projekt';

const MARS_PREFIX = 'mars:';

/** Build the URL param value for a MARS project. */
export function marsProjectUrlKey(geoId: string): string {
  return `${MARS_PREFIX}${geoId}`;
}

/** Parse a MARS geoId from the `projekt` URL param, if present. */
export function parseMarsGeoIdFromUrl(raw: string | null): string | null {
  if (!raw) return null;
  const pipeIdx = raw.indexOf('|');
  const key = pipeIdx >= 0 ? raw.slice(0, pipeIdx) : raw;
  if (!key.startsWith(MARS_PREFIX)) return null;
  return key.slice(MARS_PREFIX.length) || null;
}

/**
 * Read/write `?projekt=mars:<geoId>` for deep-linking MARS project details
 * across map, funnel, and geography table entry points.
 */
export function useMarsProjectUrl() {
  const [searchParams, setSearchParams] = useSearchParams();

  const marsGeoId = useMemo(
    () => parseMarsGeoIdFromUrl(searchParams.get(MARS_PROJECT_PARAM)),
    [searchParams],
  );

  const openMarsProject = useCallback((geoId: string, featureName?: string) => {
    if (!geoId) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const key = marsProjectUrlKey(geoId);
      next.set(MARS_PROJECT_PARAM, featureName ? `${key}|${featureName}` : key);
      return next;
    });
  }, [setSearchParams]);

  const closeMarsProject = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const raw = next.get(MARS_PROJECT_PARAM);
      if (raw && parseMarsGeoIdFromUrl(raw)) {
        next.delete(MARS_PROJECT_PARAM);
      }
      return next;
    });
  }, [setSearchParams]);

  return { marsGeoId, openMarsProject, closeMarsProject };
}
