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
