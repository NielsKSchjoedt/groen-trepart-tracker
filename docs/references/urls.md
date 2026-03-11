# Key URLs & Endpoints

## Primary Data Sources

### MARS Portal
- Portal: https://mars.sgav.dk
- Status (lavbund): https://mars.sgav.dk/status/lavbundsindsatsen
- Status (kvælstof): https://mars.sgav.dk/status/kvaelstofindsatsen
- App config: https://mars.sgav.dk/app-settings.json
- SGAV MARS page: https://sgav.dk/groen-trepart/lokale-treparter/mars
- User guide (PDF): https://sgav.dk/Media/638995678727481039/MARS%20-%20Vejledning.pdf
- Release notes: https://sgav.dk/groen-trepart/lokale-treparter/mars/opdateringer-til-mars
- Plan format & verification: https://sgav.dk/Media/638862809001703401/Bilag%208%20-%20Format%20for%20oml%C3%A6gningsplanen%20i%20MARS%20og%20verificering%20af%20oml%C3%A6gningsplanen%20ved%20SGAV.pdf

### MARS REST API (discovered March 2026 — public, no auth)
- Base: https://mars.sgav.dk/api
- Master data: https://mars.sgav.dk/api/master-data (subsidy schemes, project states, goals)
- Projects: https://mars.sgav.dk/api/status/projects (1,164 projects with status, areas, N-reduction)
- Catchments: https://mars.sgav.dk/api/status/vos (23 vandopland aggregations)
- Plans: https://mars.sgav.dk/api/status/plans (37 kystvandgrupper with targets + nested projects)
- Metadata: https://mars.sgav.dk/api/status/metadata (national goals + plan definitions)
- GeoProxy: https://mars.sgav.dk/api/geoproxy (requires auth session)
- GeoServer (direct): https://b0704-prod-intgeo-app.azurewebsites.net/geoserver/mars/ows (CORS blocked)

### MARS Auth (for protected endpoints)
- OAuth2 authority: https://log-in.miljoeportal.dk/runtime/oauth2
- Client ID: b0704-prod
- Login redirect: https://mars.sgav.dk/oidc_callback

### Danmarks Miljøportal
- Main: https://miljoeportal.dk/
- VanDa API: https://vandah.miljoeportal.dk/api
- Arealinformation: https://danmarksarealinformation.miljoeportal.dk/
- Arealdata catalogue: https://arealdata.miljoeportal.dk/
- Webservices guide: https://support.miljoeportal.dk/hc/da/articles/360001288398
- Getting started: https://support.miljoeportal.dk/hc/da/articles/360001038098
- EA-Tools API docs: https://support.miljoeportal.dk/hc/da/articles/26320234447645
- Naturdata: https://naturdata.miljoeportal.dk/

### MiljøGIS
- Main: https://miljoegis.mim.dk/
- WFS endpoint (vandprojekter): https://wfs2-miljoegis.mim.dk/vandprojekter/ows
- Data guide: https://mst.dk/erhverv/tilskud-miljoeviden-og-data/data-og-databaser/miljoegis-data-om-natur-og-miljoe-paa-webkort/hent-data-udstillet-paa-miljoegis
- VP3 files: https://files-miljoegis.mim.dk/

### Geographic Data
- DAWA API: https://api.dataforsyningen.dk/kommuner
- Dataforsyningen: https://dataforsyningen.dk/
- GeoDanmark / Datafordeler: https://datafordeler.dk/
- GeoDanmark guide: https://www.geodanmark.dk/home/vejledninger/datafordeleren/
- LandbrugsGIS: https://landbrugsgeodata.fvm.dk/
- Plandata.dk: https://www.plandata.dk/webservices
- VisPlan download: https://visplaner.plandata.dk/

### Water Plans & Status
- Vandplandata: https://vandplandata.dk/
- Miljøtilstand: https://miljotilstand.dk/
- WISE WFD (EU): https://water.europa.eu/

### Statistics
- Danmarks Statistik: https://statistikbanken.dk/

### Research & Reports
- DCE: https://dce.au.dk/
- NOVANA 2024 report (SR687): https://dce.au.dk/fileadmin/dce.au.dk/Udgivelser/Videnskabelige_rapporter_600-699/SR687.pdf
- NKMv2025: https://pure.au.dk/portal/da/publications/national-kv%C3%A6lstofmodel-version-2025-udvikling-af-nye-kv%C3%A6lstofrete/
- NKMv2025 appendix: https://data.geus.dk/pure-pdf/National_kv%C3%A6lstofmodel_2025_Bilagsrapport.pdf

## API Endpoint Templates

### WFS Request Pattern
```
GET {wfs_endpoint}?service=WFS&version=2.0.0&request=GetCapabilities
GET {wfs_endpoint}?service=WFS&version=2.0.0&request=GetFeature&typeName={layer}&outputFormat=application/json
GET {wfs_endpoint}?service=WFS&version=2.0.0&request=GetFeature&typeName={layer}&outputFormat=application/json&count=10
```

### DAWA Municipality Lookup
```
GET https://api.dataforsyningen.dk/kommuner
GET https://api.dataforsyningen.dk/kommuner/{kode}
GET https://api.dataforsyningen.dk/kommuner?q={name}
GET https://api.dataforsyningen.dk/kommuner/{kode}?format=geojson
```

### Danmarks Statistik API
```
GET https://api.statbank.dk/v1/subjects
GET https://api.statbank.dk/v1/tables?subjects={code}
GET https://api.statbank.dk/v1/tableinfo/{table_id}
POST https://api.statbank.dk/v1/data/{table_id}/CSV
```

## Political & Institutional
- SGAV: https://sgav.dk/
- Green Tripartite overview: https://sgav.dk/groen-trepart
- Local tripartites: https://sgav.dk/groen-trepart/lokale-treparter
- Miljøministeriet: https://mim.dk/
- Landbrugsstyrelsen: https://lbst.dk/
