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
import { ControlBar, ControlBarSegmented, ControlBarTrigger } from '@/components/ControlBar';

interface KommuneStandingsControlsProps {
  region: string;
  onRegionChange: (r: string) => void;
  mode: StandingsMode;
  onModeChange: (m: StandingsMode) => void;
  selectedPhases: Set<KommunePhase>;
  onPhasesChange: (phases: Set<KommunePhase>) => void;
  /** `embedded` repeats the bar without sticky chrome (e.g. above the master table). */
  variant?: 'default' | 'embedded';
}

const regionLabel = (r: string) =>
  r === 'Alle regioner' ? 'Hele landet' : r.replace('Region ', '');

const MODE_OPTIONS: { value: StandingsMode; label: string }[] = [
  { value: 'maal', label: 'Mod målet' },
  { value: 'relativ', label: 'Ift. ansvar' },
  { value: 'absolut', label: 'Absolut' },
];

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
  variant = 'default',
}: KommuneStandingsControlsProps) {
  const [regionOpen, setRegionOpen] = useState(false);
  const embedded = variant === 'embedded';

  return (
    <div
      className={
        embedded
          ? 'space-y-2'
          : 'sticky top-[5.5rem] z-20 space-y-2 lg:static lg:top-auto lg:z-auto'
      }
    >
      <ControlBar className="rounded-xl border border-border bg-background/90 backdrop-blur-md px-2.5 py-2 shadow-sm">
        <Popover open={regionOpen} onOpenChange={setRegionOpen}>
          <PopoverTrigger asChild>
            <ControlBarTrigger aria-label="Vælg område">
              <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" strokeWidth={2.2} />
              {regionLabel(region)}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" strokeWidth={2.4} />
            </ControlBarTrigger>
          </PopoverTrigger>
          <PopoverContent align="start" className="z-[10000] w-52 p-1">
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
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-muted/60 transition-colors cursor-pointer"
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

        <ControlBarSegmented
          value={mode}
          options={MODE_OPTIONS}
          onChange={onModeChange}
          aria-label="Måleenhed"
        />
        <InfoTooltip
          title="Mod målet · Ift. ansvar · Absolut"
          content={
            <>
              <p><strong>Mod målet</strong> — leverer kommunen i det tempo, 2030-målet kræver? 1,0× = præcis på sporet. Under 1,0× = bagud uanset placering ift. naboerne. Det er den samme ift.-ansvar-søjle skaleret med landets tempo mod målet.</p>
              <p><strong>Ift. ansvar</strong> — beregnet som:</p>
              <p className="text-foreground">(Kommunens andel af landets levering) ÷ (Kommunens andel af det nationale naturpotentiale)</p>
              <p>1,0× = de to andele er lige store = som forventet. Måler indbyrdes andel — den gennemsnitlige kommune er altid 1,0×, så det siger intet om landet når målet.</p>
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
      </ControlBar>

      {variant === 'default' && mode === 'absolut' && (
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
