import { useEffect, useState } from 'react';

export interface ScrollSpyState {
  /** Id of the chapter currently considered active, or null before first match */
  activeId: string | null;
  /** Overall page scroll progress, 0–1 */
  progress: number;
}

/**
 * Track which of a set of section anchors is currently in view and how far
 * the user has scrolled down the page.
 *
 * Active detection is scroll-position based: the active chapter is the last one
 * whose top has passed a trigger line just below the sticky nav. The trigger
 * `offset` is aligned with the chapters' `scroll-mt` so that clicking a chapter
 * (which scrolls its top to that same line) marks it active immediately, rather
 * than only after scrolling a little further.
 *
 * @param ids    - Ordered list of element ids to track (without '#')
 * @param offset - Trigger line in px from the viewport top (default 96, just
 *                 above the chapters' 80px scroll-margin so a freshly-scrolled
 *                 section registers right away)
 * @returns The active chapter id and the page scroll progress (0–1)
 *
 * @example
 * const { activeId, progress } = useScrollSpy(['delmaal', 'projekter', 'oekonomi']);
 */
export function useScrollSpy(ids: string[], offset = 96): ScrollSpyState {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);
  const [progress, setProgress] = useState(0);

  // Serialise ids so the effect re-runs only when the actual list changes,
  // not on every render that produces a new array reference.
  const idsKey = ids.join('|');

  useEffect(() => {
    const sectionIds = idsKey ? idsKey.split('|') : [];
    if (sectionIds.length === 0) return;

    let rafId = 0;

    const compute = () => {
      rafId = 0;

      // Active chapter: the last section whose top has crossed the trigger line.
      let current = sectionIds[0];
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= offset) current = id;
      }

      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const atBottom = scrollable > 0 && window.scrollY >= scrollable - 2;
      // At the very bottom the last section's top may never reach the trigger
      // line, so force it active once the page can't scroll any further.
      if (atBottom) current = sectionIds[sectionIds.length - 1];

      setActiveId(current);
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0);
    };

    const onScroll = () => {
      if (!rafId) rafId = requestAnimationFrame(compute);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    compute();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [idsKey, offset]);

  return { activeId, progress };
}
