/**
 * Arealdata WMS overlays (Miljøportal GeoServer) + id mapping for ?bio= URL state.
 * Keep in sync with etl WFS / AGENTS documentation.
 *
 * NOTE: The three former `transform:*` layers (Ny natur / CO₂ / Kvælstof) were
 * removed. They referenced a `transform:` namespace that this GeoServer does not
 * serve — they were placeholder names that never rendered. The TRANSFORM project's
 * five potential maps live in Miljøportalens "databutik" (via Synergikort /
 * Danmarks Arealinformation), not as anonymous WMS layers on this endpoint.
 * The nitrogen-potential map (markudledningskort) is wired separately under the
 * Kvælstof pillar — see MARKUDLEDNING_WMS in DenmarkMap.tsx.
 */
export const AREALDATA_WMS_BASE = 'https://arld-extgeo.miljoeportal.dk/geoserver/wms';

export const BIODIV_WMS_LAYERS = [
  {
    id: 'maalretning-30',
    label: 'Prioriterede naturarealer (30 %)',
    sublabel:
      'Arealer hvor naturindsatsen bør prioriteres for at nå målet om 30 % af Danmarks areal',
    source: 'Biodiversitetsrådet · Danmarks Miljøportal (Arealdata)',
    layer: 'biodiversitetsindsatsen:maalretning_af_biodiversitetsindsatsen',
    /** WMS fill #6b826f at 65 % opacity over white — matches perceived map colour. */
    legendColor: '#9faea1',
  },
] as const;

export type BiodivWmsId = (typeof BIODIV_WMS_LAYERS)[number]['id'];

export function parseBioParam(s: string | null): BiodivWmsId[] {
  if (!s) return [];
  return s
    .split(',')
    .map((x) => x.trim())
    .filter((x): x is BiodivWmsId => BIODIV_WMS_LAYERS.some((e) => e.id === x));
}

export function serializeBioParam(ids: readonly BiodivWmsId[]): string {
  return ids.join(',');
}

