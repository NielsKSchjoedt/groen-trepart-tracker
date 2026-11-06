# Geographic Data Sources

## DAGI — Administrative Boundaries (kommunegrænser)

**DAGI** (Danmarks Administrative Geografiske Inddeling) from Klimadatastyrelsen is the authoritative
source for all administrative boundaries.

**DAWA is shut down** (2026, every `api.dataforsyningen.dk` DAWA endpoint answers HTTP 410). The tracker
still writes the DAWA-era files (`data/dawa/kommuner.json`, `kommuner.geojson(.xz)`, same schema), but
`etl/fetch_dawa.py` now reads DAGI from live official sources and uses the committed archive (last DAWA
fetch 2026-09-11) only as fallback and reference:

| Order | Source | Layer | Access | Notes |
|---|---|---|---|---|
| 1 | Datafordeleren DAGI WFS (`wfs.datafordeler.dk`) | `dagi_v001:kommuneinddeling` | Free API key, env `DATAFORDELER_API_KEY` (HTTP 401 `DAF-AUTH-0005` without) | Canonical. URL/layer overridable with `DATAFORDELER_DAGI_WFS_URL` / `DATAFORDELER_DAGI_TYPENAME`; not yet tested with a real key |
| 2 | Plandata.dk GeoServer WFS (`geoserver.plandata.dk/geoserver/ows`) | `pdk:theme_pdk_kommuneplan_oversigt_vedtaget_v` | Open | Same DAGI geometry: 98 kommuner, identical vertex structure, every vertex within 0.5 mm of the archive. `komnr` is an integer (101 → "0101"). No Christiansø, region, bbox or visual centre |
| 3 | Committed archive `data/dawa/kommuner.geojson.xz` | — | — | Fallback when no live source answers (ETL status `partial`) |

How the merge works:

- Each live kommune is compared with the archive. Geometry is "unchanged" when the ring structure is the
  same and every vertex is within 1 cm. Unchanged kommuner keep the archive geometry and DAWA's own
  `bbox`/`visueltcenter`, so a normal run changes no committed file except `data/dawa/summary.json`.
- Only on a real boundary or name change are the archive, `kommuner.json` and the changed rows of
  `kommuner.csv` rewritten. `bbox` is then computed like DAWA (WGS84 envelope of the four UTM bbox corners;
  reproduces all 99 archived values to < 1e-6°) and `visueltcenter` as the pole of inaccessibility of the
  largest polygon (median 4 m from DAWA's value; DAWA deviates for a few multi-part kommuner, e.g. Hillerød).
- Region membership (`region`, `regionskode`) is static and always comes from the archive. Christiansø
  (0411, not a kommune but listed by DAWA) always comes from the archive unless the live source has it.
- A new kommune code (kommune reform) or a missing kommune rejects the live source; the archive is kept
  and the reason is logged in `summary.json` → `source_errors`.
- `data/dawa/summary.json` records `source`, `source_url`, `source_layer`, `verified_against_live_at` and
  `changed_kommuner` for every run.

## Dataforsyningen — Base Geographic Data

Token-based APIs for elevation models, cadastral data, administrative boundaries.
- URL: https://dataforsyningen.dk/
- Requires token registration (free)

## GeoDanmark — Detailed Topographic Data

High-quality geographic base data. Accessed through Datafordeleren:
- URL: https://datafordeler.dk/
- Includes: orthophotos, buildings, roads, elevation, water features
- Formats: WFS/WMS + file download
- Guide: https://www.geodanmark.dk/home/vejledninger/datafordeleren/

## LandbrugsGIS — Agricultural Data

Extensive agricultural GIS data from Landbrugsstyrelsen:
- URL: https://landbrugsgeodata.fvm.dk/
- Content: Field blocks (markblokke 2005–2026), land use, nitrogen retention, carbon-rich soil classifications
- Format: Free shapefile downloads
- Updated annually
- Extremely valuable for: overlay analysis with Kulstof2022, tracking land use changes

## Plandata.dk — Municipal Planning Data

Municipal plan data via standardized web services:
- URL: https://www.plandata.dk/webservices
- Services: WMS/WMTS/WFS — data pulled directly from Plandata database
- WFS provides vector features with attributes
- visplaner.plandata.dk: download local plans as CSV or GeoJSON per map area
- Use for: context layers (what applies in an area?), detecting municipal decision trails

## Vandplandata.dk — Water Area Plans

All planned interventions for WFD compliance:
- URL: https://vandplandata.dk/
- Content: Ecological/chemical status assessments for all water bodies
- VP3/VP3-II data: downloadable shapefiles from files-miljoegis.mim.dk
- Covers: 18,600 km designated watercourses, 7,500 km designated for restoration, 1,500 barrier removals

## Danmarks Statistik — Statistics

REST API for land accounts, emission inventories, environmental statistics:
- URL: https://statistikbanken.dk/
- Well-documented API, CSV/JSON output
- Useful for: baseline data, land use statistics per municipality, trend analysis

## WISE WFD Database (EU)

Denmark's Water Framework Directive reporting at EU level:
- URL: https://water.europa.eu/
- ArcGIS REST services
- CSV/GIS download
- Denmark country profiles with 20 environmental indicators

## Key coordinate systems

| System | EPSG | Use |
|--------|------|-----|
| ETRS89 / UTM zone 32N | 25832 | All Danish geodata (primary) |
| WGS84 | 4326 | Global/DAWA alternative output |
| Web Mercator | 3857 | Browser map rendering |
