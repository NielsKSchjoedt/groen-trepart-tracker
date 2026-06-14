import type {
  KommuneBenchmarkData,
  KommuneMetrics,
  KommuneRankingData,
  NationalFordelingRow,
  NationalFordelingSimulation,
} from '@/lib/types';
import type { KommuneMetric } from '@/lib/kommune-metrics';
import { formatDanishNumber } from '@/lib/format';

export type FordelingViewMode = 'actual' | 'simulated' | 'difference';

/** Choropleth value scale for skov/lavbund in faktisk visning. */
export type ChoroplethScaleMode = 'absolute' | 'ansvar';

export type NatureLayerKey = 'b4-beskyttet' | 'b1-potentiale' | 'b2-marker' | 'b3-landbrug';

export const NATURE_LAYER_OPTIONS: {
  id: NatureLayerKey;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'b4-beskyttet', label: 'Beskyttet natur-status (B4)', shortLabel: 'B4 beskyttelse' },
  { id: 'b1-potentiale', label: 'Naturpotentiale (DCE 30 %)', shortLabel: 'DCE 30 %' },
  { id: 'b2-marker', label: 'Højt naturpotentiale — marker (B2)', shortLabel: 'Højt pot.' },
  { id: 'b3-landbrug', label: 'N2000 der er landbrug (B3)', shortLabel: 'B3 N2000' },
];

export interface KommuneMapVisualContext {
  activeMetric: KommuneMetric;
  fordelingViewMode: FordelingViewMode;
  natureLayer: NatureLayerKey;
  choroplethScale: ChoroplethScaleMode;
  fordelingSimulation?: NationalFordelingSimulation | null;
  kommuneBenchmark?: KommuneBenchmarkData | null;
  kommuneRanking?: KommuneRankingData | null;
  /** Precomputed ansvar indices keyed by kommune kode (skov/lavbund only). */
  ansvarIndexByKode?: Record<string, number | null>;
}

export interface ResolvedKommuneMapValue {
  value: number;
  label: string;
  usesDifferenceScale: boolean;
  usesSimulationScale: boolean;
  usesAnsvarScale: boolean;
}

export function showFordelingViewToggle(metric: KommuneMetric | null): boolean {
  return metric === 'extraction' || metric === 'afforestation';
}

export function showNatureLayerToggle(metric: KommuneMetric | null): boolean {
  return metric === 'nature';
}

export function showChoroplethScaleToggle(
  metric: KommuneMetric | null,
  fordelingViewMode: FordelingViewMode,
): boolean {
  return (
    metric !== null
    && (metric === 'extraction' || metric === 'afforestation')
    && fordelingViewMode === 'actual'
  );
}

/**
 * Compute delivery-vs-ansvar index for each kommune (same formula as ranglisten).
 * Uses the phase-filtered ha totals already applied in `kommuner`.
 */
export function computeAnsvarIndices(
  kommuner: Pick<KommuneMetrics, 'kode' | 'extractionHa' | 'afforestationTotalHa'>[],
  metric: 'extraction' | 'afforestation',
  ranking: KommuneRankingData | null | undefined,
): Record<string, number | null> {
  if (!ranking) return {};

  const natTotal = kommuner.reduce(
    (sum, km) => sum + (metric === 'extraction' ? km.extractionHa : km.afforestationTotalHa),
    0,
  );
  if (natTotal <= 0) return {};

  const out: Record<string, number | null> = {};
  for (const km of kommuner) {
    const row = ranking.byKommune[km.kode];
    const ansvar = row?.ansvarPct ?? 0;
    const delivery = metric === 'extraction' ? km.extractionHa : km.afforestationTotalHa;
    if (ansvar <= 0 || delivery <= 0) {
      out[km.kode] = null;
      continue;
    }
    const leveringPct = (delivery / natTotal) * 100;
    out[km.kode] = Math.round((leveringPct / ansvar) * 1000) / 1000;
  }
  return out;
}

export function usesSimulationChoropleth(
  metric: KommuneMetric,
  viewMode: FordelingViewMode,
): boolean {
  return (metric === 'extraction' || metric === 'afforestation') && viewMode !== 'actual';
}

function getFordelingRow(
  simulation: NationalFordelingSimulation | null | undefined,
  kode: string,
): NationalFordelingRow | undefined {
  return simulation?.byKommune[kode];
}

function getFordelingValue(
  row: NationalFordelingRow,
  viewMode: FordelingViewMode,
  target: 'skov' | 'lavbund',
): number {
  if (target === 'skov') {
    if (viewMode === 'actual') return row.actualSkovHa;
    if (viewMode === 'simulated') return row.simulatedSkovHa;
    return row.skovDifferenceHa;
  }
  if (viewMode === 'actual') return row.actualLavbundHa;
  if (viewMode === 'simulated') return row.simulatedLavbundHa;
  return row.lavbundDifferenceHa;
}

function getNatureValue(
  benchmark: KommuneBenchmarkData | null | undefined,
  kode: string,
  layer: NatureLayerKey,
): { value: number; label: string } {
  switch (layer) {
    case 'b4-beskyttet': {
      const row = benchmark?.b4?.byKommune[kode];
      const pct = row?.pctVaerdiBeskyttet ?? 0;
      return {
        value: pct,
        label: pct > 0
          ? `${formatDanishNumber(Math.round(pct * 10) / 10)} % af naturværdi med §3-/N2000-status`
          : 'Ingen kortlagt naturværdi',
      };
    }
    case 'b1-potentiale': {
      const row = benchmark?.b1.byKommune[kode];
      const ha = row?.dce30Ha ?? 0;
      return {
        value: ha,
        label: ha > 0
          ? `${formatDanishNumber(Math.round(ha))} ha DCE 30 % naturpotentiale`
          : 'Ingen DCE 30 %-areal',
      };
    }
    case 'b2-marker': {
      const row = benchmark?.b2.byKommune[kode];
      const pct = row?.hoejtPotentialePct ?? 0;
      return {
        value: pct,
        label: pct > 0
          ? `${formatDanishNumber(Math.round(pct * 10) / 10)} % marker med højt naturpotentiale`
          : 'Ingen marker i naturpotentiale',
      };
    }
    case 'b3-landbrug': {
      const row = benchmark?.b3.byKommune[kode];
      const pct = row?.andelLandbrugIN2000Pct ?? 0;
      return {
        value: pct,
        label: pct > 0
          ? `${formatDanishNumber(Math.round(pct * 10) / 10)} % af N2000 er landbrugsjord`
          : 'Ingen N2000-areal eller ingen landbrugsandel',
      };
    }
  }
}

function getPipelineValue(km: KommuneMetrics, metric: KommuneMetric): number {
  switch (metric) {
    case 'nitrogen': return km.nitrogenT;
    case 'extraction': return km.extractionHa;
    case 'afforestation': return km.afforestationTotalHa;
    case 'nature': return km.naturePotentialHa;
    case 'co2': return km.co2EstimatedT ?? 0;
  }
}

const PIPELINE_LABELS: Record<KommuneMetric, string> = {
  nitrogen: 'ton N reduceret',
  extraction: 'ha lavbund',
  afforestation: 'ha skovrejsning',
  nature: 'ha beskyttet natur (§3 + Natura 2000)',
  co2: 'ton CO₂e (samlet udledning 2023)',
};

/**
 * Resolve choropleth value + tooltip label for one municipality on KommuneMap.
 */
export function resolveKommuneMapValue(
  kode: string,
  km: KommuneMetrics | undefined,
  ctx: KommuneMapVisualContext,
): ResolvedKommuneMapValue {
  if (ctx.activeMetric === 'nature') {
    const { value, label } = getNatureValue(ctx.kommuneBenchmark, kode, ctx.natureLayer);
    return { value, label, usesDifferenceScale: false, usesSimulationScale: false, usesAnsvarScale: false };
  }

  if (usesSimulationChoropleth(ctx.activeMetric, ctx.fordelingViewMode)) {
    const row = getFordelingRow(ctx.fordelingSimulation, kode);
    const target = ctx.activeMetric === 'afforestation' ? 'skov' : 'lavbund';
    const value = row ? getFordelingValue(row, ctx.fordelingViewMode, target) : 0;
    const targetLabel = target === 'skov' ? 'skovmålet' : 'lavbundsmålet';
    const modeLabel = ctx.fordelingViewMode === 'simulated'
      ? 'fagligt forventet andel'
      : 'forskel (forventet − faktisk)';
    return {
      value,
      label: `${formatDanishNumber(Math.round(value))} ha ${targetLabel} (${modeLabel})`,
      usesDifferenceScale: ctx.fordelingViewMode === 'difference',
      usesSimulationScale: ctx.fordelingViewMode === 'simulated',
      usesAnsvarScale: false,
    };
  }

  if (
    ctx.choroplethScale === 'ansvar'
    && (ctx.activeMetric === 'extraction' || ctx.activeMetric === 'afforestation')
  ) {
    const idx = ctx.ansvarIndexByKode?.[kode] ?? null;
    const metricLabel = ctx.activeMetric === 'afforestation' ? 'skovrejsning' : 'lavbund';
    return {
      value: idx ?? 0,
      label: idx != null && idx > 0
        ? `${formatDanishNumber(Math.round(idx * 10) / 10)}× ${metricLabel} ift. ansvar`
        : 'Ingen levering eller ingen ansvarsbasis',
      usesDifferenceScale: false,
      usesSimulationScale: false,
      usesAnsvarScale: true,
    };
  }

  const value = km ? getPipelineValue(km, ctx.activeMetric) : 0;
  const unit = PIPELINE_LABELS[ctx.activeMetric];
  return {
    value,
    label: value > 0
      ? `${formatDanishNumber(Math.round(value * 10) / 10)} ${unit}`
      : 'Ingen data',
    usesDifferenceScale: false,
    usesSimulationScale: false,
    usesAnsvarScale: false,
  };
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function rgb(values: [number, number, number]): string {
  return `rgb(${values[0]} ${values[1]} ${values[2]})`;
}

function lerpHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

const METRIC_COLOR_STOPS: Record<KommuneMetric, string[]> = {
  nitrogen: ['#ccfbf1', '#5eead4', '#0d9488', '#134e4a'],
  extraction: ['#fef3c7', '#fcd34d', '#a16207', '#78350f'],
  afforestation: ['#dcfce7', '#86efac', '#15803d', '#14532d'],
  nature: ['#f0fdf4', '#86efac', '#16a34a', '#052e16'],
  co2: ['#f1f5f9', '#94a3b8', '#475569', '#1e293b'],
};

const NO_DATA_COLOR = 'hsl(0 0% 92%)';

export function simulationSequentialColor(value: number, max: number): string {
  if (value <= 0) return NO_DATA_COLOR;
  const t = Math.min(value / max, 1);
  return rgb([lerp(220, 6, t), lerp(252, 95, t), lerp(231, 70, t)]);
}

export function simulationDifferenceColor(value: number, maxAbs: number): string {
  if (Math.abs(value) < 1) return 'hsl(0 0% 88%)';
  const t = Math.min(Math.abs(value) / maxAbs, 1);
  if (value > 0) return rgb([lerp(254, 180, t), lerp(226, 83, t), lerp(226, 9, t)]);
  return rgb([lerp(219, 30, t), lerp(234, 64, t), lerp(254, 175, t)]);
}

export function metricSequentialColor(
  value: number,
  maxVal: number,
  metric: KommuneMetric,
): string {
  if (value <= 0 || maxVal <= 0) return NO_DATA_COLOR;
  const t = Math.min(value / maxVal, 1);
  const stops = METRIC_COLOR_STOPS[metric];
  const seg = (stops.length - 1) * t;
  const idx = Math.min(Math.floor(seg), stops.length - 2);
  return lerpHex(stops[idx], stops[idx + 1], seg - idx);
}

/** Fixed threshold colours for ansvar index — matches ranglisten semantics and legend. */
export function ansvarIndexColor(
  index: number,
  metric: 'extraction' | 'afforestation',
): string {
  if (index <= 0) return NO_DATA_COLOR;
  const stops = METRIC_COLOR_STOPS[metric];
  if (index > 1.5) return stops[3];
  if (index > 1.15) return stops[2];
  if (index >= 0.85) return stops[1];
  return stops[0];
}

export function resolveKommuneMapColor(
  value: number,
  maxVal: number,
  maxAbs: number,
  metric: KommuneMetric,
  resolved: Pick<ResolvedKommuneMapValue, 'usesDifferenceScale' | 'usesSimulationScale' | 'usesAnsvarScale'>,
): string {
  if (resolved.usesDifferenceScale) return simulationDifferenceColor(value, maxAbs);
  if (resolved.usesSimulationScale) return simulationSequentialColor(value, maxVal);
  if (resolved.usesAnsvarScale && (metric === 'extraction' || metric === 'afforestation')) {
    return ansvarIndexColor(value, metric);
  }
  return metricSequentialColor(value, maxVal, metric);
}

export type LegendStop = { color: string; label: string };

export function getKommuneMapLegendStops(ctx: KommuneMapVisualContext): LegendStop[] {
  if (ctx.activeMetric === 'nature') {
    switch (ctx.natureLayer) {
      case 'b4-beskyttet':
        return [
          { color: '#052e16', label: 'Høj andel med §3-/N2000-status' },
          { color: '#16a34a', label: 'Middel' },
          { color: '#f0fdf4', label: 'Lav' },
          { color: NO_DATA_COLOR, label: 'Ingen kortlagt naturværdi' },
        ];
      case 'b1-potentiale':
        return [
          { color: '#052e16', label: 'Stort DCE 30 %-potentiale' },
          { color: '#16a34a', label: 'Middel' },
          { color: '#f0fdf4', label: 'Lavt' },
          { color: NO_DATA_COLOR, label: 'Ingen data' },
        ];
      case 'b2-marker':
        return [
          { color: '#052e16', label: 'Mange marker med højt potentiale' },
          { color: '#16a34a', label: 'Middel' },
          { color: '#f0fdf4', label: 'Få' },
          { color: NO_DATA_COLOR, label: 'Ingen data' },
        ];
      case 'b3-landbrug':
        return [
          { color: '#78350f', label: 'Høj andel N2000 på landbrug' },
          { color: '#fcd34d', label: 'Middel' },
          { color: '#fef3c7', label: 'Lav' },
          { color: NO_DATA_COLOR, label: 'Ingen N2000 / ingen landbrug' },
        ];
    }
  }

  if (usesSimulationChoropleth(ctx.activeMetric, ctx.fordelingViewMode)) {
    const target = ctx.activeMetric === 'afforestation' ? 'skov' : 'lavbund';
    if (ctx.fordelingViewMode === 'difference') {
      return [
        { color: 'rgb(30 64 175)', label: 'Under forventet andel' },
        { color: 'rgb(229 231 235)', label: 'Tæt på forventet' },
        { color: 'rgb(180 83 9)', label: 'Over forventet andel' },
      ];
    }
    return [
      { color: 'rgb(6 95 70)', label: `Høj ${target === 'skov' ? 'skov' : 'lavbund'}-andel` },
      { color: 'rgb(134 239 172)', label: 'Middel' },
      { color: 'rgb(229 231 235)', label: 'Lav' },
    ];
  }

  if (
    ctx.choroplethScale === 'ansvar'
    && (ctx.activeMetric === 'extraction' || ctx.activeMetric === 'afforestation')
  ) {
    const stops = ctx.activeMetric === 'afforestation'
      ? METRIC_COLOR_STOPS.afforestation
      : METRIC_COLOR_STOPS.extraction;
    return [
      { color: stops[3], label: 'Meget over forventet (>1,5×)' },
      { color: stops[2], label: 'Over forventet' },
      { color: stops[1], label: 'Om forventet (~1×)' },
      { color: stops[0], label: 'Under forventet' },
      { color: NO_DATA_COLOR, label: 'Ingen levering' },
    ];
  }

  const defaults: Record<KommuneMetric, LegendStop[]> = {
    nitrogen: [
      { color: '#0d9488', label: 'Høj kvælstofreduktion' },
      { color: '#5eead4', label: 'Middel' },
      { color: '#ccfbf1', label: 'Lav' },
      { color: NO_DATA_COLOR, label: 'Ingen data' },
    ],
    extraction: [
      { color: '#a16207', label: 'Høj lavbund' },
      { color: '#fcd34d', label: 'Middel' },
      { color: '#fef3c7', label: 'Lav' },
      { color: NO_DATA_COLOR, label: 'Ingen data' },
    ],
    afforestation: [
      { color: '#15803d', label: 'Høj skovrejsning' },
      { color: '#86efac', label: 'Middel' },
      { color: '#dcfce7', label: 'Lav' },
      { color: NO_DATA_COLOR, label: 'Ingen data' },
    ],
    nature: [],
    co2: [
      { color: '#b91c1c', label: 'Høj udledning (> 2M ton CO₂e)' },
      { color: '#f97316', label: 'Middel' },
      { color: '#fde68a', label: 'Lav' },
      { color: NO_DATA_COLOR, label: 'Ingen data' },
    ],
  };

  return defaults[ctx.activeMetric];
}

/** Title for the floating choropleth legend on KommuneMap. */
export function getKommuneMapLegendLabel(ctx: KommuneMapVisualContext): string {
  if (ctx.activeMetric === 'nature') {
    const layer = NATURE_LAYER_OPTIONS.find((option) => option.id === ctx.natureLayer);
    return layer?.label ?? 'Beskyttet natur';
  }

  if (usesSimulationChoropleth(ctx.activeMetric, ctx.fordelingViewMode)) {
    const target = ctx.activeMetric === 'afforestation' ? 'skov' : 'lavbund';
    if (ctx.fordelingViewMode === 'difference') {
      return `Forskel i ${target === 'skov' ? 'skov' : 'lavbund'}-andel (forventet − faktisk)`;
    }
    return `Fagligt forventet ${target === 'skov' ? 'skov' : 'lavbund'}-andel`;
  }

  if (
    ctx.choroplethScale === 'ansvar'
    && (ctx.activeMetric === 'extraction' || ctx.activeMetric === 'afforestation')
  ) {
    return ctx.activeMetric === 'afforestation'
      ? 'Skovrejsning — ift. ansvar (×)'
      : 'Lavbund — ift. ansvar (×)';
  }

  const labels: Record<KommuneMetric, string> = {
    nitrogen: 'Kvælstof — reduceret (ton N)',
    extraction: 'Lavbund (ha)',
    afforestation: 'Skovrejsning (ha)',
    nature: 'Beskyttet natur',
    co2: 'CO₂-udledning 2023 (ton CO₂e)',
  };
  return labels[ctx.activeMetric];
}
