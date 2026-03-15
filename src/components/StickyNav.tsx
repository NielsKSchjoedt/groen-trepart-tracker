import { useState, useEffect, useRef } from 'react';
import { usePillar, PILLAR_CONFIGS } from '@/lib/pillars';
import { pillarToSlug } from '@/lib/slugs';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

interface StickyNavProps {
  /**
   * Ref to a sentinel element at the bottom of the hero section.
   * The nav slides in when the sentinel scrolls out of view (user has
   * passed the hero) and slides away when it returns.
   */
  sentinelRef: React.RefObject<HTMLDivElement>;
}

const ALL_JUMP_LINKS = [
  { label: 'Oversigt', href: '#oversigt', requiresPillar: false },
  { label: 'Kort',     href: '#kort',     requiresPillar: true  },
  { label: 'Projekter', href: '#tabeller', requiresPillar: true  },
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
  const { activePillar, config } = usePillar();
  const jumpLinks = ALL_JUMP_LINKS.filter((l) => !l.requiresPillar || activePillar !== null);
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show only when the sentinel has scrolled *above* the viewport
        // (boundingClientRect.top < 0). Without this check the nav
        // incorrectly appears on initial load when the sentinel sits
        // *below* the fold and isIntersecting is already false.
        const nowVisible = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setVisible(nowVisible);
        if (!nowVisible) setDropdownOpen(false);
      },
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [dropdownOpen]);

  const handlePillarSwitch = (id: typeof activePillar) => {
    setDropdownOpen(false);
    navigate(`/${pillarToSlug(id)}`);
  };

  return (
    <div
      aria-hidden={!visible}
      className={`fixed top-0 left-0 right-0 z-[1100] transition-transform duration-300 ease-in-out ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-11 flex items-center justify-between gap-4">

          {/* Active pillar indicator — tappable on mobile to open pillar switcher dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2 min-w-0 rounded-md px-1 -mx-1 py-1 sm:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              aria-label={`Aktiv søjle: ${config.label}. Tryk for at skifte.`}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: activePillar ? config.accentColor : 'hsl(120 30% 45%)' }}
              />
              <span
                className="text-sm font-semibold flex-shrink-0"
                style={{ color: activePillar ? config.accentColor : 'hsl(120 30% 35%)' }}
              >
                {activePillar ? config.label : 'Oversigt'}
              </span>
              {activePillar && (
                <span className="hidden md:inline text-xs text-muted-foreground truncate">
                  — {config.description}
                </span>
              )}
              {/* Chevron — only visible on mobile where the right-side switcher is hidden */}
              <ChevronDown
                className={`sm:hidden w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                style={{ color: config.accentColor }}
                strokeWidth={2.5}
              />
            </button>

            {/* Mobile pillar dropdown */}
            {dropdownOpen && (
              <div
                role="listbox"
                aria-label="Vælg søjle"
                className="sm:hidden absolute top-full left-0 mt-1 w-44 rounded-xl border border-border bg-background/98 backdrop-blur-md shadow-lg py-1 z-10"
              >
                {PILLAR_CONFIGS.map((p) => {
                  const isActive = p.id === activePillar;
                  return (
                    <button
                      key={p.id}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handlePillarSwitch(p.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                      style={isActive ? { color: p.accentColor } : {}}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: p.accentColor, opacity: isActive ? 1 : 0.5 }}
                      />
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-5">
            {/* Pillar switcher — labeled buttons, desktop only */}
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
              {jumpLinks.map(({ label, href }) => (
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
