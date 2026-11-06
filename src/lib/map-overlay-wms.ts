import L from 'leaflet';
import proj4 from 'proj4';
import 'proj4leaflet';

/** EPSG:25832 for WMS layers that reject Web Mercator (e.g. kulstofrige lavbund). */
const DEF_25832 = '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
proj4.defs('EPSG:25832', DEF_25832);
export const CRS_25832 = new L.Proj.CRS('EPSG:25832', DEF_25832);

export const MARKUDLEDNING_WMS = {
  base: 'https://arld-extgeo.miljoeportal.dk/geoserver/wms',
  layer: 'markudledningskort:Markudledning2025_SEGES',
} as const;

export const NATURPOTENTIALE_WMS = {
  base: 'https://mars.sgav.dk/geo/wms',
  layer: 'naturpotentialer',
} as const;

export const DRIKKEVAND_WMS = {
  base: 'https://wfs2-miljoegis.mim.dk/grukos/ows',
  layer: 'drikkevandsinteresser',
} as const;

export const KULSTOF_LAVBUND_WMS = {
  base: 'https://miljoegis3.mim.dk/wms?servicename=vandprojekter_wms',
  layer: 'theme-kulstofrige_lavbund_2022_kulstof2022_i0',
} as const;

/** One class in a server-styled WMS layer, as its GetLegendGraphic reports it. */
export interface WmsLegendClass {
  label: string;
  color: string;
}

/** Markudledningskortet's own seven classes (GetLegendGraphic, Nov 2026). */
export const MARKUDLEDNING_LEGEND: readonly WmsLegendClass[] = [
  { label: '< 50 %', color: '#239816' },
  { label: '50–75 %', color: '#20CC10' },
  { label: '75–100 %', color: '#00FA89' },
  { label: '100–125 %', color: '#01F2F2' },
  { label: '125–150 %', color: '#79C0FF' },
  { label: '150–200 %', color: '#3283ED' },
  { label: '> 200 %', color: '#0220E3' },
];

export const DRIKKEVAND_LEGEND: readonly WmsLegendClass[] = [
  { label: 'Særlige drikkevandsinteresser (OSD)', color: '#00C5FF' },
  { label: 'Drikkevandsinteresser (OD)', color: '#BEE8FF' },
];

export const KULSTOF_LAVBUND_LEGEND: readonly WmsLegendClass[] = [
  { label: '6–12 % tørv', color: '#e28330' },
  { label: 'Over 12 % tørv', color: '#af6320' },
];
