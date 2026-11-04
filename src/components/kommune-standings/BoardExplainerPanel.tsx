import { AlertTriangle, ArrowLeft, Mountain, Trees, Droplets, Leaf, Factory } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { type BoardDef, type BoardFormula, type BoardKey } from '@/lib/kommune-boards';

const BOARD_ICONS: Record<BoardKey, LucideIcon> = {
  lavbund: Mountain,
  skov: Trees,
  kvaelstof: Droplets,
  natur: Leaf,
  co2: Factory,
};

const ink = (hex: string) => `color-mix(in srgb, ${hex} 76%, black)`;
const tint = (hex: string, whiteShare: number) =>
  `color-mix(in srgb, ${hex} ${Math.round((1 - whiteShare) * 100)}%, white)`;

interface BoardExplainerPanelProps {
  def: BoardDef;
  /** Shown on the natur board — DN nuance about no official kommune split. */
  disclaimer?: string;
  onClose: () => void;
}

/** Back face of a rangliste card — how this board's numbers are computed. */
export function BoardExplainerPanel({ def, disclaimer, onClose }: BoardExplainerPanelProps) {
  const Icon = BOARD_ICONS[def.key];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-border/60 flex-shrink-0"
        style={{ backgroundColor: tint(def.tone, 0.88) }}
      >
        <span
          className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
          style={{ backgroundColor: tint(def.tone, 0.7) }}
        >
          <Icon style={{ color: def.tone, width: 18, height: 18 }} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block text-sm font-bold leading-tight"
            style={{ color: ink(def.tone), fontFamily: "'Fraunces', serif" }}
          >
            Hvordan virker det?
          </span>
          <span className="block text-[10px] leading-tight truncate" style={{ color: def.tone }}>
            {def.label} — {def.kind === 'levering' ? 'indsats ift. ansvar' : 'aktuel tilstand'}
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex-shrink-0"
        >
          <ArrowLeft className="w-3 h-3" strokeWidth={2.4} />
          Rangliste
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {def.kind === 'levering'
            ? 'Måler kommunens indsats ift. dens andel af landets naturpotentiale — ikke en politisk forpligtelse per kommune.'
            : 'Måler en aktuel tilstand i kommunen — ikke Trepart-levering direkte.'}
        </p>

        <dl className="space-y-2.5">
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

        <p className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground/70 italic">
          Kilde: {def.source}
        </p>

        {disclaimer && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" strokeWidth={2} />
            <p className="leading-relaxed">{disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}

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
