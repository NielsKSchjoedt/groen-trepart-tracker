import { Link, useLocation } from 'react-router-dom';
import { Globe, MapPin, Leaf } from 'lucide-react';

type ViewId = 'national' | 'kommuner';

interface ViewDef {
  id: ViewId;
  to: string;
  icon: typeof Globe;
  label: string;
  shortLabel: string;
}

const VIEWS: ViewDef[] = [
  { id: 'national', to: '/', icon: Globe, label: 'National oversigt', shortLabel: 'National' },
  { id: 'kommuner', to: '/kommuner', icon: MapPin, label: 'Kommuner', shortLabel: 'Kommuner' },
];

/**
 * Resolve which view is active based on the current pathname.
 *
 * @param pathname - Current router pathname
 * @returns The active ViewId
 */
function resolveActiveView(pathname: string): ViewId {
  if (pathname.startsWith('/kommuner')) return 'kommuner';
  return 'national';
}

/**
 * Primary view-switcher for toggling between the national overview and
 * municipality breakdown. Always rendered at the top of both pages so
 * users can switch without scrolling.
 *
 * Includes the "Track Den Grønne Trepart" branding line above the
 * segmented pill control for consistent identity across all views.
 *
 * @example
 * <ViewSwitcher />
 */
export function ViewSwitcher() {
  const { pathname } = useLocation();
  const activeView = resolveActiveView(pathname);

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
        {VIEWS.map((v) => {
          const isActive = v.id === activeView;
          const Icon = v.icon;
          return (
            <Link
              key={v.id}
              to={v.to}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/40'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
              ].join(' ')}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
              <span className="hidden sm:inline">{v.label}</span>
              <span className="sm:hidden">{v.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
