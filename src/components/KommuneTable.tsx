import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, AlertTriangle } from 'lucide-react';
import type { KommuneMetrics } from '@/lib/types';
import type { KommuneMetric } from '@/lib/kommune-metrics';
import { METRIC_NO_DATA } from '@/lib/kommune-metrics';
import { formatDanishNumber } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { InfoTooltip } from '@/components/InfoTooltip';

type SortKey = 'navn' | 'region' | 'nitrogenT' | 'extractionHa' | 'afforestationTotalHa' | 'naturePotentialHa' | 'co2EstimatedT' | 'projectCount';
type SortDir = 'asc' | 'desc';

interface KommuneTableProps {
  metrics: KommuneMetrics[];
  activeMetric: KommuneMetric;
  selectedKode: string | null;
  onSelect: (kode: string) => void;
}

/**
 * Map KommuneMetric to the corresponding table column key for highlighting.
 */
const METRIC_TO_COL: Record<KommuneMetric, SortKey> = {
  nitrogen:     'nitrogenT',
  extraction:   'extractionHa',
  afforestation:'afforestationTotalHa',
  nature:       'naturePotentialHa',
  co2:          'co2EstimatedT',
};

/**
 * Colour stops for per-cell heatmap highlighting (same palette as KommuneMap).
 * Light background tint applied to active-metric cells.
 */
const CELL_BG: Record<KommuneMetric, { low: string; high: string }> = {
  nitrogen:     { low: '#f0fdfb', high: '#99f6e4' },
  extraction:   { low: '#fffbeb', high: '#fde68a' },
  afforestation:{ low: '#f0fdf4', high: '#86efac' },
  nature:       { low: '#f0fdf4', high: '#86efac' },
  // CO₂ data is unavailable per municipality — cells always render as no-data.
  co2:          { low: '#f8fafc', high: '#e2e8f0' },
};

/**
 * Compute a background colour for a heatmap cell based on the cell's value
 * relative to the maximum across all rows.
 *
 * @param value - Cell value
 * @param maxVal - Maximum value in the column
 * @param metric - Active metric (selects colour palette)
 * @returns CSS colour string for cell background
 */
function heatmapBg(value: number, maxVal: number, metric: KommuneMetric): string {
  if (value <= 0 || maxVal <= 0) return 'transparent';
  const t = Math.min(value / maxVal, 1);
  const { low, high } = CELL_BG[metric];
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(low);
  const [r2, g2, b2] = parse(high);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

/**
 * Format a metric value for table display.
 * Values at 0 show an em-dash (—) to distinguish "no data" from small values.
 */
function fmtVal(value: number, decimals = 0): string {
  if (value <= 0) return '—';
  const factor = Math.pow(10, decimals);
  return formatDanishNumber(Math.round(value * factor) / factor);
}

/**
 * Sort icon component for table column headers.
 */
function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5" />
    : <ChevronDown className="w-3.5 h-3.5" />;
}

interface ColHeaderProps {
  col: SortKey;
  label: string;
  /** Extra class names on the <th> element */
  className?: string;
  /** Whether this column's data is unavailable at municipality level */
  noData?: boolean;
  /** Optional popover explanation */
  tooltip?: React.ReactNode;
  tooltipSource?: string;
  /** Sort state passed down from the parent table */
  activeCol: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggle: (col: SortKey) => void;
}

/**
 * Sortable column header with optional warning indicator and info tooltip.
 * Defined at module level (not inside the render function) so React's
 * fast-refresh and component identity checks work correctly.
 */
function ColHeader({
  col, label, className = '', noData = false,
  tooltip, tooltipSource,
  activeCol, sortKey, sortDir, onToggle,
}: ColHeaderProps) {
  return (
    <th
      scope="col"
      className={`px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors ${col === activeCol ? 'text-foreground' : ''} ${className}`}
      onClick={() => onToggle(col)}
      aria-sort={sortKey === col ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className="flex items-center gap-1">
        {noData && (
          <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" strokeWidth={2.5} title="Data ikke tilgængeligt på kommuneniveau" />
        )}
        {label}
        {tooltip && (
          <InfoTooltip
            content={tooltip}
            source={tooltipSource}
            size={11}
            side="top"
            align="start"
          />
        )}
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </span>
    </th>
  );
}

/**
 * Sortable, searchable table showing all 98 Danish municipalities with their
 * per-metric values. Clicking a row selects it (desktop expands inline,
 * mobile triggers a bottom sheet via the parent).
 *
 * @param metrics - Per-kommune aggregated metrics from dashboard data
 * @param activeMetric - Controls which column gets heatmap highlighting
 * @param selectedKode - 4-digit kode of the currently selected kommune (or null)
 * @param onSelect - Called with the kode when a row is clicked
 */
export function KommuneTable({ metrics, activeMetric, selectedKode, onSelect }: KommuneTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('nitrogenT');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  const activeCol = METRIC_TO_COL[activeMetric];

  const maxValues = useMemo(() => ({
    nitrogenT:           Math.max(...metrics.map((k) => k.nitrogenT), 1),
    extractionHa:        Math.max(...metrics.map((k) => k.extractionHa), 1),
    afforestationTotalHa:Math.max(...metrics.map((k) => k.afforestationTotalHa), 1),
    naturePotentialHa:   Math.max(...metrics.map((k) => k.naturePotentialHa), 1),
    co2EstimatedT:       Math.max(...metrics.map((k) => k.co2EstimatedT ?? 0), 1),
  }), [metrics]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? metrics.filter((k) => k.navn.toLowerCase().includes(q) || k.region.toLowerCase().includes(q))
      : metrics;
  }, [metrics, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp: number;
      if (sortKey === 'navn' || sortKey === 'region') {
        cmp = a[sortKey].localeCompare(b[sortKey], 'da');
      } else if (sortKey === 'co2EstimatedT') {
        cmp = (a.co2EstimatedT ?? 0) - (b.co2EstimatedT ?? 0);
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // Shared sort-state props passed to every ColHeader — avoids repetition.
  const colSortProps = { activeCol, sortKey, sortDir, onToggle: toggleSort };

  return (
    <div className="w-full">
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Søg efter kommune…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
          aria-label="Filtrer kommunelisten"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Kommuner oversigt">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <ColHeader {...colSortProps} col="navn" label="Kommune" className="sticky left-0 bg-muted/50 z-10 min-w-[130px]" />
                <ColHeader {...colSortProps} col="region" label="Region" />
                <ColHeader
                  {...colSortProps}
                  col="nitrogenT"
                  label="Kvælstof"
                  tooltip="Samlet kvælstofreduktion (ton N/år) fra MARS-projekter med adresse i kommunen. Dækker alle projektfaser (skitse → anlagt)."
                  tooltipSource="MARS API (Miljøstyrelsen)"
                />
                <ColHeader
                  {...colSortProps}
                  col="extractionHa"
                  label="Udtagning"
                  tooltip="Samlet areal (ha) af kulstofrige lavbundsjorde udtaget fra omdrift — fra MARS-projekter. Lavbundsudtagning reducerer CO₂-udledning fra tørv."
                  tooltipSource="MARS API (Miljøstyrelsen)"
                />
                <ColHeader
                  {...colSortProps}
                  col="afforestationTotalHa"
                  label="Skovrejsning"
                  tooltip="Samlet skovrejsningsareal (ha) fra tre kilder: MARS-projekter, Klimaskovfonden (KSF) og Naturstyrelsen (NST)."
                  tooltipSource="MARS API, Klimaskovfonden, Naturstyrelsen"
                />
                <ColHeader
                  {...colSortProps}
                  col="naturePotentialHa"
                  label="Beskyttet natur"
                  noData={METRIC_NO_DATA.has('nature')}
                  tooltip="Areal med naturpotentiale (ha) per kommune. Data er ikke tilgængeligt på kommuneniveau i MARS — opgøres kun på oplands- og regionsniveau."
                  tooltipSource="MARS API (Miljøstyrelsen)"
                />
                <ColHeader
                  {...colSortProps}
                  col="co2EstimatedT"
                  label="CO₂"
                  noData={METRIC_NO_DATA.has('co2')}
                  tooltip="CO₂-reduktion per kommune. Data ikke tilgængeligt — KF25-fremskrivningen opgøres kun nationalt."
                  tooltipSource="KF25 (Energistyrelsen)"
                />
                <ColHeader
                  {...colSortProps}
                  col="projectCount"
                  label="Projekter"
                  tooltip="Antal MARS-projekter med centroid i kommunen på tværs af alle projektfaser."
                  tooltipSource="MARS API (Miljøstyrelsen)"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((km) => {
                const isSelected = km.kode === selectedKode;
                return (
                  <tr
                    key={km.kode}
                    onClick={() => onSelect(km.kode)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/5 hover:bg-primary/8'
                        : 'hover:bg-muted/50'
                    }`}
                    aria-selected={isSelected}
                  >
                    <td className={`sticky left-0 px-3 py-2 font-medium text-foreground whitespace-nowrap z-10 ${isSelected ? 'bg-primary/5' : 'bg-background'}`}>
                      <span className="flex items-center gap-1.5">
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                        )}
                        {km.navn}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap text-xs">
                      {km.region.replace('Region ', '')}
                    </td>
                    <MetricCell
                      value={km.nitrogenT}
                      maxVal={maxValues.nitrogenT}
                      metric="nitrogen"
                      activeMetric={activeMetric}
                      suffix=" T"
                    />
                    <MetricCell
                      value={km.extractionHa}
                      maxVal={maxValues.extractionHa}
                      metric="extraction"
                      activeMetric={activeMetric}
                      suffix=" ha"
                    />
                    <MetricCell
                      value={km.afforestationTotalHa}
                      maxVal={maxValues.afforestationTotalHa}
                      metric="afforestation"
                      activeMetric={activeMetric}
                      suffix=" ha"
                    />
                    <MetricCell
                      value={km.naturePotentialHa}
                      maxVal={maxValues.naturePotentialHa}
                      metric="nature"
                      activeMetric={activeMetric}
                      suffix=" ha"
                    />
                    <MetricCell
                      value={km.co2EstimatedT ?? 0}
                      maxVal={maxValues.co2EstimatedT}
                      metric="co2"
                      activeMetric={activeMetric}
                      suffix=" T"
                    />
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {km.projectCount > 0 ? km.projectCount : '—'}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground text-sm">
                    Ingen kommuner matcher søgningen
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row count */}
      <p className="mt-2 text-xs text-muted-foreground">
        {filtered.length < metrics.length
          ? `Viser ${filtered.length} af ${metrics.length} kommuner`
          : `${metrics.length} kommuner`}
      </p>
    </div>
  );
}

/**
 * A single table data cell with optional heatmap background tint.
 * The active metric's column is always highlighted; other columns
 * use a muted tint so the active one stands out more.
 */
function MetricCell({
  value,
  maxVal,
  metric,
  activeMetric,
  suffix,
}: {
  value: number;
  maxVal: number;
  metric: KommuneMetric;
  activeMetric: KommuneMetric;
  suffix: string;
}) {
  const isActive = metric === activeMetric;
  const bg = isActive && value > 0 ? heatmapBg(value, maxVal, metric) : 'transparent';

  return (
    <td
      className={`px-3 py-2 tabular-nums text-right whitespace-nowrap text-xs transition-colors ${
        isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
      }`}
      style={{ backgroundColor: bg }}
    >
      {value > 0 ? `${fmtVal(value)}${suffix}` : '—'}
    </td>
  );
}
