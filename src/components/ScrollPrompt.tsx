import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronDown, TreePine, Map, Droplets, Target, Waves, Layers, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const SCROLL_HIDE_THRESHOLD = 350;
const APPEAR_DELAY_MS = 1500;
const ROTATE_INTERVAL_MS = 4000;
const FADE_DURATION_MS = 400;

interface RotatingItem {
  icon: LucideIcon;
  text: string;
}

const ROTATING_MESSAGES: readonly RotatingItem[] = [
  { icon: TreePine, text: 'Se hvilke skovrejsningsprojekter der er startet nær dig' },
  { icon: Map, text: 'Sammenlign kommunernes fremskridt på Danmarkskortet' },
  { icon: Droplets, text: 'Udforsk konkrete vådområder og lavbundsprojekter' },
  { icon: Target, text: 'Find ud af om kvælstofreduktionen i dit vandopland er på sporet' },
  { icon: Waves, text: 'Se hvordan de 37 kystvandoplande klarer sig mod deres mål' },
  { icon: Layers, text: 'Dyk ned i projektpipelinen — fra skitse til færdigt anlæg' },
];

/**
 * Hook that cycles through an array of items with a crossfade effect.
 *
 * @param items         - Array of items to rotate through
 * @param interval      - Time in ms each item is shown
 * @param fadeDuration  - Time in ms for the fade-out before switching
 * @returns [currentItem, isVisible]
 *
 * @example
 * const [item, vis] = useRotatingItem(ITEMS, 4000, 400);
 */
function useRotatingItem<T>(
  items: readonly T[],
  interval: number,
  fadeDuration: number,
): [T, boolean] {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const tick = () => {
      setVisible(false);
      timeoutRef.current = setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setVisible(true);
      }, fadeDuration);
    };
    const id = setInterval(tick, interval);
    return () => {
      clearInterval(id);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [items.length, interval, fadeDuration]);

  return [items[index], visible];
}

/**
 * Scroll prompt that invites users to explore the rest of the page.
 * Uses the same visual style as HintCallout for consistency.
 *
 * A rotating teaser message cycles through things you can do on the page,
 * paired with a bouncing down-arrow.
 *
 * - **Desktop (md+)**: fixed element on the right side of the viewport, fades
 *   out once the user scrolls past the hero section.
 * - **Mobile**: inline card rendered in the page flow (placed after the hero
 *   in Index.tsx).
 *
 * Clicking scrolls down; the X button or scrolling past the hero dismisses it.
 *
 * @example <ScrollPrompt />
 */
export function ScrollPrompt() {
  const [scrolledPast, setScrolledPast] = useState(false);
  const [appeared, setAppeared] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [current, messageVisible] = useRotatingItem(
    ROTATING_MESSAGES,
    ROTATE_INTERVAL_MS,
    FADE_DURATION_MS,
  );
  const Icon = current.icon;

  useEffect(() => {
    const timer = setTimeout(() => setAppeared(true), APPEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolledPast(window.scrollY > SCROLL_HIDE_THRESHOLD);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollDown = useCallback(() => {
    window.scrollBy({ top: window.innerHeight * 0.75, behavior: 'smooth' });
  }, []);

  const dismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
  }, []);

  const desktopVisible = appeared && !scrolledPast && !dismissed;

  const box = (
    <div className="relative hint-float-anim">
      <div className="bg-primary/[0.25] backdrop-blur-sm border border-primary/45 rounded-xl pl-3.5 pr-8 py-3 shadow-md max-w-[240px]">
        <div
          className={[
            'flex items-start gap-2 min-h-[2rem]',
            'transition-opacity',
            messageVisible ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
        >
          <Icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" strokeWidth={1.8} />
          <span className="text-xs font-medium text-primary leading-snug">{current.text}</span>
        </div>
      </div>
      <span
        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-primary/50 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        aria-hidden="true"
        onClick={dismiss}
      >
        <X className="w-3 h-3" strokeWidth={2.5} />
      </span>
    </div>
  );

  return (
    <>
      {/* Desktop: fixed right-side prompt */}
      <div
        className={[
          'hidden md:flex fixed right-5 top-1/2 -translate-y-1/2 z-40',
          'flex-col items-center gap-2 cursor-pointer select-none',
          'transition-all duration-500 ease-out',
          desktopVisible
            ? 'opacity-100 translate-x-0'
            : 'opacity-0 translate-x-6 pointer-events-none',
        ].join(' ')}
        onClick={scrollDown}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') scrollDown(); }}
        aria-label="Rul ned for at udforske siden"
      >
        {box}
        <ChevronDown
          className="w-5 h-5 text-primary animate-bounce-down"
          strokeWidth={2}
        />
      </div>

      {/* Mobile: fixed floating prompt at bottom of screen */}
      <div
        className={[
          'md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40',
          'cursor-pointer select-none',
          'transition-all duration-500 ease-out',
          appeared && !scrolledPast && !dismissed
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none',
        ].join(' ')}
        onClick={scrollDown}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') scrollDown(); }}
        aria-label="Rul ned for at udforske siden"
      >
        <div className="relative hint-float-anim">
          <div className="bg-primary/[0.25] backdrop-blur-sm border border-primary/45 rounded-xl pl-3.5 pr-8 py-3 shadow-md flex items-center gap-2 max-w-[280px]">
            <div
              className={[
                'flex-1 min-w-0 flex items-center gap-2',
                'transition-opacity',
                messageVisible ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
              style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
            >
              <Icon className="w-4 h-4 text-primary flex-shrink-0" strokeWidth={1.8} />
              <span className="text-xs font-medium text-primary leading-snug">{current.text}</span>
            </div>
            <ChevronDown
              className="w-4 h-4 text-primary flex-shrink-0 animate-bounce-down"
              strokeWidth={2}
            />
          </div>
          <span
            className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-primary/50 hover:text-primary hover:bg-primary/10 transition-colors"
            aria-hidden="true"
            onClick={dismiss}
          >
            <X className="w-3 h-3" strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </>
  );
}
