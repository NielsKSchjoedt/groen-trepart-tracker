import type { ReactNode } from 'react';
import { SectionLinkCopy } from '@/lib/permalink/SectionLinkCopy';
import { replaceSectionHash } from '@/lib/permalink/slices/section';

interface ChapterSectionProps {
  /** Anchor id (without '#') — scroll target + scrollspy observe target */
  id: string;
  /** Small eyebrow label above the heading (the chapter's question framing) */
  eyebrow: string;
  /** The big plain-language heading (the chapter question) */
  question: string;
  /** Optional short lead paragraph under the heading */
  intro?: ReactNode;
  /** Accent colour for the eyebrow (defaults to a neutral muted tone) */
  accentColor?: string;
  /** Optional extra classes on the outer <section> */
  className?: string;
  children: ReactNode;
}

/**
 * Consistent narrative chapter wrapper. Renders a question-driven header
 * (eyebrow + heading + optional intro) and hosts the scroll anchor used by the
 * section indicator. `scroll-mt` keeps the heading clear of the sticky bar
 * when jumped to.
 *
 * @example
 * <ChapterSection id="projekter" eyebrow="Forstå projekterne der skal få os i mål" question="Hvad gør vi konkret?">
 *   ...
 * </ChapterSection>
 */
export function ChapterSection({
  id,
  eyebrow,
  question,
  intro,
  accentColor,
  className = '',
  children,
}: ChapterSectionProps) {
  return (
    <section id={id} lang="da" className={`scroll-mt-20 w-full ${className}`}>
      <div className="mx-auto max-w-5xl px-4 pt-10 pb-2 text-center">
        <div className="group mx-auto inline-flex max-w-full items-center justify-center gap-1.5">
          <a
            href={`#${id}`}
            onClick={(e) => {
              e.preventDefault();
              replaceSectionHash(id);
              document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="mb-1.5 text-xs font-semibold uppercase tracking-widest hover:underline underline-offset-2"
            style={{ color: accentColor ?? 'hsl(120 12% 45%)' }}
          >
            {eyebrow}
          </a>
          <SectionLinkCopy sectionId={id} className="mb-1.5" />
        </div>
        <h2
          className="text-2xl sm:text-3xl font-bold text-foreground"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {question}
        </h2>
        {intro && (
          <div className="mx-auto mt-3 max-w-2xl text-sm sm:text-[15px] leading-relaxed text-muted-foreground">
            {intro}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
