import { useCallback, useEffect, useRef } from 'react';
import { replaceSectionHash } from './slices/section';

export interface UseSectionHashSyncOptions {
  /** Suppress hash writes briefly after programmatic scroll (default 800 ms). */
  suppressMs?: number;
}

/**
 * Keep the URL hash in sync with scroll-spy active section.
 * Skips writing while the user is still at the top with a clean URL.
 */
export function useSectionHashSync(
  activeId: string | null,
  progress: number,
  { suppressMs = 800 }: UseSectionHashSyncOptions = {},
) {
  const suppressUntilRef = useRef(0);

  const suppressHashSync = useCallback(() => {
    suppressUntilRef.current = Date.now() + suppressMs;
  }, [suppressMs]);

  useEffect(() => {
    if (!activeId) return;
    if (Date.now() < suppressUntilRef.current) return;

    const currentHash = window.location.hash.slice(1);

    // Don't add a hash while the user is still at the top with a clean URL.
    if (progress === 0 && !currentHash) return;

    if (currentHash !== activeId) replaceSectionHash(activeId);
  }, [activeId, progress]);

  return { suppressHashSync };
}
