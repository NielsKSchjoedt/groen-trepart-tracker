import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, X } from 'lucide-react';
import { formatDanishNumber } from '@/lib/format';
import { InfoTooltip } from '@/components/InfoTooltip';
import {
  STANDINGS_LENSES,
  standingsCell,
  standingsBarPct,
  type StandingsLensKey,
  type StandingsMode,
  type StandingsRow,
} from '@/lib/kommune-ranking';
import { standingsHeatmapBg, MEDAL_COLORS } from './heatmap';

interface KommuneMasterTableProps {
  rows: StandingsRow[];
  mode: StandingsMode;
  sortKey: StandingsLensKey | 'leveretHa';
  sortDir: 'asc' | 'desc';
  onToggleSort: (key: StandingsLensKey | 'leveretHa') => void;
  selectedKode: string | null;
  onSelect: (kode: string) => void;
}

export function KommuneMasterTable({
  rows,
  mode,
  sortKey,
  sortDir,
  onToggleSort,
  selectedKode,
  onSelect,
}: KommuneMasterTableProps) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visibleRows = useMemo(
    () => (q ? rows.filter((r) => r.kommuneNavn.toLowerCase().includes(q)) : rows),
    [rows, q],
  );

  const maxByLens = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of STANDINGS_LENSES) {
      m[l.key] = Math.max(
        ...rows.map((r) => Math.max(standingsCell(r, l.key, mode).sort, 0)),
        0.01,
      );
    }
    return m;
  }, [rows, mode]);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Quick-search — scoped to this table only (not the page top). */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
        <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find din kommune i tabellen…"
          aria-label="Find kommune i tabellen"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Ryd søgning"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <TableLegend />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className="w-10 px-2 py-2.5 text-xs font-semibold text-muted-foreground text-center">#</th>
              <th scope="col" className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-left">Kommune</th>
              <th scope="col" className="px-2 py-2.5 text-xs font-semibold text-muted-foreground text-right w-16">
                <InfoTooltip
                  title="Ansvar"
                  content="Kommunens andel af nationalt naturpotentiale (DCE 30 %). Stand-in for fagligt ansvar — ikke en politisk forpligtelse."
                  size={11}
                />
                {' '}Ansvar
              </th>
              {STANDINGS_LENSES.map((l) => (
                <th
                  key={l.key}
                  scope="col"
                  className="px-2 py-2.5 text-xs font-semibold text-center cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => onToggleSort(l.key)}
                  aria-sort={sortKey === l.key ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
                >
                  <span className="inline-flex items-center gap-1 justify-center">
                    {l.label}
                    <SortIcon col={l.key} sortKey={sortKey} sortDir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  {q ? 'Ingen kommuner matcher søgningen.' : 'Ingen kommuner i den valgte region.'}
                </td>
              </tr>
            )}
            {visibleRows.map((km) => {
              const isSelected = km.kode === selectedKode;
              return (
                <tr
                  key={km.kode}
                  onClick={() => onSelect(km.kode)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(km.kode);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Se detaljer for ${km.kommuneNavn}`}
                  aria-selected={isSelected}
                  className={[
                    'border-b border-border/60 transition-colors cursor-pointer',
                    isSelected ? 'bg-primary/6 hover:bg-primary/8' : 'hover:bg-muted/30',
                  ].join(' ')}
                >
                  <td className="px-2 py-2 text-center">
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={
                        km.pos <= 3
                          ? { color: MEDAL_COLORS[km.pos - 1] }
                          : { color: 'var(--muted-foreground)' }
                      }
                    >
                      {km.pos}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-foreground">
                      {km.kommuneNavn}
                    </span>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                      {km.region.replace('Region ', '')}
                    </p>
                  </td>
                  <td className="px-2 py-2 text-right text-xs tabular-nums text-muted-foreground">
                    {formatDanishNumber(km.ansvarPct, 1)}%
                  </td>
                  {STANDINGS_LENSES.map((l) => {
                    const c = standingsCell(km, l.key, mode);
                    const hot = sortKey === l.key;
                    const barW = standingsBarPct(km, l.key, mode, maxByLens[l.key] ?? 1);
                    return (
                      <td key={l.key} className="px-2 py-2">
                        <div className="w-full flex flex-col items-center gap-1">
                          <span
                            className="text-xs font-bold tabular-nums"
                            style={{
                              fontFamily: "'Fraunces', serif",
                              color: c.behov
                                ? l.tone
                                : c.idx != null && c.idx >= 1
                                  ? 'hsl(152 50% 30%)'
                                  : 'hsl(30 12% 48%)',
                            }}
                          >
                            {c.txt}
                          </span>
                          <div
                            className="w-full h-1.5 rounded-full bg-muted overflow-hidden"
                            style={{ opacity: hot ? 1 : 0.85 }}
                          >
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.max(barW, 4)}%`,
                                backgroundColor: standingsHeatmapBg(
                                  c.sort,
                                  maxByLens[l.key] ?? 1,
                                  l.key,
                                ),
                              }}
                            />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-b border-border bg-muted/30 text-[11px] text-muted-foreground">
      <span className="font-semibold text-foreground">Sådan læses tallene:</span>
      <span>
        <strong className="text-emerald-800 dark:text-emerald-400">7 gange</strong> = leverer syv gange mere end forventet
      </span>
      <span>
        <strong className="text-stone-600 dark:text-stone-400">som forv.</strong> = på niveau med det forventede
      </span>
    </div>
  );
}

function SortIcon({
  col,
  sortKey,
  sortDir,
}: {
  col: string;
  sortKey: string;
  sortDir: 'asc' | 'desc';
}) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3" />
    : <ChevronDown className="w-3 h-3" />;
}
