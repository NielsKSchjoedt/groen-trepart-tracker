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
  { value: 'relativ', label: 'Andel af ansvar' },
  { value: 'maal', label: 'Mod målet' },
  { value: 'absolut', label: 'Absolut' },
];

/**
 * Compact rangliste control bar. A single line carries the two most-used
 * controls — region scope (dropdown) and the global Andel af ansvar/Mod målet/Absolut
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
          title="Andel af ansvar · Mod målet · Absolut"
          content={
            <>
              <p><strong>Andel af ansvar</strong> — hvor stor en del af kommunens egen andel af målet der er godkendt eller anlagt. 100 % = hele andelen. Hver kommune måles mod sin egen andel, så små og store kommuner kan sammenlignes.</p>
              <p><strong>Mod målet</strong> — den samme andel sat over for, hvor meget af tiden til fristen der er gået. 1,0× = præcis på sporet. Under 1,0× = bagud, uanset placering ift. naboerne.</p>
              <p><strong>Absolut</strong> — de rå hektar/ton, uden hensyn til kommunens andel af målet.</p>
              <p>Kommunens andel er en faglig fordeling af MARS-oplandenes mål efter landbrugsjord og kulstofrig jord — der findes ingen officiel kommunal fordeling.</p>
            </>
          }
          source="MARS-projekter og -planer · DCA kulstofkort 2022 · Danmarks Statistik (AREALDK)"
          size={13}
          side="bottom"
          align="start"
        />

        <div className="flex-1 min-w-[8px]" />

        <PhaseFilterPopover
          selected={selectedPhases}
          onChange={onPhasesChange}
          tooltipContent="Vælg hvilke MARS-projektfaser der tæller med i ranglisten. Standard er godkendt og anlagt — det, der er besluttet eller i jorden. Forundersøgelser og skitser kan slås til."
          footer={<CopyLinkButton />}
        />
      </ControlBar>

      {variant === 'default' && mode === 'absolut' && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/80 px-3 py-1.5 text-[11px] text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          <span className="font-bold">⚠</span>
          <span>
            <strong>Absolut levering</strong> belønner kommuner med meget landbrugsjord — det siger lidt om indsats <em>ift. kommunens andel af målet</em>.
          </span>
        </p>
      )}
    </div>
  );
}
