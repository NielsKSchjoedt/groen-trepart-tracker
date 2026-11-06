/** @deprecated Import from `@/lib/permalink` instead. */
export {
  PROJECT_PARAM as MARS_PROJECT_PARAM,
  marsProjectUrlKey,
  parseMarsGeoIdFromUrl,
  buildProjectParam,
  parseProjectParam,
} from '@/lib/permalink/slices/project-open';

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  parseMarsGeoIdFromUrl,
  buildProjectParam,
  parseProjectParam,
  PROJECT_PARAM,
} from '@/lib/permalink/slices/project-open';
import { clearGeoPanels } from '@/lib/permalink/slices/panels';

/**
 * Read/write `?projekt=` for deep-linking project details.
 * Supports mars, ksf, and nst sources.
 */
export function useMarsProjectUrl() {
  const [searchParams, setSearchParams] = useSearchParams();

  const projectOpen = useMemo(
    () => parseProjectParam(searchParams.get(PROJECT_PARAM)),
    [searchParams],
  );

  const marsGeoId = projectOpen?.source === 'mars' ? projectOpen.id : null;

  const openProject = useCallback(
    (source: 'mars' | 'ksf' | 'nst', id: string, featureName?: string) => {
      if (!id) return;
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(PROJECT_PARAM, buildProjectParam(source, id, featureName));
        clearGeoPanels(next);
        return next;
      });
    },
    [setSearchParams],
  );

  const openMarsProject = useCallback(
    (geoId: string, featureName?: string) => openProject('mars', geoId, featureName),
    [openProject],
  );

  const closeMarsProject = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.has(PROJECT_PARAM)) next.delete(PROJECT_PARAM);
      return next;
    });
  }, [setSearchParams]);

  return {
    marsGeoId,
    projectOpen,
    openMarsProject,
    openProject,
    closeMarsProject,
  };
}

export function useProjectUrl() {
  return useMarsProjectUrl();
}
