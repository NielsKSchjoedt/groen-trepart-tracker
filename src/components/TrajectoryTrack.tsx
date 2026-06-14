import { Clock } from 'lucide-react';

interface TrajectoryTrackProps {
  /** Andel af tiden gået fra aftalen (2024) til deadline, 0–100 */
  timePct: number;
  /** Andel af målet anlagt/nået i dag, 0–100 */
  builtPct: number;
  /** Lineær fremskrivning til deadline, 0–100. null = ingen prognose */
  projectedPct?: number | null;
  /** Accentfarve for fremdriftsbjælken */
  accent: string;
  /** Lille label under fremdriftsbjælken, fx "→ 27% i 2045" */
  ghostLabel?: string;
  /** Etiket for fremdriftsrækken (måle-kort: "anlagt"; effekt: "nået") */
  progressLabel?: string;
}

const NEUTRAL = '#888780';

/** Sørg for at meget små værdier stadig er synlige som en tynd stribe. */
function visibleWidth(pct: number): string {
  if (pct <= 0) return '0';
  return `max(3px, ${Math.min(pct, 100)}%)`;
}

/**
 * Two-bar trajectory on a shared 0–100% scale. Row 1 (neutral) = time spent;
 * row 2 (accent) = built so far, with a faint ghost to the linear projection.
 * The empty remainder of each track is the gap to the goal — readable without
 * hover. Compact: no numeric columns (the sentence below carries the figures).
 */
export function TrajectoryTrack({
  timePct,
  builtPct,
  projectedPct = null,
  accent,
  ghostLabel,
  progressLabel = 'anlagt',
}: TrajectoryTrackProps) {
  const time = Math.min(Math.max(timePct, 0), 100);
  const built = Math.min(Math.max(builtPct, 0), 100);
  const projected =
    projectedPct !== null ? Math.min(Math.max(projectedPct, built), 100) : null;

  return (
    <div className="text-[9px] text-muted-foreground">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="flex w-[38px] shrink-0 items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" strokeWidth={1.75} aria-hidden="true" />
          tid
        </span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: visibleWidth(time), backgroundColor: NEUTRAL }} />
        </div>
        <span className="w-[30px] shrink-0 text-right tabular-nums">{Math.round(time)}%</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="w-[38px] shrink-0">{progressLabel}</span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          {projected !== null && projected > built && (
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: visibleWidth(projected), backgroundColor: accent, opacity: 0.28 }} />
          )}
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: visibleWidth(built), backgroundColor: accent }} />
        </div>
        <span className="w-[30px] shrink-0 text-right font-semibold tabular-nums" style={{ color: accent }}>
          {builtPct > 0 && builtPct < 1 ? '<1%' : `${Math.round(built)}%`}
        </span>
      </div>

      {ghostLabel && <p className="mt-1 pl-[44px]">{ghostLabel}</p>}
    </div>
  );
}
