import { FLOW_LINKS, type EffectDomainId, type MeasureId } from '@/lib/model';
import { getPillarConfig } from '@/lib/pillars';
import { cn } from '@/lib/utils';

interface FlowConnectorsProps {
  activeMeasure: MeasureId | null;
  activeDomain: EffectDomainId | null;
  /** Oversigt uden valgt delmål — skjul efter klik på et kort. */
  showLabel?: boolean;
}

const COLS = [100, 300, 500] as const;
const MEASURE_COL: Record<MeasureId, number> = { skov: 0, lavbund: 1, vaadomraade: 2 };
const DOMAIN_COL: Record<EffectDomainId, number> = { klima: 0, vand: 1, natur: 2 };

const MEASURE_COLOR: Record<MeasureId, string> = {
  skov: getPillarConfig('afforestation').accentColor,
  lavbund: getPillarConfig('extraction').accentColor,
  vaadomraade: getPillarConfig('nitrogen').accentColor,
};

/**
 * SVG flow band: curved Bézier links from each virkemiddel to the effektdomæner it feeds.
 * Thicker stroke = primært formål (level 2). Lines rest faded by default and light up
 * only for the active (hovered or pinned) virkemiddel/effekt.
 * A small stroke bulge glides downward on visible links (static base opacity).
 */
export function FlowConnectors({
  activeMeasure,
  activeDomain,
  showLabel = false,
}: FlowConnectorsProps) {
  const noneActive = activeMeasure === null && activeDomain === null;

  return (
    <div className="relative mx-auto w-full max-w-2xl px-2 py-2 sm:py-3" aria-hidden="true">
      <svg
        viewBox="0 0 600 86"
        className="h-16 w-full sm:h-[4.5rem]"
        preserveAspectRatio="none"
      >
        {FLOW_LINKS.map((link, index) => {
          const x1 = COLS[MEASURE_COL[link.measure]];
          const x2 = COLS[DOMAIN_COL[link.domain]];
          const pathD = `M ${x1} 2 C ${x1} 44, ${x2} 44, ${x2} 84`;
          const color = MEASURE_COLOR[link.measure];
          const isPrimary = link.level === 2;
          const baseWidth = isPrimary ? 3 : 1.5;

          const isRelevant =
            !noneActive && (activeMeasure === link.measure || activeDomain === link.domain);

          const pathWidth = isRelevant ? baseWidth + 1 : baseWidth;
          const showBulge = noneActive || isRelevant;

          const trackOpacity = noneActive
            ? 0.12
            : isRelevant
              ? isPrimary
                ? 0.65
                : 0.35
              : 0.05;

          const bulgeDelay =
            MEASURE_COL[link.measure] * 0.55 + DOMAIN_COL[link.domain] * 0.15 + index * 0.05;

          const linkKey = `${link.measure}-${link.domain}-${link.level}`;

          return (
            <g key={linkKey}>
              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth={pathWidth}
                strokeLinecap="round"
                opacity={trackOpacity}
                vectorEffect="non-scaling-stroke"
                className="transition-[stroke-width,opacity] duration-200"
              />
              {showBulge && (
                <path
                  d={pathD}
                  pathLength={100}
                  fill="none"
                  stroke={color}
                  strokeWidth={pathWidth + (isPrimary ? 1.5 : 1)}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className={cn(
                    'flow-path-bulge',
                    noneActive ? 'flow-path-bulge--idle' : 'flow-path-bulge--active',
                  )}
                  style={{ animationDelay: `${bulgeDelay}s` }}
                />
              )}
            </g>
          );
        })}
      </svg>
      {showLabel && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-2">
          <p
            className="inline-flex max-w-[min(100%,22rem)] items-center justify-center gap-1.5 rounded-full border border-border/80 bg-background/95 px-3 py-1.5 text-center text-xs font-bold leading-snug text-foreground shadow-sm backdrop-blur-sm sm:px-4 sm:text-[13px]"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <span className="text-base leading-none text-primary sm:text-lg" aria-hidden="true">
              ↓
            </span>
            <span>Virkemidlerne føder ned i tre effekter</span>
          </p>
        </div>
      )}
    </div>
  );
}
