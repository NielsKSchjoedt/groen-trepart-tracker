import { Info, ChevronDown } from 'lucide-react';
import {
  STANDINGS_REGIONS,
  type StandingsMode,
} from '@/lib/kommune-ranking';
import { InfoTooltip } from '@/components/InfoTooltip';

interface KommuneStandingsControlsProps {
  region: string;
  onRegionChange: (r: string) => void;
  mode: StandingsMode;
  onModeChange: (m: StandingsMode) => void;
  infoOpen: boolean;
  onToggleInfo: () => void;
}

const regionLabel = (r: string) =>
  r === 'Alle regioner' ? 'Hele landet' : r.replace('Region ', '');

/**
 * Unified rangliste control bar — region scope, the global Ift. ansvar/Absolut
 * måleenhed for the three levering-boards, and a single "Sådan virker det"
 * toggle that reveals the folded explainer. Replaces the previously stacked
 * disclaimer + explainer + controls.
 */
export function KommuneStandingsControls({
  region,
  onRegionChange,
  mode,
  onModeChange,
  infoOpen,
  onToggleInfo,
}: KommuneStandingsControlsProps) {
  return (
    <div className="sticky top-[5.5rem] z-20 space-y-2">
      <div className="rounded-xl border border-border bg-background/90 backdrop-blur-md px-3 py-2.5 shadow-sm space-y-2.5">
        {/* Row 1 — region scope */}
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex-shrink-0">
            Område
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {STANDINGS_REGIONS.map((r) => {
              const active = r === region;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRegionChange(r)}
                  aria-pressed={active}
                  className={[
                    'whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer',
                    active
                      ? 'bg-primary/12 text-primary ring-1 ring-primary/25'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  ].join(' ')}
                >
                  {regionLabel(r)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2 — måleenhed (levering) + explainer toggle */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Levering
          </span>
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label="Måleenhed">
            {([
              { id: 'relativ' as const, label: 'Ift. ansvar' },
              { id: 'absolut' as const, label: 'Absolut' },
            ]).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onModeChange(m.id)}
                aria-pressed={mode === m.id}
                className={[
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                  mode === m.id
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-border/40'
                    : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {m.label}
              </button>
            ))}
          </div>
          <InfoTooltip
            title="Ift. ansvar vs. absolut"
            content={
              <>
                <p><strong>Ift. ansvar</strong> — beregnet som:</p>
                <p className="text-foreground">(Kommunens andel af landets levering) ÷ (Kommunens andel af det nationale naturpotentiale)</p>
                <p>1,0× = de to andele er lige store = som forventet. 2,0× = dobbelt så meget som ansvaret tilsiger.</p>
                <p><strong>Absolut</strong> — de rå hektar/ton lagt sammen, uden hensyn til størrelse. Intet divideres; store kommuner ligger naturligt højt.</p>
                <p>Gælder virkemidlerne (lavbund, skov, kvælstof). Natur og CO₂ har deres egen måleenhed på selve listen.</p>
              </>
            }
            source="MARS-projektdata + naturpotentiale (DCE 30 %)"
            size={13}
            side="bottom"
            align="start"
          />
          <span className="hidden sm:inline text-[11px] text-muted-foreground">
            — gælder virkemidlerne
          </span>
          <div className="flex-1 min-w-[8px]" />
          <button
            type="button"
            onClick={onToggleInfo}
            aria-expanded={infoOpen}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" strokeWidth={2.2} />
            Sådan virker det
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${infoOpen ? 'rotate-180' : ''}`} strokeWidth={2.4} />
          </button>
        </div>

        {mode === 'absolut' && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/80 px-3 py-1.5 text-[11px] text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
            <span className="font-bold">⚠</span>
            <span>
              <strong>Absolut levering</strong> belønner store kommuner med meget areal — det siger lidt om indsats <em>ift. ansvar</em>.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
