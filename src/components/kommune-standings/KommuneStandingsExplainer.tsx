import { AlertTriangle, Mountain, Trees, Droplets, Leaf, Factory } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BOARDS, type BoardFormula, type BoardKey } from '@/lib/kommune-boards';

interface KommuneStandingsExplainerProps {
  /** Controlled open state — toggled by the "Sådan virker det" button in the control bar. */
  open: boolean;
  /** Disclaimer text from ranking metadata (DN nuance about no official kommune split). */
  disclaimer?: string;
}

const DEFAULT_DISCLAIMER =
  'Der findes ingen officiel kommunal fordeling af naturmålet. Ranglisten bruger naturpotentiale som fagligt stand-in for ansvar — ikke en politisk forpligtelse. Skitseprojekter tæller ikke med i levering.';

const ICONS: Record<BoardKey, LucideIcon> = {
  lavbund: Mountain,
  skov: Trees,
  kvaelstof: Droplets,
  natur: Leaf,
  co2: Factory,
};

const ink = (hex: string) => `color-mix(in srgb, ${hex} 76%, black)`;
const tint = (hex: string, whiteShare: number) =>
  `color-mix(in srgb, ${hex} ${Math.round((1 - whiteShare) * 100)}%, white)`;

/**
 * Folded "Sådan virker det" panel. Collapsed by default. A data-driven glossary
 * of every board and its måleenheder — what each means and exactly how it is
 * computed — plus the DN disclaimer. Stays in sync with `BOARDS`.
 */
export function KommuneStandingsExplainer({ open, disclaimer = DEFAULT_DISCLAIMER }: KommuneStandingsExplainerProps) {
  if (!open) return null;
  return (
    <div className="rounded-2xl border border-border bg-card/60 px-4 py-4 space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
          Sådan virker listerne
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Levering</strong> (lavbund, skov, kvælstof) måler indsats ift. kommunens ansvar.{' '}
          <strong>Status</strong> (natur, CO₂) måler en aktuel tilstand — ikke Trepart-levering. Hver liste kan skifte måleenhed:
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {BOARDS.map((def) => {
          const Icon = ICONS[def.key];
          return (
            <div key={def.key} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0"
                  style={{ backgroundColor: tint(def.tone, 0.7) }}
                >
                  <Icon style={{ color: def.tone, width: 14, height: 14 }} strokeWidth={2.2} />
                </span>
                <span className="text-[13px] font-bold" style={{ color: ink(def.tone), fontFamily: "'Fraunces', serif" }}>
                  {def.label}
                </span>
                <span
                  className="text-[9px] font-semibold uppercase tracking-wide rounded px-1 py-px ml-auto"
                  style={{ color: def.tone, backgroundColor: tint(def.tone, 0.8) }}
                >
                  {def.kind}
                </span>
              </div>
              <dl className="space-y-2">
                {def.options.map((o) => (
                  <div key={o.id}>
                    <dt className="text-[12px] font-semibold text-foreground">{o.label}</dt>
                    <dd className="text-[11px] text-muted-foreground leading-relaxed">
                      {o.desc}
                      <Formula formula={o.formula} tone={def.tone} />
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground/70 italic">
                Kilde: {def.source}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" strokeWidth={2} />
        <p className="leading-relaxed">{disclaimer}</p>
      </div>
    </div>
  );
}

/**
 * Visual formula. `ratio` renders as a real fraction (top over a line over
 * bottom) so it's immediately clear which number is divided by which; `sum`
 * renders as a single boxed total. The result line spells out how to read it.
 */
function Formula({ formula, tone }: { formula: BoardFormula; tone: string }) {
  return (
    <span
      className="block mt-1.5 rounded-lg px-2.5 py-2"
      style={{ backgroundColor: `color-mix(in srgb, ${tone} 8%, transparent)` }}
    >
      {formula.kind === 'ratio' ? (
        <span className="flex flex-col items-center text-center text-[11px] text-foreground leading-snug">
          <span className="pb-1">{formula.top}</span>
          <span
            className="w-full border-t-2 pt-1"
            style={{ borderColor: `color-mix(in srgb, ${tone} 55%, transparent)` }}
          >
            {formula.bottom}
          </span>
        </span>
      ) : (
        <span className="block text-center text-[11px] font-medium text-foreground leading-snug">
          {formula.expr}
        </span>
      )}
      <span className="block mt-1.5 pt-1.5 border-t border-border/40 text-[10.5px] text-muted-foreground">
        = {formula.result}
      </span>
    </span>
  );
}
