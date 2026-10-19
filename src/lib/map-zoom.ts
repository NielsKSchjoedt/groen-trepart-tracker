/** Leaflet zoom limits shared across map components. */

/** National and kommune choropleth maps (Denmark overview). */
export const CHOROPLETH_MAP_MIN_ZOOM = 6;
export const CHOROPLETH_MAP_MAX_ZOOM = 14;

/** Auto-fit cap when zooming to a single municipality boundary. */
export const KOMMUNE_FOCUS_MAX_ZOOM = 13;

/** Basemap tiles — Carto supports high zoom; keep above map maxZoom. */
export const BASEMAP_TILE_MAX_ZOOM = 20;

/** Single-project mini maps in lists and accordions. */
export const PROJECT_MINI_MAP_MAX_ZOOM = 19;
export const PROJECT_MINI_MAP_FIT_MAX_ZOOM = 17;

/** Full-screen project overlay on the national map. */
export const PROJECT_OVERLAY_MAX_ZOOM = 20;
export const PROJECT_OVERLAY_FIT_MAX_ZOOM = 18;
