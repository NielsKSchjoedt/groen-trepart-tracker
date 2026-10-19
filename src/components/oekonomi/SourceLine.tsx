import { ExternalLink } from 'lucide-react';

interface SourceLineProps {
  label: string;
  url?: string;
  accentColor?: string;
}

export function SourceLine({ label, url, accentColor }: SourceLineProps) {
  return (
    <div className="mt-3.5 flex items-center gap-1.5 border-t border-border/60 pt-3 text-[10px] text-muted-foreground">
      <span className="uppercase tracking-wider">Kilde</span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium hover:underline"
          style={{ color: accentColor ?? 'hsl(var(--primary))' }}
        >
          {label}
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
}
