/// <reference types="vite/client" />

import 'leaflet';

declare module 'proj4leaflet';

declare namespace L {
  namespace Proj {
    class CRS extends L.CRS {
      constructor(code: string, def: string, options?: L.CRSOptions);
    }
  }
}
