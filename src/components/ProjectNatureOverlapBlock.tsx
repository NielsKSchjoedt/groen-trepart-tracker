import { Leaf } from 'lucide-react';
import { formatDanishNumber } from '@/lib/format';
import type { ProjectNatureOverlap } from '@/lib/types';

/**
 * Nature overlap for a single project — how much of the project area overlaps
 * mapped nature (DCE biodiversity map = headline, plus §3 / Natura 2000).
 */
export function ProjectNatureOverlapBlock({ ov, compact = false }: { ov: ProjectNatureOverlap; compact?: boolean }) {
  const { biodiversitetHa: bio, section3Ha: s3, natura2000Ha: n2 } = ov;
  const hasOverlap = bio > 0 || s3 > 0 || n2 > 0;
  const textSize = compact ? 'text-[10px]' : 'text-[11px]';

  if (!hasOverlap) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Leaf className="w-3 h-3 flex-shrink-0" style={{ color: '#166534' }} />
          <span className="font-medium text-foreground">Naturoverlap</span>
        </div>
        <p className={`${textSize} text-muted-foreground leading-snug`}>
          Projektarealet overlapper ikke kortlagt natur (biodiversitetskort, §3 eller Natura 2000).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-emerald-200/70 bg-emerald-50/50 px-2.5 py-2 space-y-1 dark:border-emerald-500/20 dark:bg-emerald-950/20">
      <div className="flex items-center gap-1.5">
        <Leaf className="w-3 h-3 flex-shrink-0" style={{ color: '#166534' }} />
        <span className="font-medium text-foreground">Naturoverlap</span>
      </div>
      <div className={`flex flex-wrap gap-x-3 gap-y-0.5 ${textSize}`}>
        {bio > 0 && (
          <span>
            <span className="text-muted-foreground">Biodiversitetskort:</span>{' '}
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">{formatDanishNumber(bio, 1)} ha</span>
          </span>
        )}
        {s3 > 0 && (
          <span>
            <span className="text-muted-foreground">§3:</span>{' '}
            <span className="font-semibold text-foreground">{formatDanishNumber(s3, 1)} ha</span>
          </span>
        )}
        {n2 > 0 && (
          <span>
            <span className="text-muted-foreground">Natura 2000:</span>{' '}
            <span className="font-semibold text-foreground">{formatDanishNumber(n2, 1)} ha</span>
          </span>
        )}
      </div>
      <p className={`${textSize} text-muted-foreground leading-snug`}>
        Hvor projektarealet overlapper kortlagt natur. Det er en <strong>stærk indikator for naturpotentiale</strong> —
        ikke en garanti for, at naturen reelt forbedres.
      </p>
    </div>
  );
}
