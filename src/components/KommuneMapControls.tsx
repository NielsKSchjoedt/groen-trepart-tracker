import { AlertTriangle } from 'lucide-react';
import type { FordelingViewMode, NatureLayerKey } from '@/lib/kommune-map-visualization';
import { NATURE_LAYER_OPTIONS } from '@/lib/kommune-map-visualization';

interface SegmentedToggleProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

function SegmentedToggle<T extends string>({ label, value, options, onChange }: SegmentedToggleProps<T>) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1 rounded-full border border-border bg-card p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              value === option.value
                ? 'bg-emerald-900 text-white'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface KommuneFordelingViewToggleProps {
  value: FordelingViewMode;
  onChange: (value: FordelingViewMode) => void;
}

/** Pipeline vs. proportional distribution views for skov/lavbund on KommuneMap. */
export function KommuneFordelingViewToggle({ value, onChange }: KommuneFordelingViewToggleProps) {
  return (
    <SegmentedToggle
      label="Visning"
      value={value}
      onChange={onChange}
      options={[
        { value: 'actual', label: 'Faktisk realiseret' },
        { value: 'simulated', label: 'Fagligt forventet' },
        { value: 'difference', label: 'Forskel' },
      ]}
    />
  );
}

interface KommuneNatureLayerToggleProps {
  value: NatureLayerKey;
  onChange: (value: NatureLayerKey) => void;
}

/** Benchmark layer selector for beskyttet natur / biodiversitet on KommuneMap. */
export function KommuneNatureLayerToggle({ value, onChange }: KommuneNatureLayerToggleProps) {
  return (
    <SegmentedToggle
      label="Kortlag"
      value={value}
      onChange={onChange}
      options={NATURE_LAYER_OPTIONS.map((layer) => ({
        value: layer.id,
        label: layer.shortLabel,
      }))}
    />
  );
}

export function KommuneFordelingDisclaimer() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 leading-relaxed dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" strokeWidth={2} />
      <span>
        <strong>Fagligt forventet</strong> og <strong>Forskel</strong> er en simulering: en proportional
        fordeling af skov- og lavbundsmålene efter dokumenteret naturpotentiale (DCE 30 % + KU prio 1+2).
        Det er et diskussionsgrundlag — ikke en officiel kommune-fordeling.
      </span>
    </div>
  );
}

export function KommuneNatureLayerDisclaimer({ layer }: { layer: NatureLayerKey }) {
  const text = NATURE_LAYER_OPTIONS.find((option) => option.id === layer)?.label ?? 'Naturkortlag';
  return (
    <div className="flex items-start gap-2 rounded-lg border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950 leading-relaxed">
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-600" strokeWidth={2} />
      <span>
        Viser <strong>{text}</strong> fra Arealdata om biodiversitet, §3 og Natura 2000 — samme kortlag
        som på det nationale kort. MARS-naturprojekter er endnu ikke opgjort på kommuneniveau.
      </span>
    </div>
  );
}
