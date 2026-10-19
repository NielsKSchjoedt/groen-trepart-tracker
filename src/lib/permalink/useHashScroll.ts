import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { parseSectionHash } from './slices/section';

export interface UseHashScrollOptions {
  /** Section ids valid on this page — scroll ignored if hash not in list (when non-empty). */
  chapterIds?: string[];
  /** Wait until page data / lazy sections are ready before scrolling. */
  ready?: boolean;
  /** Max wait in ms before giving up (default 5000). */
  timeoutMs?: number;
}

/**
 * Scroll to hash target once DOM (and optional data) is ready.
 * Handles async-loaded sections that would miss a one-shot scroll on first paint.
 */
export function useHashScroll({
  chapterIds = [],
  ready = true,
  timeoutMs = 5000,
}: UseHashScrollOptions): void {
  const location = useLocation();
  const scrolledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    const params = new URLSearchParams(location.search);
    const targetId = parseSectionHash(location.hash, params);
    if (!targetId) return;
    if (chapterIds.length > 0 && !chapterIds.includes(targetId)) return;

    const scrollKey = `${location.pathname}${location.search}#${targetId}`;
    if (scrolledRef.current === scrollKey) return;

    const start = Date.now();

    const tryScroll = () => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'start' });
        scrolledRef.current = scrollKey;
        // Clean up fane alias from URL after redirecting to hash
        if (params.has('fane')) {
          const url = new URL(window.location.href);
          url.searchParams.delete('fane');
          window.history.replaceState(null, '', url.toString());
        }
        return;
      }
      if (Date.now() - start < timeoutMs) {
        requestAnimationFrame(tryScroll);
      }
    };

    requestAnimationFrame(tryScroll);
  }, [location.pathname, location.search, location.hash, chapterIds, ready, timeoutMs]);
}
