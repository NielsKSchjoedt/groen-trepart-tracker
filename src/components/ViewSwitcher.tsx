import { Link, useLocation } from 'react-router-dom';
import { Globe, MapPin, Leaf } from 'lucide-react';

/**
 * Primary view-switcher for toggling between the national overview and the
 * municipality (Kommuner) breakdown. Always rendered at the top of both pages
 * so users can switch views without needing to scroll to the StickyNav.
 *
 * Includes the "Track Den Grønne Trepart" branding line above the segmented
 * pill control for consistent identity across both views.
 *
 * @example
 * // In HeroSection.tsx or KommunePage.tsx — place at the very top:
 * <ViewSwitcher />
 */
export function ViewSwitcher() {
  const { pathname } = useLocation();
  const isKommune = pathname.startsWith('/kommuner');

  return (
    <div className="flex flex-col items-center mb-6" role="navigation" aria-label="Skift visning">
      <div className="flex items-center justify-center gap-2 mb-3">
        <Leaf className="w-5 h-5 text-primary -scale-x-100" strokeWidth={1.5} />
        <span className="text-xs font-medium uppercase tracking-widest text-primary">
          Track Den Grønne Trepart
        </span>
        <Leaf className="w-5 h-5 text-primary" strokeWidth={1.5} />
      </div>
      <div className="inline-flex items-center gap-0.5 rounded-xl border border-border/60 bg-muted/40 p-1 shadow-inner">
        <Link
          to="/"
          aria-current={!isKommune ? 'page' : undefined}
          className={[
            'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200',
            !isKommune
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border/40'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
          ].join(' ')}
        >
          <Globe className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
          <span>National oversigt</span>
        </Link>

        <Link
          to="/kommuner"
          aria-current={isKommune ? 'page' : undefined}
          className={[
            'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200',
            isKommune
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border/40'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
          ].join(' ')}
        >
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
          <span>Kommuner</span>
        </Link>
      </div>
    </div>
  );
}
