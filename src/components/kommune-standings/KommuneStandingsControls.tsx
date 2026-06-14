import { useState } from 'react';
import { ChevronDown, MapPin, Check } from 'lucide-react';
import {
  STANDINGS_REGIONS,
  type StandingsMode,
} from '@/lib/kommune-ranking';
import { type KommunePhase } from '@/lib/kommune-metrics';
import { InfoTooltip } from '@/components/InfoTooltip';
import { PhaseFilterPopover } from '@/components/PhaseFilterPopover';
import { CopyLinkButton } from '@/lib/permalink/CopyLinkButton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface KommuneStandingsControlsProps {
  region: string;
  onRegionChange: (r: string) => void;
  mode: StandingsMode;
  onModeChange: (m: StandingsMode) => void;
  selectedPhases: Set<KommunePhase>;
  onPhasesChange: (phases: Set<KommunePhase>) => void;
}

const regionLabel = (r: string) =>
  r === 'Alle regioner' ? 'Hele landet' : r.replace('Region ', '');

/**
 * Compact rangliste control bar. A single line carries the two most-used
 * controls — region scope (dropdown) and the global Ift. ansvar/Absolut
 * måleenhed. Projektfaser foldes ind i en kompakt popover med tæller.
 */
export function KommuneStandingsControls({
  region,
  onRegionChange,
  mode,
  onModeChange,
  selectedPhases,
  onPhasesChange,
}: KommuneStandingsControlsProps) {
  const [regionOpen, setRegionOpen] = useState(false);

  return (
    <div className="sticky top-[5.5rem] z-20 space-y-2 lg:static lg:top-auto lg:z-auto">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/90 backdrop-blur-md px-2.5 py-2 shadow-sm">
        {/* Region scope — dropdown */}
        <Popover open={regionOpen} onOpenChange={setRegionOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Vælg område"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" strokeWidth={2.2} />
              {regionLabel(region)}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" strokeWidth={2.4} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 p-1">
            {STANDINGS_REGIONS.map((r) => {
              const active = r === region;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    onRegionChange(r);
                    setRegionOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <span className={active ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                    {regionLabel(r)}
                  </span>
                  {active && <Check className="w-3.5 h-3.5 text-primary" strokeWidth={2.6} />}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>

        {/* Måleenhed (levering) */}
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
                'rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
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

        <div className="flex-1 min-w-[8px]" />

        <PhaseFilterPopover
          selected={selectedPhases}
          onChange={onPhasesChange}
          tooltipContent="Vælg hvilke MARS-projektfaser der tæller med i ranglisten. Standard er kun anlagt — udvid for at inkludere godkendt og forundersøgelse. Skitser tæller aldrig med."
          footer={<CopyLinkButton />}
        />
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
  );
}
