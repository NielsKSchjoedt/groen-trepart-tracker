/**
 * Arealdata WMS overlays (Miljøportal GeoServer) + id mapping for ?bio= URL state.
 * Keep in sync with etl WFS / AGENTS documentation.
 */
export const AREALDATA_WMS_BASE = 'https://arld-extgeo.miljoeportal.dk/geoserver/wms';

export const BIODIV_WMS_LAYERS = [
  {
    id: 'maalretning-30',
    label: 'Målretning 30 %',
    sublabel: 'Biodiversitetsrådet (prioriteret indsats)',
    layer: 'biodiversitetsindsatsen:maalretning_af_biodiversitetsindsatsen',
  },
  {
    id: 'transform-ny-natur',
    label: 'TRANSFORM — Ny natur',
    sublabel: 'Potentialekort',
    layer: 'transform:transform_ny_natur',
  },
  {
    id: 'transform-co2',
    label: 'TRANSFORM — CO\u2082',
    sublabel: 'Kulstof i vegetation og jord',
    layer: 'transform:transform_co2',
  },
  {
    id: 'transform-n',
    label: 'TRANSFORM — Kvælstof',
    sublabel: 'N-reduktion i landskabet',
    layer: 'transform:transform_n',
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
