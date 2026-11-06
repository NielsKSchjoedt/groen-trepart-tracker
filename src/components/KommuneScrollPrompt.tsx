import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, MapPin, X } from 'lucide-react';

const SCROLL_HIDE_THRESHOLD = 350;
const APPEAR_DELAY_MS = 1500;

/**
 * Scroll hint for the kommune page — points users to the map chapter.
 */
export function KommuneScrollPrompt() {
  const [scrolledPast, setScrolledPast] = useState(false);
  const [appeared, setAppeared] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAppeared(true), APPEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolledPast(window.scrollY > SCROLL_HIDE_THRESHOLD);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollDown = useCallback(() => {
    document.getElementById('geografi')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const visible = appeared && !scrolledPast && !dismissed;

  return (
    <div
      className={[
        'flex justify-center pb-6 px-4 transition-all duration-500',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={scrollDown}
        className="relative flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 pl-3.5 pr-8 py-2.5 text-xs font-medium text-primary shadow-sm hover:bg-primary/15 transition-colors cursor-pointer"
      >
        <MapPin className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
        <span>Scroll ned til kortet</span>
        <ChevronDown className="w-4 h-4 animate-bounce" strokeWidth={2.5} />
        <span
          role="presentation"
          onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
          className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-primary/50 hover:text-primary hover:bg-primary/10"
        >
          <X className="w-3 h-3" />
        </span>
      </button>
    </div>
  );
}
