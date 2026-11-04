/** Leaflet zoom limits shared across map components. */

/** National and kommune choropleth maps (Denmark overview). */
export const CHOROPLETH_MAP_MIN_ZOOM = 6;
export const CHOROPLETH_MAP_MAX_ZOOM = 14;

/** Auto-fit cap when zooming to a single municipality boundary. */
export const KOMMUNE_FOCUS_MAX_ZOOM = 13;

/** Basemap tiles — keep above map maxZoom; Leaflet upscales past the native zoom. */
export const BASEMAP_TILE_MAX_ZOOM = 20;

/**
 * Light grey basemap (Esri World Light Gray Canvas, no API key). Replaced CARTO
 * light_all/light_nolabels, which started returning "API key required" tiles.
 */
export const BASEMAP_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
export const BASEMAP_TILE_MAX_NATIVE_ZOOM = 16;
export const BASEMAP_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Single-project mini maps in lists and accordions. */
export const PROJECT_MINI_MAP_MAX_ZOOM = 19;
export const PROJECT_MINI_MAP_FIT_MAX_ZOOM = 17;

/** Full-screen project overlay on the national map. */
export const PROJECT_OVERLAY_MAX_ZOOM = 20;
export const PROJECT_OVERLAY_FIT_MAX_ZOOM = 18;
