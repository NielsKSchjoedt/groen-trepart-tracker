import { useState, useEffect } from 'react';
import { usePillar, PILLAR_CONFIGS } from '@/lib/pillars';
import { pillarToSlug } from '@/lib/slugs';
import { useNavigate } from 'react-router-dom';

interface StickyNavProps {
  /**
   * Ref to a sentinel element at the bottom of the hero section.
   * The nav slides in when the sentinel scrolls out of view (user has
   * passed the hero) and slides away when it returns.
   */
  sentinelRef: React.RefObject<HTMLDivElement>;
}

const JUMP_LINKS = [
  { label: 'Oversigt', href: '#oversigt' },
  { label: 'Kort',     href: '#kort'     },
  { label: 'Projekter', href: '#tabeller' },
] as const;

/**
 * A slim fixed bar that slides down from the top of the viewport once the
 * user has scrolled past the hero section. Shows the active pillar context
 * and provides quick-jump anchor links to major sections.
 *
 * @param sentinelRef - Ref placed just below the hero; controls show/hide.
 *
 * @example
 * const sentinelRef = useRef<HTMLDivElement>(null);
 * <HeroSection ... />
 * <div ref={sentinelRef} />
 * <StickyNav sentinelRef={sentinelRef} />
 */
export function StickyNav({ sentinelRef }: StickyNavProps) {
  const { activePillar, setActivePillar, config } = usePillar();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show only when the sentinel has scrolled *above* the viewport
        // (boundingClientRect.top < 0). Without this check the nav
        // incorrectly appears on initial load when the sentinel sits
        // *below* the fold and isIntersecting is already false.
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef]);

  const handlePillarSwitch = (id: typeof activePillar) => {
    navigate(`/${pillarToSlug(id)}`);
  };

  return (
    <div
      aria-hidden={!visible}
      className={`fixed top-0 left-0 right-0 z-[200] transition-transform duration-300 ease-in-out ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-11 flex items-center justify-between gap-4">

          {/* Active pillar indicator — compact on mobile, with description on desktop */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: config.accentColor }}
            />
            <span
              className="text-sm font-semibold flex-shrink-0"
              style={{ color: config.accentColor }}
            >
              {config.label}
            </span>
            <span className="hidden md:inline text-xs text-muted-foreground truncate">
              — {config.description}
            </span>
          </div>

          <div className="flex items-center gap-5">
            {/* Pillar switcher — icon dots on mobile, labeled on md+ */}
            <div className="flex items-center gap-1">
              {PILLAR_CONFIGS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePillarSwitch(p.id)}
                  title={p.label}
                  className={`h-7 rounded-md transition-all text-xs font-medium px-2 hidden sm:flex items-center gap-1.5 ${
                    p.id === activePillar
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  style={p.id === activePillar ? { color: config.accentColor } : {}}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.accentColor, opacity: p.id === activePillar ? 1 : 0.45 }}
                  />
                  <span className="hidden lg:inline">{p.label}</span>
                </button>
              ))}
            </div>

            {/* Divider */}
            <span className="hidden sm:block w-px h-4 bg-border" />

            {/* Section jump links */}
            <nav className="flex items-center gap-3" aria-label="Spring til sektion">
              {JUMP_LINKS.map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>

        </div>
      </div>
    </div>
  );
}
