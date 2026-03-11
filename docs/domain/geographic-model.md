# Geographic Model

The tracker must handle four overlapping geographic levels, connected by spatial operations (spatial joins/intersections).

## Level 1: 23 Main Catchments = 23 Local Tripartites

The primary planning geography. Each of the 23 local tripartites corresponds to a main river basin (hovedvandopland). These are the legally responsible planning units.

- **Source**: Vandområdeplaner GIS data (shapefiles from files-miljoegis.mim.dk)
- **Also**: SGAV/KL published maps specifying area distribution and lead municipalities
- **MARS organizes around these**: project tracking, planning, verification

## Level 2: 37 Hydrological Coastal Water Groups

The unit for measuring nitrogen targets. VP3-II distributes targets across 108 sub-catchments grouped into 37 coastal water groups. MARS calculates effect at this level.

- **Source**: MiljøGIS Vandprojekter, Vandplandata.dk
- **Critical for**: Nitrogen reduction tracking, burndown charts

## Level 3: 98 Municipalities

The implementers. Municipalities serve as project owners, register in MARS, and principle-adopt transformation plans.

- **Source**: DAGI (Danmarks Administrative Geografiske Inddeling) via DAWA REST API
- **API**: `api.dataforsyningen.dk/kommuner` — supports reverse geocoding
- **Format**: WFS, GeoJSON, also community-maintained GeoJSON on GitHub
- **Use**: Choropleth maps showing per-municipality progress

## Level 4: Project Areas & Parcels

The most granular level — individual project polygons, stream segments, barrier points.

- **Source**: MiljøGIS Vandprojekter (WFS), MARS (export), Arealdata
- **Includes**: Exact polygons for completed climate-lowland projects, stream stretches designated for restoration, barrier locations
- **Also**: Matrikelkort (cadastral) for property-level linkage, Markblokke for field-level linkage

## Coordinate systems

- **All major Danish geodata**: EPSG:25832 (ETRS89 / UTM zone 32N)
- **DAWA also provides**: WGS84/EPSG:4326
- **Web rendering**: Transform to EPSG:3857 (Web Mercator) for browser map libraries
- **GeoJSON standard**: RFC 7946

## Key spatial datasets

| Dataset | Type | Source | Access |
|---------|------|--------|--------|
| Kommune boundaries | Polygon | DAGI/DAWA | REST API, WFS, GeoJSON |
| Region boundaries | Polygon | DAGI/DAWA | REST API, WFS |
| Hovedvandoplande (23 catchments) | Polygon | Vandplandata/MiljøGIS | Shapefile download, WFS |
| Sub-catchments (delopland) | Polygon | Vandplandata/MiljøGIS | Shapefile download, WFS |
| Coastal water group boundaries | Polygon | MiljøGIS VP3 | WFS |
| Kulstof2022 carbon soil map | Raster 10×10m | Aarhus Univ/MiljøGIS | WMS/WFS via Arealdata |
| Project areas (klima-lavbund) | Polygon | Miljøstyrelsen/DMP | WFS: `wfs2-miljoegis.mim.dk/vandprojekter/ows` |
| §3 protected nature | Polygon | Danmarks Arealinformation | WFS/WMS |
| Natura 2000 areas | Polygon | MiljøGIS | WFS/WMS/Shapefile |
| Markblokke (field blocks) | Polygon | LandbrugsGIS | Shapefile download (annual) |
| Stream network (18,600 km) | Line | MiljøGIS VP3 | WFS/Shapefile |
| Barrier locations | Point | MiljøGIS/Vandplandata | WFS |

## Mapping technology options

All open-source, compatible with WFS/WMS and GeoJSON:
- **Leaflet.js** — lightweight, good for simple interactive maps
- **OpenLayers** — full-featured, excellent WFS/WMS support
- **Mapbox GL JS** — vector tiles, high performance
- **deck.gl** — large dataset visualization

## Spatial operations needed

1. **Spatial join**: Assign any project polygon to its municipality + catchment + coastal water group
2. **Overlay analysis**: What % of a municipality lies in a "red" (overloaded) catchment?
3. **Area calculation**: Sum hectares by status per geographic unit
4. **Buffer analysis**: Identify projects near protected areas (using EA-Tools API or PostGIS)
