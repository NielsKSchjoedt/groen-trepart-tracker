/**
 * Minimal typings for proj4leaflet, which ships none. Importing 'proj4leaflet'
 * attaches `L.Proj` to Leaflet; we only use `L.Proj.CRS`.
 */
import type { Bounds, CRS as LeafletCRS, PointTuple, Transformation } from 'leaflet';

declare module 'leaflet' {
  namespace Proj {
    interface CRSOptions {
      origin?: PointTuple;
      resolutions?: number[];
      scales?: number[];
      bounds?: Bounds;
      transformation?: Transformation;
    }

    type CRS = LeafletCRS;
    const CRS: new (code: string, proj4def: string, options?: CRSOptions) => LeafletCRS;
  }
}
