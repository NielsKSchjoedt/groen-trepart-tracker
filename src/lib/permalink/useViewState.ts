import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { parseViewState, toSearchParams, resolveRouteContext } from './compose';
import type { ViewState } from './types';
import { replaceSectionHash } from './slices/section';

const DEBOUNCE_MS = 300;

/** Read parsed view state from the current URL. */
export function useParsedViewState(): ViewState {
  const location = useLocation();
  return useMemo(() => parseViewState(location), [location]);
}

/**
 * Patch query params with debounce (replace) for rapid toggles.
 * Pass `immediate: true` to skip debounce (e.g. before copy-link).
 */
export function usePermalinkPatch() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const ctx = useMemo(() => resolveRouteContext(location.pathname), [location.pathname]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Partial<ViewState> | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!pendingRef.current) return;
    const patch = pendingRef.current;
    pendingRef.current = null;
    setSearchParams((prev) => toSearchParams(patch, ctx, prev), { replace: true });
  }, [ctx, setSearchParams]);

  const patch = useCallback(
    (partial: Partial<ViewState>, options?: { immediate?: boolean }) => {
      pendingRef.current = { ...pendingRef.current, ...partial };
      if (options?.immediate) {
        flush();
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { patch, flush, ctx, searchParams, setSearchParams };
}

/** Update section hash without navigation. */
export function useSectionHashWriter() {
  return useCallback((section: string | null) => {
    replaceSectionHash(section);
  }, []);
}

export { useParsedViewState as useViewState };
