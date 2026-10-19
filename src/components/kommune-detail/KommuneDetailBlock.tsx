import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface KommuneDetailBlockProps {
  id?: string;
  title: string;
  intro?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Consistent card section within a kommune detail page (projetter chapter).
 * One headline style, left-aligned body — matches opland/benchmark cards.
 */
export function KommuneDetailBlock({
  id,
  title,
  intro,
  children,
  className,
}: KommuneDetailBlockProps) {
  return (
    <section
      id={id}
      className={cn(
        'rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5',
        className,
      )}
    >
      <header className="mb-4">
        <h3
          className="text-base font-bold text-foreground leading-snug"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {title}
        </h3>
        {intro && (
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{intro}</p>
        )}
      </header>
      {children}
    </section>
  );
}
