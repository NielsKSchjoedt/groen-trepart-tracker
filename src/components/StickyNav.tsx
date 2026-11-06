import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePillar, PILLAR_CONFIGS } from '@/lib/pillars';
import { pillarToSlug } from '@/lib/slugs';
import { getChapters } from '@/lib/chapters';
import { getKommuneChapters } from '@/lib/kommune-chapters';
import {
  KOMMUNE_DETAIL_KORT_CHAPTER,
  KOMMUNE_DETAIL_NATUR_CHAPTER,
  KOMMUNE_DETAIL_NOEGLETAL_CHAPTER,
  KOMMUNE_DETAIL_PROJEKTER_CHAPTER,
  KOMMUNE_DETAIL_STATUS_CHAPTER,
} from '@/lib/kommune-detail-chapters';
import { replaceSectionHash } from '@/lib/permalink/slices/section';
import { CopyLinkButton } from '@/lib/permalink/CopyLinkButton';
import { SectionLinkCopy } from '@/lib/permalink/SectionLinkCopy';
import { useSectionHashSync } from '@/lib/permalink/useSectionHashSync';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { ChevronDown, Globe, MapPin, ArrowLeft } from 'lucide-react';
import { getKommuneListBackTarget } from '@/lib/kommune-navigation';

import type { Chapter } from '@/lib/chapters';

interface StickyNavProps {
  /**
   * Ref to a sentinel element at the bottom of the hero section.
   * The nav slides in when the sentinel scrolls out of view (user has
   * passed the hero) and slides away when it returns.
   */
  sentinelRef: React.RefObject<HTMLDivElement>;
  /** Override route-derived chapter list (e.g. conditional detail-page sections). */
  chapters?: Chapter[];
  /** Optional label for the copy-link control (e.g. kommune name on detail pages). */
  contextLabel?: string;
}

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
/** Default detail nav before page-specific chapter list is ready. */
const KOMMUNE_DETAIL_NAV_FALLBACK: Chapter[] = [
  KOMMUNE_DETAIL_STATUS_CHAPTER,
  KOMMUNE_DETAIL_KORT_CHAPTER,
  KOMMUNE_DETAIL_NOEGLETAL_CHAPTER,
  KOMMUNE_DETAIL_NATUR_CHAPTER,
  KOMMUNE_DETAIL_PROJEKTER_CHAPTER,
];

export function StickyNav({ sentinelRef, chapters: chaptersOverride, contextLabel }: StickyNavProps) {
  const { activePillar, config } = usePillar();
  const navigate = useNavigate();
  const location = useLocation();
  const isKommunerRoute = location.pathname.startsWith('/kommuner');
  const isKommuneDetail = /^\/kommuner\/[^/]+/.test(location.pathname);
  const kommuneListBackTarget = useMemo(
    () => getKommuneListBackTarget(location.search),
    [location.search],
  );

  const chapters = useMemo(
    () =>
      chaptersOverride
      ?? (isKommuneDetail
        ? KOMMUNE_DETAIL_NAV_FALLBACK
        : isKommunerRoute
          ? getKommuneChapters()
          : getChapters(activePillar)),
    [chaptersOverride, isKommuneDetail, isKommunerRoute, activePillar],
  );
  const chapterIds = useMemo(() => chapters.map((c) => c.id), [chapters]);
  const { activeId, progress } = useScrollSpy(chapterIds);
  const { suppressHashSync } = useSectionHashSync(activeId, progress);

  // Accent: brand green on kommune views (map metric is not a page-wide pillar mode).
  const brandGreen = 'hsl(120 30% 38%)';
  const accent = isKommunerRoute ? brandGreen : (activePillar ? config.accentColor : brandGreen);

  const [visible, setVisible] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /** Smooth-scroll to a chapter anchor; scroll-margin handles the bar offset. */
  const scrollToChapter = useCallback(
    (id: string) => {
      suppressHashSync();
      replaceSectionHash(id);
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [suppressHashSync],
  );

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

  const viewToggle = (
    <div
      className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5 gap-0.5 flex-shrink-0"
      role="group"
      aria-label="Skift visning"
    >
      {([
        { to: '/', active: !isKommunerRoute, icon: Globe, label: 'National' },
        { to: '/kommuner', active: isKommunerRoute, icon: MapPin, label: 'Kommuner' },
      ] as const).map((v) => (
        <Link
          key={v.to}
          to={v.to}
          aria-current={v.active ? 'page' : undefined}
          className={[
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all duration-150',
            v.active
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border/40'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          <v.icon className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
          <span className="hidden sm:inline">{v.label}</span>
        </Link>
      ))}
    </div>
  );

  const kommuneDetailTopBar = isKommuneDetail && contextLabel;

  const pillarContext = isKommuneDetail ? (
    <Link
      to={kommuneListBackTarget}
      className="flex items-center gap-1.5 min-w-0 flex-shrink rounded-md px-1 -mx-1 py-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2.5} />
      <span className="truncate">Alle kommuner</span>
    </Link>
  ) : isKommunerRoute ? (
    <div className="flex items-center gap-2 min-w-0 flex-shrink px-1 -mx-1 py-1">
      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[hsl(120_30%_45%)]" />
      <span className="text-sm font-semibold flex-shrink-0 text-[hsl(120_30%_35%)]">
        Kommuner
      </span>
    </div>
  ) : (
    <div className="relative min-w-0 flex-shrink" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen((o) => !o)}
        className="flex items-center gap-2 min-w-0 rounded-md px-1 -mx-1 py-1 cursor-pointer lg:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="listbox"
        aria-expanded={dropdownOpen}
        aria-label={`Aktiv søjle: ${config.label}. Tryk for at skifte.`}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: activePillar ? config.accentColor : 'hsl(120 30% 45%)' }}
        />
        <span
          className="text-sm font-semibold truncate max-w-[42vw] sm:max-w-none"
          style={{ color: activePillar ? config.accentColor : 'hsl(120 30% 35%)' }}
        >
          {activePillar ? config.label : 'Oversigt'}
        </span>
        {activePillar && (
          <span className="hidden md:inline text-xs text-muted-foreground truncate">
            — {config.description}
          </span>
        )}
        <ChevronDown
          className={`lg:hidden w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
          style={{ color: config.accentColor }}
          strokeWidth={2.5}
        />
      </button>

      {dropdownOpen && (
        <div
          role="listbox"
          aria-label="Vælg søjle"
          className="lg:hidden absolute top-full left-0 mt-1 w-44 rounded-xl border border-border bg-background/98 backdrop-blur-md shadow-lg py-1 z-10"
        >
          {PILLAR_CONFIGS.map((p) => {
            const isActive = p.id === activePillar;
            return (
              <button
                key={p.id}
                role="option"
                aria-selected={isActive}
                onClick={() => handlePillarSwitch(p.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors cursor-pointer ${
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
  );

  return (
    <div
      aria-hidden={!visible}
      className={`fixed top-0 left-0 right-0 z-[1100] max-w-[100vw] overflow-x-hidden transition-transform duration-300 ease-in-out ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className={`max-w-6xl mx-auto px-4 flex items-center min-w-0 ${kommuneDetailTopBar ? 'h-12' : 'h-11 justify-between gap-2 sm:gap-4'}`}>

          {kommuneDetailTopBar ? (
            <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 min-w-0">
              <Link
                to={kommuneListBackTarget}
                className="flex items-center gap-1.5 min-w-0 justify-self-start rounded-md px-1 -mx-1 py-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2.5} />
                <span className="truncate">Alle kommuner</span>
              </Link>

              <p
                className="truncate text-center text-lg sm:text-xl font-bold leading-tight text-foreground max-w-[46vw] sm:max-w-sm px-1"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {contextLabel}
              </p>

              <div className="flex items-center gap-2 justify-self-end shrink-0">
                {viewToggle}
                <CopyLinkButton iconOnly className="inline-flex" />
              </div>
            </div>
          ) : (
            <>
              {pillarContext}

              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <CopyLinkButton className="hidden sm:inline-flex" />
                {!isKommunerRoute && (
                  <>
                    <div className="hidden lg:flex items-center gap-1">
                      {PILLAR_CONFIGS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handlePillarSwitch(p.id)}
                          aria-current={p.id === activePillar ? 'true' : undefined}
                          className={`h-7 rounded-md transition-all text-xs font-medium px-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                            p.id === activePillar
                              ? 'text-foreground bg-muted/50'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                          }`}
                          style={p.id === activePillar ? { color: config.accentColor } : {}}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: p.accentColor, opacity: p.id === activePillar ? 1 : 0.45 }}
                          />
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <span className="hidden lg:block w-px h-4 bg-border flex-shrink-0" />
                  </>
                )}
                {viewToggle}
              </div>
            </>
          )}

        </div>

        {/* Section indicator — its own row so the chapters/afsnit don't crowd
            the top bar. Inline buttons on desktop (lg+); a horizontally
            scrollable chip row below lg. Shows chapters on national/pillar
            views and Kort/Tabel jump links on the kommune view. */}
        {chapters.length > 0 && (
          <div className="hidden lg:block border-t border-border/60">
            <nav
              className="max-w-6xl mx-auto px-4 py-1.5 flex items-center gap-4"
              aria-label="Spring til sektion"
            >
              {chapters.map((c) => {
                    const isActive = c.id === activeId;
                    return (
                      <span key={c.id} className="group inline-flex items-center gap-0.5">
                        <button
                          onClick={() => scrollToChapter(c.id)}
                          aria-current={isActive ? 'true' : undefined}
                          className={`text-xs transition-colors whitespace-nowrap cursor-pointer ${
                            isActive ? 'font-semibold' : 'font-medium text-muted-foreground hover:text-foreground'
                          }`}
                          style={isActive ? { color: accent } : undefined}
                        >
                          {c.navLabel}
                        </button>
                        <SectionLinkCopy sectionId={c.id} />
                      </span>
                    );
                  })}
            </nav>
          </div>
        )}

        {/* Section chips — scrollable section indicator for screens below lg. */}
        {chapters.length > 0 && (
          <div className="lg:hidden border-t border-border/60 overflow-x-auto overscroll-x-contain max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <nav
              className="flex w-max min-w-full items-center gap-1.5 px-4 py-1.5"
              aria-label="Spring til sektion"
            >
              {chapters.map((c) => {
                    const isActive = c.id === activeId;
                    return (
                      <button
                        key={c.id}
                        onClick={() => scrollToChapter(c.id)}
                        aria-current={isActive ? 'true' : undefined}
                        className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] transition-colors cursor-pointer ${
                          isActive ? 'font-semibold' : 'font-medium text-muted-foreground'
                        }`}
                        style={isActive ? { color: accent, backgroundColor: `${accent}14` } : undefined}
                      >
                        {c.navLabel}
                      </button>
                    );
                  })}
            </nav>
          </div>
        )}

        {/* Scroll progress line */}
        <div className="h-0.5 w-full bg-transparent" aria-hidden="true">
          <div
            className="h-full transition-[width] duration-150 ease-out"
            style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: accent }}
          />
        </div>
      </div>
    </div>
  );
}
