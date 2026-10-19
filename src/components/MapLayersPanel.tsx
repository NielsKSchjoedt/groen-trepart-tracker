import { Layers } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A single toggleable map layer shown as a switch row inside the panel. */
export interface LayerRow {
  id: string;
  label: string;
  /** Plain-language description of what the layer shows on the map. */
  sublabel?: string;
  /** Data provider or publication the layer is drawn from. */
  source?: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  /** Optional dot color that mirrors how the layer appears on the map. */
  color?: string;
  /** Optional opacity for `color` swatches (e.g. semi-transparent WMS overlays). */
  colorOpacity?: number;
  /** `area` = small square (polygon fills); default `dot` = circle (points). */
  swatchVariant?: 'dot' | 'area';
  /**
   * Optional image swatch (e.g. a WMS GetLegendGraphic) shown instead of the
   * colour dot — use this for server-styled layers so the swatch matches the
   * map exactly. Takes precedence over `color`.
   */
  swatchUrl?: string;
}

/** A titled group of related layers (e.g. "Vandmiljø", "Biodiversitet"). */
export interface LayerGroup {
  title: string;
  rows: LayerRow[];
}

interface MapLayersPanelProps {
  groups: LayerGroup[];
}

/**
 * Unified, additive map-layer control. Renders a single "Lag" button that opens
 * a popover listing every optional overlay grouped by theme. Each layer is an
 * independent on/off switch, so layers can be combined freely and turned off —
 * unlike the base map (grundkort), which is a separate mutually-exclusive choice.
 *
 * The button shows a badge with the number of active layers.
 *
 * @example
 * <MapLayersPanel groups={[{ title: 'Vandmiljø', rows: [{ id: 'kyst', label: 'Kystvande', checked, onChange }] }]} />
 */
export function MapLayersPanel({ groups }: MapLayersPanelProps) {
  const visibleGroups = groups.filter((g) => g.rows.length > 0);
  if (visibleGroups.length === 0) return null;

  const activeCount = visibleGroups.reduce(
    (sum, g) => sum + g.rows.filter((r) => r.checked).length,
    0,
  );
  const isActive = activeCount > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-1.5 text-sm font-medium transition-colors',
            isActive
              ? 'border-primary/40 bg-primary/5 text-foreground hover:bg-primary/10'
              : 'text-foreground/90',
          )}
        >
          <Layers className={cn('w-3.5 h-3.5', isActive ? 'text-primary' : 'text-muted-foreground')} />
          Lag
          {isActive && (
            <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[10000] w-80 p-0 overflow-hidden" align="end">
        <div className="px-3.5 py-2.5 border-b border-border/60 bg-muted/30">
          <p className="text-xs font-semibold text-foreground">Kortlag</p>
          <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
            Slå lag til og fra og kombinér dem frit. Lagene lægges oven på grundkortet.
          </p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-3.5 py-2.5 space-y-3">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80 mb-1.5">
                {group.title}
              </p>
              <ul className="space-y-2">
                {group.rows.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 text-[11px]">
                    <div className="flex items-start gap-2 min-w-0">
                      {row.swatchUrl ? (
                        <img
                          src={row.swatchUrl}
                          alt=""
                          aria-hidden
                          className="mt-0.5 h-3.5 w-auto max-w-[1.25rem] shrink-0 rounded-sm border border-black/10 object-contain"
                        />
                      ) : row.color ? (
                        <span
                          className={cn(
                            'mt-0.5 h-2.5 w-2.5 shrink-0 border border-black/10',
                            row.swatchVariant === 'area' ? 'rounded-sm' : 'rounded-full',
                          )}
                          style={{
                            backgroundColor: row.color,
                            opacity: row.colorOpacity ?? 1,
                          }}
                        />
                      ) : null}
                      <div className="min-w-0">
                        <div className="font-medium text-foreground leading-tight">{row.label}</div>
                        {row.sublabel && (
                          <div className="text-muted-foreground text-[10px] leading-snug mt-0.5">
                            {row.sublabel}
                          </div>
                        )}
                        {row.source && (
                          <div className="text-muted-foreground/75 text-[9px] leading-snug mt-0.5">
                            Kilde: {row.source}
                          </div>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={row.checked}
                      onCheckedChange={row.onChange}
                      className="data-[state=checked]:bg-primary shrink-0"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
