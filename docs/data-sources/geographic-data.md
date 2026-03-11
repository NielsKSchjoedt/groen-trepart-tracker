# Geographic Data Sources

## DAGI / DAWA — Administrative Boundaries

**DAGI** (Danmarks Administrative Geografiske Inddeling) from Klimadatastyrelsen. The authoritative source for all administrative boundaries.

**DAWA REST API**: `api.dataforsyningen.dk/kommuner`
- Reverse geocoding: coordinate → municipality
- Formats: WFS, GeoJSON, JSON
- Also provides: WGS84/EPSG:4326 output
- Community-maintained GeoJSON on GitHub

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
