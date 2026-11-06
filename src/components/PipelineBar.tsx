interface PipelineBarProps {
  anlagtPct: number;
  pipelinePct: number;
  accentColor: string;
  className?: string;
}

/**
 * Three-layer progress track: anlagt (solid) · i pipeline (muted) · resten af mål (track).
 */
export function PipelineBar({ anlagtPct, pipelinePct, accentColor, className = '' }: PipelineBarProps) {
  const anlagt = Math.min(Math.max(anlagtPct, 0), 100);
  const pipeline = Math.min(Math.max(pipelinePct, 0), 100 - anlagt);

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        {/* Pipeline (approved, not yet built) */}
        {(anlagt + pipeline) > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(anlagt + pipeline, 100)}%`,
              backgroundColor: accentColor,
              opacity: 0.22,
            }}
          />
        )}
        {/* Anlagt (established) */}
        {anlagt > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
            style={{
              width: `${anlagt}%`,
              backgroundColor: accentColor,
            }}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
          anlagt
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: accentColor, opacity: 0.35 }}
          />
          i pipeline
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/25" />
          resten af mål
        </span>
      </div>
    </div>
  );
}
