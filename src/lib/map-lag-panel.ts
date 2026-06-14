import type { LayerGroup } from '@/components/MapLayersPanel';
import type { PillarId } from '@/lib/pillars';
import type { NationalOverlayToken } from '@/lib/permalink/types';
import { BIODIV_WMS_LAYERS, type BiodivWmsId } from '@/lib/biodiv-map';
import { SECTION3_COLOR } from '@/lib/supplement-colors';
import { overlaysToBooleans } from '@/lib/permalink/useNationalMapPermalink';

export interface MapLagPanelOptions {
  /** Active delmål; null on pages without a pillar context. */
  pillarId: PillarId | null;
  /** CO₂ and other stub maps show no Lag rows. */
  isStub: boolean;
  /** Kystvande row only when water-body GeoJSON is loaded. */
  hasWaterBodiesGeo: boolean;
  overlays: Set<NationalOverlayToken>;
  onToggle: (token: NationalOverlayToken, on: boolean) => void;
}

/**
 * Shared «Lag» panel rows for national and kommune maps — mirrors DenmarkMap
 * layerGroups (WMS/GeoJSON overlays only; not MARS/KSF/NST project toggles).
 */
export function buildMapLagLayerGroups({
  pillarId,
  isStub,
  hasWaterBodiesGeo,
  overlays,
  onToggle,
}: MapLagPanelOptions): LayerGroup[] {
  if (isStub || !pillarId) return [];

  const flags = overlaysToBooleans(overlays);
  const bioActive: BiodivWmsId[] = flags.bioActive ? ['maalretning-30'] : [];

  const groups: LayerGroup[] = [];

  const vandmiljoeRows: LayerGroup['rows'] = [];
  if (hasWaterBodiesGeo) {
    vandmiljoeRows.push({
      id: 'kystvande',
      label: 'Kystvande',
      sublabel: 'Hvordan kystvandene klarer sig økologisk — fra god til dårlig tilstand',
      source: 'Miljøstyrelsen (vandplaner)',
      color: '#4a90b8',
      checked: flags.showWaterBodies,
      onChange: (v) => onToggle('vandlegemer', v),
    });
  }
  if (pillarId === 'nitrogen') {
    vandmiljoeRows.push({
      id: 'markudledning',
      label: 'Markudledning',
      sublabel: 'Hvor meget kvælstof marken bidrager til kystvandene',
      source: 'SEGES · Danmarks Miljøportal',
      color: '#b5832a',
      checked: flags.showMarkudledning,
      onChange: (v) => onToggle('markudledning', v),
    });
    vandmiljoeRows.push({
      id: 'drikkevand',
      label: 'Drikkevandsinteresser',
      sublabel: 'Områder med (særlige) drikkevandsinteresser, OD/OSD (Miljøstyrelsen)',
      source: 'Miljøstyrelsen · Danmarks Miljøportal',
      color: '#2563eb',
      swatchVariant: 'area',
      checked: flags.showDrikkevand,
      onChange: (v) => onToggle('drikkevand', v),
    });
  }
  if (vandmiljoeRows.length) groups.push({ title: 'Vandmiljø', rows: vandmiljoeRows });

  if (pillarId === 'extraction') {
    groups.push({
      title: 'Klima / kulstof',
      rows: [
        {
          id: 'kulstof-lavbund',
          label: 'Kulstofrige lavbundsjorder',
          sublabel: 'Organogene jorder 6-12 % / >12 % kulstof (DCA 2024)',
          source: 'DCA 2024 · Danmarks Miljøportal',
          color: '#7c4a1e',
          swatchVariant: 'area',
          checked: flags.showKulstof,
          onChange: (v) => onToggle('kulstof', v),
        },
      ],
    });
  }

  const biodivRows: LayerGroup['rows'] = BIODIV_WMS_LAYERS.map((b) => ({
    id: `bio-${b.id}`,
    label: b.label,
    sublabel: b.sublabel,
    source: b.source,
    color: b.legendColor,
    swatchVariant: 'area' as const,
    checked: bioActive.includes(b.id as BiodivWmsId),
    onChange: () => onToggle('biodiv', !flags.bioActive),
  }));
  biodivRows.push({
    id: 'vns',
    label: 'Vand, natur & skov 2026',
    sublabel:
      'Arealer udpeget til vådområder, naturgenopretning og skov under statens omlægningsordning',
    source: 'FVM · Markkort 2026',
    color: '#22c55e',
    swatchVariant: 'area',
    checked: flags.vnsOn,
    onChange: (v) => onToggle('vns', v),
  });
  groups.push({ title: 'Biodiversitet', rows: biodivRows });

  if (pillarId === 'nature') {
    groups.push({
      title: 'Trepart-udpegninger',
      rows: [
        {
          id: 'naturpotentialer',
          label: 'Naturpotentialer',
          sublabel: 'Hvor de lokale treparter ser mulighed for at skabe ny natur',
          source: 'MARS · lokale treparter',
          color: '#5b8a72',
          swatchVariant: 'area',
          checked: flags.showNaturpotentiale,
          onChange: (v) => onToggle('naturpotentialer', v),
        },
      ],
    });

    groups.push({
      title: 'Beskyttet natur i dag',
      rows: [
        {
          id: 'section3',
          label: '§3-beskyttet natur',
          sublabel: 'Beskyttede naturtyper under Naturbeskyttelsesloven (>= 50 ha på kortet)',
          source: 'MiljøGIS WFS · lokal forenklet GeoJSON',
          color: SECTION3_COLOR.stroke,
          swatchVariant: 'area',
          checked: flags.showSection3,
          onChange: (v) => onToggle('section3', v),
        },
        {
          id: 'natura2000',
          label: 'Natura 2000 (habitatområder)',
          sublabel: 'EU-udpegede habitatområder',
          source: 'MiljøGIS WFS · lokal forenklet GeoJSON',
          color: '#1d4ed8',
          swatchVariant: 'area',
          checked: flags.showNatura2000,
          onChange: (v) => onToggle('natura2000', v),
        },
      ],
    });
  }

  return groups;
}
