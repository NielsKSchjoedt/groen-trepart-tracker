import { X, Waves, Target, FlaskConical, MapPin, ExternalLink, Info } from 'lucide-react';
import { getWfdStatusColor, getWfdStatusLabel, formatDanishNumber } from '@/lib/format';
import type { CoastalWaterEntry, EcologicalStatus } from '@/lib/types';

interface CoastalWaterDetailPanelProps {
  name: string;
  entry: CoastalWaterEntry;
  onClose: () => void;
}

/** Small colored dot + label for an ecological status value. */
function StatusBadge({ status, size = 'md' }: { status: EcologicalStatus | string; size?: 'sm' | 'md' }) {
  const color = getWfdStatusColor(status);
  const dotSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 ${textSize}`}>
      <span className={`${dotSize} rounded-full shrink-0`} style={{ backgroundColor: color }} />
      <span className="font-medium text-foreground">{status}</span>
    </span>
  );
}

const SUB_INDICATOR_LABELS: Record<string, string> = {
  phytoplankton: 'Fytoplankton',
  angiosperms: 'Ålegræs',
  benthicFauna: 'Bundfauna',
  macroalgae: 'Makroalger',
  nationalSubstances: 'Nat. specifikke stoffer',
  oxygenConditions: 'Iltforhold',
  lightConditions: 'Lysforhold',
};

export function CoastalWaterDetailPanel({ name, entry, onClose }: CoastalWaterDetailPanelProps) {
  const ecoColor = getWfdStatusColor(entry.ecologicalStatus);

  // Count sub-indicators by status category
  const subValues = Object.values(entry.subIndicators) as EcologicalStatus[];
  const relevantSubs = subValues.filter((s) => s !== 'Ikke relevant' && s !== 'Ukendt');

  return (
    <div className="bg-background border-l border-border h-full overflow-y-auto p-6 relative">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
        aria-label="Luk"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Title */}
      <h2
        className="text-lg font-bold text-foreground pr-8 mb-1"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {name}
      </h2>
      <div className="flex items-center gap-2 mb-5">
        <span
          className="inline-flex items-center text-[11px] font-medium rounded-full px-2.5 py-0.5"
          style={{ color: '#1e40af', backgroundColor: '#1e40af15' }}
        >
          Kystvand
        </span>
        {entry.district && (
          <span className="text-[11px] text-muted-foreground">{entry.district}</span>
        )}
      </div>

      {/* Ecological status — main display */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Waves className="w-4 h-4" style={{ color: ecoColor }} />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Samlet økologisk tilstand
          </h3>
        </div>
        <div className="flex items-baseline gap-3 mb-2">
          <span
            className="text-2xl font-bold"
            style={{ fontFamily: "'Fraunces', serif", color: ecoColor }}
          >
            {entry.ecologicalStatus}
          </span>
        </div>
        {/* Goal comparison */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Target className="w-3.5 h-3.5" />
          <span>
            Mål: <span className="font-semibold" style={{ color: getWfdStatusColor(entry.ecologicalGoal) }}>{entry.ecologicalGoal}</span> tilstand
          </span>
          {entry.ecologicalStatus !== entry.ecologicalGoal && (
            <span className="text-[10px] text-red-500 font-medium">
              — Målet er ikke opfyldt
            </span>
          )}
          {entry.ecologicalStatus === entry.ecologicalGoal && (
            <span className="text-[10px] text-green-600 font-medium">
              ✓ Mål opfyldt
            </span>
          )}
        </div>
      </div>

      {/* Sub-indicators table */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2.5">
          <Info className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Biologiske kvalitetselementer
          </h3>
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          {Object.entries(entry.subIndicators).map(([key, status], i) => (
            <div
              key={key}
              className={`flex items-center justify-between px-3 py-2 ${
                i > 0 ? 'border-t border-border/50' : ''
              } ${status === 'Ikke relevant' || status === 'Ukendt' ? 'opacity-50' : ''}`}
            >
              <span className="text-[11px] text-muted-foreground">
                {SUB_INDICATOR_LABELS[key] || key}
              </span>
              <StatusBadge status={status} size="sm" />
            </div>
          ))}
        </div>
        {relevantSubs.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1.5 italic">
            Den samlede tilstand bestemmes af det dårligste kvalitetselement ("one out — all out")
          </p>
        )}
      </div>

      {/* Chemical status */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kemisk tilstand
          </h3>
        </div>
        <StatusBadge status={entry.chemicalStatus} />
      </div>

      {/* Metadata */}
      <div className="mb-5 p-3.5 rounded-lg bg-muted/40 border border-border/50">
        <div className="flex items-center gap-1.5 mb-2.5">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Oplysninger
          </span>
        </div>
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[11px]">
          <div>
            <span className="text-muted-foreground">Areal</span>
            <p className="font-medium text-foreground">{formatDanishNumber(entry.areaKm2, 1)} km²</p>
          </div>
          <div>
            <span className="text-muted-foreground">Vandtype</span>
            <p className="font-medium text-foreground">{entry.waterType || '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Hovedvandopland</span>
            <p className="font-medium text-foreground">{entry.mainCatchment || '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Vandområde-ID</span>
            <p className="font-medium text-foreground">{entry.ovId || '—'}</p>
          </div>
          {entry.natureStatus && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Naturligt / kunstigt / stærkt modificeret</span>
              <p className="font-medium text-foreground">{entry.natureStatus}</p>
            </div>
          )}
        </div>
      </div>

      {/* Data source */}
      <div className="pt-4 mt-4 border-t border-border">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Waves className="w-3 h-3" />
          <span>
            Data fra{' '}
            <a
              href="https://mst.dk/erhverv/tilskud-miljoeviden-og-data/data-og-databaser/miljoegis-data-om-natur-og-miljoe-paa-webkort"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30"
            >
              Miljøstyrelsen VP3 <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Vandområdeplanerne 2021–2027 (VP3) — EU Vandrammedirektivet
        </p>
      </div>
    </div>
  );
}
