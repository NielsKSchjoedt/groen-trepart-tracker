interface KommuneEmblemProps {
  /** Kommune name, e.g. "Aalborg" or "Høje-Taastrup". */
  name: string;
  /** Pixel size of the square emblem. */
  size?: number;
  /**
   * Optional emblem image (e.g. an official kommunevåben). When omitted, a
   * neutral branded monogram is rendered instead. This keeps the slot ready
   * for a future våben drop-in without changing call sites.
   *
   * NB: kommunevåben are reserved to the kommune under kommunestyrelseslovens
   * § 4, stk. 2 — only enable image emblems with the appropriate care/permission.
   */
  imageSrc?: string | null;
  className?: string;
}

/**
 * Derive a short, wordmark-style monogram from a kommune name.
 * - Multi-part names (hyphen/space) → initials of the first two parts ("HT").
 * - Single-word names → first two letters, second lowercased ("Aa", "Vejen" → "Ve").
 */
function kommuneMonogram(name: string): string {
  const parts = name.trim().split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  const word = parts[0] ?? '';
  if (word.length <= 1) return word.toUpperCase();
  return word[0].toUpperCase() + word[1].toLowerCase();
}

/**
 * Identity emblem for a kommune, used as the visual anchor of the kommune
 * detail hero. Renders a neutral green monogram by default.
 */
export function KommuneEmblem({ name, size = 64, imageSrc, className = '' }: KommuneEmblemProps) {
  const style = { width: size, height: size } as const;

  if (imageSrc) {
    return (
      <div
        className={`flex-shrink-0 rounded-xl overflow-hidden border border-primary/15 bg-white flex items-center justify-center ${className}`}
        style={style}
      >
        <img
          src={imageSrc}
          alt={`${name} Kommunes våben`}
          className="w-full h-full object-contain p-1.5"
          loading="lazy"
        />
      </div>
    );
  }

  const monogram = kommuneMonogram(name);

  return (
    <div
      aria-hidden="true"
      className={`flex-shrink-0 rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/20 text-primary flex items-center justify-center select-none ${className}`}
      style={style}
    >
      <span
        className="font-semibold leading-none"
        style={{ fontFamily: "'Fraunces', serif", fontSize: size * 0.4 }}
      >
        {monogram}
      </span>
    </div>
  );
}
