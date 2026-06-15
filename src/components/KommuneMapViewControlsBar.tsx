import { useState } from 'react';
import { ChevronDown, Eye } from 'lucide-react';
import { InfoTooltip } from '@/components/InfoTooltip';
import { PhaseFilterPopover } from '@/components/PhaseFilterPopover';
import { SupplementSourceToggles } from '@/components/SupplementSourceToggles';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ControlBarInlineField,
  ControlBarStackedField,
  ControlBarSegmented,
  ControlBarTrigger,
  ControlBarCountBadge,
} from '@/components/ControlBar';
import type { KommuneMetric, KommunePhase, SupplementSource } from '@/lib/kommune-metrics';
import type { ChoroplethScaleMode, FordelingViewMode, NatureLayerKey } from '@/lib/kommune-map-visualization';
import {
  NATURE_LAYER_OPTIONS,
  showChoroplethScaleToggle,
  showFordelingViewToggle,
  showNatureLayerToggle,
} from '@/lib/kommune-map-visualization';

export interface KommuneMapViewControlsBarProps {
  activeMetric: KommuneMetric;
  showGrundkort: boolean;
  natureLayer: NatureLayerKey;
  onNatureLayerChange: (layer: NatureLayerKey) => void;
  fordelingViewMode: FordelingViewMode;
  onFordelingViewModeChange: (mode: FordelingViewMode) => void;
  choroplethScale: ChoroplethScaleMode;
  onChoroplethScaleChange: (mode: ChoroplethScaleMode) => void;
  showPhaseFilter?: boolean;
  selectedPhases?: Set<KommunePhase>;
  onPhasesChange?: (phases: Set<KommunePhase>) => void;
  phaseFilterTooltip?: string;
  supplementSources?: SupplementSource[];
  activeSupplements?: Set<SupplementSource>;
  onSupplementsChange?: (next: Set<SupplementSource>) => void;
  /** Dropdown + Kortvisning popover instead of inline toggle rows. */
  compact?: boolean;
}

/**
 * Map view controls for the kommune choropleth — grundkort, scale, faser and tilvalg.
 * Desktop: inline toggle rows. Mobile: collapsed into a single "Kortvisning" popover.
 */
export function KommuneMapViewControlsBar({
  activeMetric,
  showGrundkort,
  natureLayer,
  onNatureLayerChange,
  fordelingViewMode,
  onFordelingViewModeChange,
  choroplethScale,
  onChoroplethScaleChange,
  showPhaseFilter = false,
  selectedPhases = new Set(['established']),
  onPhasesChange,
  phaseFilterTooltip,
  supplementSources = [],
  activeSupplements = new Set(),
  onSupplementsChange,
  compact = false,
}: KommuneMapViewControlsBarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const showNature = showGrundkort && showNatureLayerToggle(activeMetric);
  const showFordeling = showGrundkort && showFordelingViewToggle(activeMetric);
  const showScale = showChoroplethScaleToggle(activeMetric, fordelingViewMode);
  const showSupplements =
    supplementSources.length > 0
    && fordelingViewMode === 'actual'
    && onSupplementsChange;

  const hasKortvisningControls = showNature || showFordeling || showScale || showSupplements;

  const kortvisningActiveCount =
    (showNature && natureLayer !== 'b4-beskyttet' ? 1 : 0)
    + (showFordeling && fordelingViewMode !== 'actual' ? 1 : 0)
    + (showScale && choroplethScale !== 'absolute' ? 1 : 0)
    + (showSupplements ? activeSupplements.size : 0);

  const hasCustomSettings = kortvisningActiveCount > 0;

  const natureTooltip = (
    <InfoTooltip
      title="Grundkort"
      content={
        <p>
          Grundkortet er den farvelagte baggrund. Vælg hvilket benchmark-kortlag der farvelægger
          kommunerne — samme kilder som på det nationale kort under beskyttet natur.
        </p>
      }
      source="Arealdata om biodiversitet · DCE 30 %"
      side="bottom"
      size={13}
    />
  );

  const fordelingTooltip = (
    <InfoTooltip
      title="Grundkort"
      content={
        <p>
          <strong>Faktisk</strong> viser realiseret areal fra MARS.{' '}
          <strong>Fagligt forventet</strong> og <strong>Forskel</strong> er en simulering baseret
          på proportional fordeling efter naturpotentiale — et diskussionsgrundlag, ikke officiel
          kommune-fordeling.
        </p>
      }
      side="bottom"
      size={13}
    />
  );

  const scaleTooltip = (
    <InfoTooltip
      title="Absolut vs. ift. ansvar"
      content={
        <>
          <p><strong>Absolut (ha)</strong> — samlet areal fra valgte projektfaser (og evt. KSF). Farver skaleres mod den kommune med mest.</p>
          <p><strong>Ift. ansvar</strong> — samme formel som ranglisten: (kommunens andel af landets levering) ÷ (kommunens andel af naturpotentiale). 1,0× = som forventet.</p>
        </>
      }
      source="MARS + DCE 30 % naturpotentiale"
      side="bottom"
      size={13}
    />
  );

  const phaseTooltipContent = phaseFilterTooltip
    ?? 'Vælg hvilke MARS-projektfaser der tæller med i tallene på kortet. Standard er kun anlagt — udvid for at inkludere godkendt og forundersøgelse.';

  const natureOptions = NATURE_LAYER_OPTIONS.map((o) => ({ value: o.id, label: o.shortLabel }));
  const fordelingOptions = [
    { value: 'actual' as const, label: 'Faktisk' },
    { value: 'simulated' as const, label: 'Fagligt forventet' },
    { value: 'difference' as const, label: 'Forskel' },
  ];
  const scaleOptions = [
    { value: 'absolute' as const, label: 'Absolut (ha)' },
    { value: 'ansvar' as const, label: 'Ift. ansvar' },
  ];

  const desktopControls = (
    <>
      {showNature && (
        <ControlBarInlineField label="Grundkort" tooltip={natureTooltip}>
          <ControlBarSegmented
            value={natureLayer}
            options={natureOptions}
            onChange={onNatureLayerChange}
            aria-label="Grundkort"
          />
        </ControlBarInlineField>
      )}

      {showFordeling && (
        <ControlBarInlineField label="Grundkort" tooltip={fordelingTooltip}>
          <ControlBarSegmented
            value={fordelingViewMode}
            options={fordelingOptions}
            onChange={onFordelingViewModeChange}
            aria-label="Fordelingvisning"
          />
        </ControlBarInlineField>
      )}

      {showScale && (
        <ControlBarInlineField label="Vis som" tooltip={scaleTooltip}>
          <ControlBarSegmented
            value={choroplethScale}
            options={scaleOptions}
            onChange={onChoroplethScaleChange}
            aria-label="Skala"
          />
        </ControlBarInlineField>
      )}

      {showPhaseFilter && onPhasesChange && (
        <PhaseFilterPopover
          selected={selectedPhases}
          onChange={onPhasesChange}
          align="start"
          tooltipContent={phaseTooltipContent}
        />
      )}

      {showSupplements && (
        <SupplementSourceToggles
          metric={activeMetric}
          sources={supplementSources}
          active={activeSupplements}
          onChange={onSupplementsChange}
        />
      )}
    </>
  );

  const mobileStackedControls = (
    <div className="space-y-3.5">
      {showNature && (
        <ControlBarStackedField label="Grundkort" tooltip={natureTooltip}>
          <ControlBarSegmented
            value={natureLayer}
            options={natureOptions}
            onChange={onNatureLayerChange}
            aria-label="Grundkort"
            className="flex flex-wrap"
          />
        </ControlBarStackedField>
      )}

      {showFordeling && (
        <ControlBarStackedField label="Visning" tooltip={fordelingTooltip}>
          <ControlBarSegmented
            value={fordelingViewMode}
            options={fordelingOptions}
            onChange={onFordelingViewModeChange}
            aria-label="Fordelingvisning"
            className="flex flex-wrap"
          />
        </ControlBarStackedField>
      )}

      {showScale && (
        <ControlBarStackedField label="Skala" tooltip={scaleTooltip}>
          <ControlBarSegmented
            value={choroplethScale}
            options={scaleOptions}
            onChange={onChoroplethScaleChange}
            aria-label="Skala"
            className="flex flex-wrap"
          />
        </ControlBarStackedField>
      )}

      {showSupplements && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Tilvalg
          </p>
          <SupplementSourceToggles
            metric={activeMetric}
            sources={supplementSources}
            active={activeSupplements}
            onChange={onSupplementsChange}
          />
        </div>
      )}
    </div>
  );

  const hasAnyControl =
    hasKortvisningControls || (showPhaseFilter && onPhasesChange);

  if (!hasAnyControl) return null;

  return (
    <>
      <div className={compact ? 'hidden' : 'hidden md:flex flex-wrap items-center gap-3'}>
        {desktopControls}
      </div>

      <div className={compact ? 'flex items-center gap-2 shrink-0' : 'md:hidden flex items-center gap-2 shrink-0'}>
        {showPhaseFilter && onPhasesChange && (
          <PhaseFilterPopover
            selected={selectedPhases}
            onChange={onPhasesChange}
            align="end"
            tooltipContent={phaseTooltipContent}
          />
        )}

        {hasKortvisningControls && (
          <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
            <PopoverTrigger asChild>
              <ControlBarTrigger aria-label="Kortvisning" active={hasCustomSettings}>
                <Eye className="w-3.5 h-3.5" strokeWidth={2.2} />
                Kortvisning
                {hasCustomSettings && (
                  <ControlBarCountBadge count={kortvisningActiveCount} />
                )}
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={2.4} />
              </ControlBarTrigger>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="z-[10000] w-[min(100vw-2rem,20rem)] p-3.5"
            >
              {mobileStackedControls}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </>
  );
}
