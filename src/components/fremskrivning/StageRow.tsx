import { Lock } from 'lucide-react';
import type { FremskrivningStageData, FremskrivningStageId } from '@/lib/fremskrivning';
import { formatFremskrivningValue } from '@/lib/fremskrivning';
import { formatDanishNumber } from '@/lib/format';

interface StageRowProps {
  stage: FremskrivningStageData;
  active: boolean;
  accent: string;
  unitShort: string;
  showCounts: boolean;
  onToggle: (id: Exclude<FremskrivningStageId, 'anlagt'>) => void;
}

/**
 * Compact toggle-legend row for one projection stage.
 *
 * Replaces the previous large descriptive cards: a single slim row with a
 * left toggle, the stage label, its certainty badge (kept — it signals how
 * solid the layer is), and the hectare/project counts on the right. The long
 * description moves to the row's `title` (hover/long-press) so the certainty
 * pedagogy survives without the vertical bulk. Locked stages (anlagt /
 * realised supplements) render without a toggle and always count.
 */
export function StageRow({
  stage,
  active,
  accent,
  unitShort,
  showCounts,
  onToggle,
}: StageRowProps) {
  const isLocked = stage.locked || stage.id === 'anlagt';
  const isActive = isLocked ? true : active;
  const showAsBase = stage.id === 'anlagt' || stage.kind === 'supplement_completed';

  const valueLabel = `${showAsBase ? '' : '+'}${formatFremskrivningValue(stage.value)}`;

  return (
    <div
      role={isLocked ? undefined : 'button'}
      tabIndex={isLocked ? undefined : 0}
      title={stage.description}
      onClick={() => !isLocked && onToggle(stage.id as Exclude<FremskrivningStageId, 'anlagt'>)}
      onKeyDown={(e) => {
        if (!isLocked && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onToggle(stage.id as Exclude<FremskrivningStageId, 'anlagt'>);
        }
      }}
      aria-pressed={isActive}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors duration-150 ${
        isLocked ? 'cursor-default' : 'cursor-pointer'
      } ${stage.dashed && !isActive ? 'border-dashed' : 'border-solid'} ${
        isActive ? '' : 'border-border bg-transparent hover:bg-muted/40'
      }`}
      style={
        isActive
          ? { backgroundColor: accent + '12', borderColor: accent + '55' }
          : undefined
      }
    >
      {/* Toggle / lock indicator */}
      {isLocked ? (
        <span
          className="flex-shrink-0 inline-flex items-center justify-center w-9 h-[18px] rounded-full"
          style={{ backgroundColor: accent + '33' }}
          aria-hidden
        >
          <Lock className="w-3 h-3" style={{ color: accent }} />
        </span>
      ) : (
        <span
          className="flex-shrink-0 relative w-9 h-[18px] rounded-full transition-colors"
          style={{ backgroundColor: isActive ? accent : 'hsl(40 14% 78%)' }}
          aria-hidden
        >
          <span
            className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all"
            style={{ left: isActive ? 'calc(100% - 1rem)' : '0.125rem' }}
          />
        </span>
      )}

      {/* Label + certainty badge */}
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={`text-sm font-semibold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          {stage.label}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
          style={{
            backgroundColor: stage.certColor + (isActive ? '28' : '14'),
            color: stage.certColor,
          }}
        >
          {stage.certainty}
        </span>
        {isLocked && (
          <span className="text-[10px] italic text-muted-foreground whitespace-nowrap">
            tæller altid med
          </span>
        )}
      </span>

      {/* Values */}
      <span className="flex-shrink-0 text-right">
        <span
          className="block font-bold text-[15px] tabular-nums leading-none"
          style={{
            fontFamily: "'Fraunces', serif",
            color: isActive ? accent : 'hsl(40 8% 55%)',
          }}
        >
          {valueLabel}
          <span className="text-[10px] font-semibold"> {unitShort}</span>
        </span>
        {showCounts && stage.projectCount > 0 && (
          <span
            className={`mt-0.5 block text-[11px] tabular-nums ${
              isActive ? 'text-muted-foreground' : 'text-muted-foreground/70'
            }`}
          >
            {formatDanishNumber(stage.projectCount)} projekter
          </span>
        )}
      </span>
    </div>
  );
}
