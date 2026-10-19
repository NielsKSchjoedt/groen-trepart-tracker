import { MapPinned } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface VisPaaKortLinkProps {
  href: string;
  label?: string;
  className?: string;
}

/**
 * Deep-link that opens a map with a predetermined layer combination.
 * Use with `buildVisPaaKortHref` / named presets so every “vis på kort”
 * points at the same layers the number was calculated from.
 */
export function VisPaaKortLink({
  href,
  label = 'Vis på kort',
  className,
}: VisPaaKortLinkProps) {
  return (
    <Link
      to={href}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 underline-offset-2 hover:underline',
        className,
      )}
    >
      <MapPinned className="h-3 w-3 shrink-0" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}
