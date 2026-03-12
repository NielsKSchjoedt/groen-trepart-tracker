import { useEffect, useState, useMemo } from 'react';
import { loadProjectChangelog } from '@/lib/data';
import type { ProjectChangelog, ChangelogEntry } from '@/lib/types';
import { formatDanishNumber } from '@/lib/format';
import { usePillar } from '@/lib/pillars';
import { Activity, ChevronDown, ChevronUp, Hammer, ShieldCheck, ClipboardCheck, Droplets, MapPin, Trees } from 'lucide-react';

const PHASE_ICONS: Record<string, typeof Hammer> = {
  established: Hammer,
  approved: ShieldCheck,
  preliminary: ClipboardCheck,
};

const PHASE_COLORS: Record<string, string> = {
  established: '#15803d',
  approved: '#a16207',
  preliminary: '#2563eb',
};

/** Format an ISO date string as a relative Danish label (e.g. "i dag", "i går", "3 dage siden") */
function relativeDateDa(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr + 'T12:00:00');
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'i dag';
  if (diffDays === 1) return 'i går';
  if (diffDays < 7) return `${diffDays} dage siden`;
  if (diffDays < 14) return 'sidste uge';
  return `${Math.floor(diffDays / 7)} uger siden`;
}

/** Format an ISO date to a Danish short date (e.g. "11. mar") */
function shortDateDa(dateStr: string): string {
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()}. ${months[d.getMonth()]}`;
}

/** Effect icon for a changelog entry based on which pillar it affects */
function EffectBadges({ entry }: { entry: ChangelogEntry }) {
  const badges: JSX.Element[] = [];
  if (entry.nitrogenT && entry.nitrogenT > 0) {
    badges.push(
      <span key="n" className="inline-flex items-center gap-0.5 text-[10px] text-teal-700">
        <Droplets className="w-2.5 h-2.5" />
        {formatDanishNumber(entry.nitrogenT, 2)}t
      </span>
    );
  }
  if (entry.extractionHa && entry.extractionHa > 0) {
    badges.push(
      <span key="e" className="inline-flex items-center gap-0.5 text-[10px] text-amber-700">
        <MapPin className="w-2.5 h-2.5" />
        {formatDanishNumber(entry.extractionHa, 1)}ha
      </span>
    );
  }
  if (entry.afforestationHa && entry.afforestationHa > 0) {
    badges.push(
      <span key="a" className="inline-flex items-center gap-0.5 text-[10px] text-green-700">
        <Trees className="w-2.5 h-2.5" />
        {formatDanishNumber(entry.afforestationHa, 1)}ha
      </span>
    );
  }
  if (badges.length === 0) return null;
  return <span className="flex items-center gap-1.5">{badges}</span>;
}

export function RecentActivity() {
  const [changelog, setChangelog] = useState<ProjectChangelog | null>(null);
  const [expanded, setExpanded] = useState(false);
  const { config: pillarConfig } = usePillar();

  useEffect(() => {
    loadProjectChangelog().then(setChangelog);
  }, []);

  // Pick the most recent 7 days of changes for the compact summary
  const recentDays = useMemo(() => {
    if (!changelog) return [];
    return changelog.byDate.slice(0, 7);
  }, [changelog]);

  // Count changes in last 7 days
  const last7DaysCount = useMemo(() => {
    if (!recentDays.length) return 0;
    return recentDays.reduce((sum, d) => sum + d.entries.length, 0);
  }, [recentDays]);

  // Headline entries: pick 3 most notable recent changes (prefer established > approved > preliminary)
  const headlineEntries = useMemo(() => {
    if (!recentDays.length) return [];
    const allRecent = recentDays.flatMap((d) => d.entries);
    // Sort by importance: established first, then approved, then by date
    const sorted = [...allRecent].sort((a, b) => {
      const phaseOrder = { established: 0, approved: 1, preliminary: 2 };
      const pa = phaseOrder[a.phase as keyof typeof phaseOrder] ?? 3;
      const pb = phaseOrder[b.phase as keyof typeof phaseOrder] ?? 3;
      if (pa !== pb) return pa - pb;
      return b.date.localeCompare(a.date);
    });
    return sorted.slice(0, 3);
  }, [recentDays]);

  if (!changelog || changelog.totalChanges === 0) return null;

  return (
    <section className="w-full max-w-4xl mx-auto px-4 -mt-2 mb-6">
      <div
        className="rounded-xl border overflow-hidden transition-colors"
        style={{
          borderColor: pillarConfig.accentColor + '30',
          backgroundColor: pillarConfig.accentColor + '06',
        }}
      >
        {/* Compact summary bar */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors cursor-pointer"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: pillarConfig.accentColor + '15' }}
          >
            <Activity className="w-4 h-4" style={{ color: pillarConfig.accentColor }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-foreground">
                {formatDanishNumber(last7DaysCount)} ændringer
              </span>
              <span className="text-muted-foreground">de seneste 7 dage</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {changelog.summary.established > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PHASE_COLORS.established }} />
                  {changelog.summary.established} anlagt
                </span>
              )}
              {changelog.summary.approved > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PHASE_COLORS.approved }} />
                  {changelog.summary.approved} godkendt
                </span>
              )}
              {changelog.summary.preliminary > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PHASE_COLORS.preliminary }} />
                  {changelog.summary.preliminary} forundersøgelse
                </span>
              )}
              <span className="text-muted-foreground/60">
                (seneste {changelog.windowDays} dage)
              </span>
            </div>
          </div>

          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          }
        </button>

        {/* Headline entries (always visible) */}
        {!expanded && headlineEntries.length > 0 && (
          <div className="px-4 pb-3 flex flex-col gap-1">
            {headlineEntries.map((entry, i) => {
              const PhaseIcon = PHASE_ICONS[entry.phase] ?? ClipboardCheck;
              return (
                <div key={`${entry.projectId}-${i}`} className="flex items-center gap-2 text-xs">
                  <PhaseIcon className="w-3 h-3 flex-shrink-0" style={{ color: PHASE_COLORS[entry.phase] }} />
                  <span className="font-medium text-foreground truncate">{entry.name}</span>
                  <span className="text-muted-foreground flex-shrink-0">· {entry.phaseLabelDa}</span>
                  <EffectBadges entry={entry} />
                  <span className="ml-auto text-muted-foreground/60 flex-shrink-0 text-[10px]">
                    {relativeDateDa(entry.date)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Expanded detail view */}
        {expanded && (
          <div className="border-t px-4 py-3 max-h-80 overflow-y-auto" style={{ borderColor: pillarConfig.accentColor + '15' }}>
            <div className="space-y-4">
              {recentDays.map(({ date, entries }) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-foreground">
                      {shortDateDa(date)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {relativeDateDa(date)} · {entries.length} {entries.length === 1 ? 'ændring' : 'ændringer'}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-1.5 pl-2">
                    {entries.slice(0, 10).map((entry, i) => {
                      const PhaseIcon = PHASE_ICONS[entry.phase] ?? ClipboardCheck;
                      return (
                        <div key={`${entry.projectId}-${i}`} className="flex items-start gap-2 text-xs">
                          <PhaseIcon
                            className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                            style={{ color: PHASE_COLORS[entry.phase] }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-foreground">{entry.name}</span>
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{
                                  backgroundColor: PHASE_COLORS[entry.phase] + '15',
                                  color: PHASE_COLORS[entry.phase],
                                }}
                              >
                                {entry.phaseLabelDa}
                              </span>
                              <EffectBadges entry={entry} />
                            </div>
                            <div className="text-muted-foreground mt-0.5">
                              {entry.planName}
                              {entry.measureName && ` · ${entry.measureName}`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {entries.length > 10 && (
                      <p className="text-[10px] text-muted-foreground/60 pl-5">
                        + {entries.length - 10} flere ændringer denne dag
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
