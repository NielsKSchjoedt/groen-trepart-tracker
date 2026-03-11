import { useState, useMemo } from 'react';
import { formatDanishNumber, getProgressColor } from '@/lib/format';
import type { Plan } from '@/lib/types';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, TableProperties } from 'lucide-react';

interface DataTableProps {
  plans: Plan[];
  onSelectPlan?: (plan: Plan) => void;
}

type SortKey = 'name' | 'nitrogenGoalT' | 'nitrogenAchievedT' | 'nitrogenProgressPct' | 'projects';
type SortDir = 'asc' | 'desc';

export function DataTable({ plans, onSelectPlan }: DataTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('nitrogenGoalT');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    let items = [...plans];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) => p.name.toLowerCase().includes(q));
    }
    items.sort((a, b) => {
      let av: number | string, bv: number | string;
      switch (sortKey) {
        case 'name':
          av = a.name;
          bv = b.name;
          break;
        case 'nitrogenGoalT':
          av = a.nitrogenGoalT;
          bv = b.nitrogenGoalT;
          break;
        case 'nitrogenAchievedT':
          av = a.nitrogenAchievedT;
          bv = b.nitrogenAchievedT;
          break;
        case 'nitrogenProgressPct':
          av = a.nitrogenProgressPct;
          bv = b.nitrogenProgressPct;
          break;
        case 'projects':
          av = a.projects.sketches + a.projects.assessed + a.projects.approved + a.projects.established;
          bv = b.projects.sketches + b.projects.assessed + b.projects.approved + b.projects.established;
          break;
        default:
          av = 0;
          bv = 0;
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv, 'da') : bv.localeCompare(av, 'da');
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return items;
  }, [plans, sortKey, sortDir, search]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const totalNGoal = plans.reduce((s, p) => s + p.nitrogenGoalT, 0);

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2.5 mb-2">
        <TableProperties className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
          Alle vandplaner
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        {plans.length} kystvandeplaner — klik en række for detaljer. Sortér ved at klikke på kolonneoverskrifter.
      </p>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Søg vandplan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/60"
        />
      </div>

      <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {([
                  ['name', 'Vandplan'],
                  ['nitrogenGoalT', 'Mål (ton)'],
                  ['nitrogenAchievedT', 'Opnået (ton)'],
                  ['nitrogenProgressPct', 'Fremskridt'],
                  ['projects', 'Projekter'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    className="text-left px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => toggleSort(key)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{label}</span>
                      <SortIcon col={key} />
                    </div>
                  </th>
                ))}
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Andel af mål</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((plan) => {
                const totalProj = plan.projects.sketches + plan.projects.assessed + plan.projects.approved + plan.projects.established;
                const shareOfTotal = totalNGoal > 0 ? (plan.nitrogenGoalT / totalNGoal) * 100 : 0;
                return (
                  <tr
                    key={plan.id}
                    onClick={() => onSelectPlan?.(plan)}
                    className="border-b border-border/50 hover:bg-primary/[0.04] cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3.5 font-medium text-foreground group-hover:text-primary transition-colors max-w-[200px]">
                      <span className="truncate block">{plan.name}</span>
                    </td>
                    <td className="px-4 py-3.5 text-foreground tabular-nums">
                      {formatDanishNumber(plan.nitrogenGoalT, 1)}
                    </td>
                    <td className="px-4 py-3.5 text-foreground tabular-nums">
                      {formatDanishNumber(plan.nitrogenAchievedT, 1)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-2 w-16 rounded-full bg-muted overflow-hidden flex-shrink-0">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(plan.nitrogenProgressPct, 100)}%`,
                              backgroundColor: getProgressColor(plan.nitrogenProgressPct),
                            }}
                          />
                        </div>
                        <span className="tabular-nums font-semibold text-foreground" style={{ color: getProgressColor(plan.nitrogenProgressPct) }}>
                          {Math.round(plan.nitrogenProgressPct)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="tabular-nums text-foreground font-medium">{formatDanishNumber(totalProj)}</span>
                        <span className="text-muted-foreground text-xs">
                          ({formatDanishNumber(plan.projects.established)} anlagt)
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-12 rounded-full bg-muted overflow-hidden flex-shrink-0">
                          <div
                            className="h-full rounded-full bg-primary/60 transition-all"
                            style={{ width: `${Math.min(shareOfTotal, 100)}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-muted-foreground text-xs">
                          {shareOfTotal.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Ingen vandplaner matcher "{search}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Source badge */}
      <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
        <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
        <span>Kilde: <a href="https://mars.mst.dk" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30">MARS API</a> — Miljøstyrelsen</span>
      </div>
    </section>
  );
}
