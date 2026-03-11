# Danmarks Miljøportal & APIs

Central environmental data platform jointly owned by state, municipalities, and regions. Operates 30+ IT systems, 1,300+ map layers, 55 million species observations, 70 million water environment observations.

## Core sub-systems

### VanDa (Surface Water Data)
- Chemistry, biology, hydrology for surface water
- **REST API with Swagger docs**: `vandah.miljoeportal.dk/api`
- JSON data, historical time series
- Well-documented on GitHub
- High automation potential

### Naturdata / Naturdatabasen
- Nature registrations, species, habitats, §3-protected areas
- **NaturRestService** REST API
- Swagger/OpenAPI documentation available
- Can query species observations, habitat conditions

### EA-Tools API
- Automated spatial analysis
- Submit GeoJSON geometry → receive overlap report (flora, fauna, §3 nature)
- **Requires**: MitID Erhverv + specific system roles (e.g., `miljoe_eatools_write`)
- Extremely powerful for project impact assessment
- Docs: https://support.miljoeportal.dk/hc/da/articles/26320234447645-EA-Tools-API

### Kemidata
- Search/filter/download chemical measurements and environmental data
- Time series (water level, flow, etc.)
- Accessible through Miljøportal

### Jupiter (Groundwater)
- 418,000+ borings database
- Groundwater, drinking water, geology, geotechnics
- API under development by GEUS
- Database download available (full or partial)

## Authentication

- REST APIs: OpenID Connect (OAuth2) — recently replaced SAML2
- Data format: JSON API (RFC 7159)
- Geometries: GeoJSON (RFC 7946)
- Coordinate system: EPSG:25832

## MiljøGIS (Miljøstyrelsen)

Web map platform with thematic environmental layers. Data can be fetched via WFS/WMS URLs.

Key WFS endpoints:
- Vandprojekter: `wfs2-miljoegis.mim.dk/vandprojekter/ows` — climate-lowland projects, wetlands
- Natura 2000: via miljoegis.mim.dk
- Vandområdeplaner VP3/VP3-II: basisanalyser, miljømål, indsatser

**Important**: Some datasets are static (snapshot per plan period), not continuously updated.

### How to fetch WFS data

Standard OGC WFS request pattern:
```
GET {endpoint}?service=WFS&version=2.0.0&request=GetFeature&typeName={layer}&outputFormat=application/json
```

Guide: https://mst.dk/erhverv/tilskud-miljoeviden-og-data/data-og-databaser/miljoegis-data-om-natur-og-miljoe-paa-webkort/hent-data-udstillet-paa-miljoegis

## Danmarks Arealinformation

Web map with 1,100+ datasets. Report function: select an area → get all relevant environmental data.
- URL: https://danmarksarealinformation.miljoeportal.dk/

## Arealdata.dk

Full catalogue with 1,000+ area-related datasets (soil types, protected nature, land use).
- URL: https://arealdata.miljoeportal.dk/
- This is where you find WMS/WFS layer URLs for machine harvesting
- Example: `https://arealdata.miljoeportal.dk/datasets/urn:dmp:ds:projektomraader-klima-lavbund`

## Automation assessment

| System | Automation potential | Notes |
|--------|---------------------|-------|
| VanDa REST API | ✅ High | Well-documented, stable, JSON |
| EA-Tools API | ✅ High (with auth) | Requires MitID Erhverv roles |
| MiljøGIS WFS/WMS | ✅ High | Production-grade, stable for >10 years |
| Arealdata WFS | ✅ High | Standard OGC services |
| NaturRestService | ✅ High | Swagger docs available |
| Kemidata | ⚠️ Medium | Search/download platform |
| Jupiter | ⚠️ Medium | API under development |

## Key URLs

- Danmarks Miljøportal: https://miljoeportal.dk/
- Webservices guide: https://support.miljoeportal.dk/hc/da/articles/360001288398-Webservices-for-Danmarks-Milj%C3%B8portal
- Getting started with webservices: https://support.miljoeportal.dk/hc/da/articles/360001038098-Udvikling-Kom-godt-i-gang-med-webservices
- Edit service REST API docs: https://support.miljoeportal.dk/hc/da/articles/360010275138-Udvikling-Arealeditering-Editeringsservice-Information-om-Editservice-REST-API
- Naturdata: https://naturdata.miljoeportal.dk/
