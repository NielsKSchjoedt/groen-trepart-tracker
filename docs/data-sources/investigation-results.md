# Data Source Investigation Results

**Date**: March 10, 2026
**Method**: Web search, API documentation review, GitHub repository analysis, **live browser DevTools investigation**

---

## Source 1: MARS REST API (CRITICAL — BREAKTHROUGH)

**Base URL**: `https://mars.sgav.dk/api`
**Status Module**: `https://mars.sgav.dk/status/lavbundsindsatsen`

### 🎯 Major Discovery: MARS Has a Public REST API

Browser DevTools investigation revealed that the MARS SPA loads data from a **fully public, unauthenticated REST API**. This was discovered by capturing network requests while navigating the status module.

### Discovered Endpoints

| Endpoint | Method | Auth | Returns |
|----------|--------|------|---------|
| `/api/master-data` | GET | None | Subsidy schemes, project states, mitigation measures, national goals |
| `/api/status/projects` | GET | None | **1,164 projects** with names, status, areas, nitrogen reduction, timestamps |
| `/api/status/vos` | GET | None | **23 vandopland** (main catchments) with aggregated project counts & metrics |
| `/api/status/plans` | GET | None | **37 kystvandgrupper** (coastal water groups) with N-reduction goals, extraction potentials, nested projects |
| `/api/status/metadata` | GET | None | National goals + 37 plan definitions with geo location IDs |
| `/api/geoproxy` | GET | Likely auth | Proxy to MARS GeoServer (returns 200 but "Web App Unavailable" without session) |
| `/api/user/track` | POST | None | Analytics/tracking endpoint |
| `/api/projects` | POST | **Auth required** | Project creation/management (returns 405 on GET, Allow: POST) |
| `/app-settings.json` | GET | None | Full application configuration including OAuth2, GeoServer, dataset URNs |

### app-settings.json — Full Application Configuration

```json
{
  "identity": {
    "authority": "https://log-in.miljoeportal.dk/runtime/oauth2",
    "clientId": "b0704-prod",
    "loginRedirectUrl": "https://mars.sgav.dk/oidc_callback"
  },
  "connection": {
    "api": "https://mars.sgav.dk/api",
    "datacatalogueUrl": "https://datakatalog.miljoeportal.dk/api/",
    "geoserverUri": "https://b0704-prod-intgeo-app.azurewebsites.net/geoserver/mars/ows",
    "geoserverProxyUri": "https://mars.sgav.dk/api/geoproxy"
  },
  "application": {
    "lowlandCarbonDataset": "urn:dmp:ds:kulstof-2022-lavbundskort",
    "nitrogenRetentionDataset": "urn:dmp:ds:kvaelstofretention-version-2025",
    "demarkationCheckDatasets": "urn:dmp:dsgroup:udtagningsprojekter-samlet urn:dmp:dsgroup:uroert-skov-samlet urn:dmp:ds:vand-vp2-anlaeg urn:dmp:ds:vand-vp3-anlaeg urn:dmp:ds:aftaler-om-natur-tinglyst urn:dmp:ds:klimaskovfondens-projekter"
  }
}
```

### National Goals (from `/api/master-data`)

| Goal | Value | Source field |
|------|-------|-------------|
| Nitrogen reduction | **12,776 tonnes** | `nitrogenReductionGoalT` |
| Land extraction | **140,000 ha** | `extractionEffectGoalHa` |
| Afforestation | **250,000 ha** | `afforestationEffortGoalHa` |

Note: The nitrogen goal of 12,776 T is close to but not exactly the 13,800 T from the political agreement. This may represent the subset tracked in MARS (excluding field regulation measures).

### Project States (from `/api/master-data`)

The complete project lifecycle in MARS:

| StateNr | Name | Type |
|---------|------|------|
| 1 | Kladde (Draft) | Initial |
| 2 | Forundersøgelse • Ansøgt (Preliminary study applied) | Initial |
| 3 | Forundersøgelse • Opgivet (Preliminary study abandoned) | Canceled |
| 5 | Forundersøgelse • Afslag (Preliminary study rejected) | Canceled |
| 6 | Forundersøgelsestilsagn (Preliminary study grant) | Preliminary |
| 9 | Etablering • Ansøgt (Construction applied) | Preliminary |
| 10 | Etableringstilsagn (Construction grant) | Preliminary |
| 11 | Udbetaling/anlæggelse • Anmodet (Payment/construction requested) | Preliminary |
| 15 | Anlagt (Completed/constructed) | Established |
| 16 | Etablering • Opgivet (Construction abandoned) | Canceled |
| 17 | Etablering • Afslag (Construction rejected) | Canceled |
| 20 | Forundersøgelsestilsagn • Ændringsanmodning (Prelim grant change request) | Preliminary |
| 21 | Etableringstilsagn • Ændringsanmodning (Construction grant change request) | Preliminary |
| 50-54 | Høring states (Hearing/consultation phases) | Hearing |

### Subsidy Schemes (17 active)

| Name | Organization | Min Area | Carbon Overlap % |
|------|-------------|----------|-----------------|
| Permanent ekstensivering | SGAV | 0.3 ha | — |
| Øvrig udtagning | — | — | — |
| SGAV Klima-Lavbund | SGAV | — | 60% |
| Minivådområder | SGAV | — | — |
| NST Skovrejsning | NST | — | — |
| Restaurering af ådale | SGAV | — | — |
| Skovrejsning | SGAV | 1 ha | — |
| Lavbundsprojekter | SGAV | — | 60% |
| Kvælstofvådområder | SGAV | — | — |
| NST Kvælstofvådområder | NST | — | — |
| KLA-Lavbund | SGAV | 1 ha | 0% |
| KLA-Kvælstofvådområder | SGAV | — | — |
| NST Klima-Lavbund | NST | — | — |
| NST Øvrige statslige projekter | NST | — | — |
| Privat Skovrejsning | — | — | — |
| NST Fosforvådområder | NST | — | — |
| Fosforvådområder | SGAV | — | — |

### Mitigation Measures (7 categories)

Lavbundsprojekter, Ekstensivering, Minivådområder, Øvrige, Kvælstofvådområder, Skovrejsning, Fosforvådområder og ådale

### Project Data Summary (from `/api/status/projects`)

**1,164 projects** currently in the public status API:

| Status | Count | Meaning |
|--------|-------|---------|
| 6 (Forundersøgelsestilsagn) | 450 | Preliminary study grant approved |
| 10 (Etableringstilsagn) | 634 | Construction grant approved |
| 15 (Anlagt) | 80 | Completed/constructed |

Each project includes: `projectId`, `projectName`, `projectStatus`, `nitrogenReductionT`, `extractionEffortHa`, `afforestationEffortHa`, `overlappingAreaHa`, `geoLocationId`, `subsidySchemeId`, `mitigationMeasureId`, `applicationTimestamp`, `lastStateChanged`.

### Plan-Level Data (from `/api/status/plans`)

**37 kystvandgrupper** (coastal water groups) with per-plan nitrogen targets:

| Aggregate | Value |
|-----------|-------|
| Total nitrogen goal | 12,769 T |
| Total nitrogen achieved | 3,433 T (**~27% of goal**) |
| Established projects | 84 |
| Approved projects | 462 |
| Assessed projects | 727 |
| Sketch projects | 5,503 |
| Formal projects | 1,273 |

Each plan includes: `nitrogenReductionGoalT`, `extractionPotentialHa`, `fieldRegulationT`, `otherExtractionEffortT`, `firstPublishedTimestamp`, `lastPublishedTimestamp`, `status`, plus nested `projects`, `sketchProjects`, and `naturePotentials` arrays.

### Field Dataset Configurations

MARS references external field/parcel datasets:
- `urn:dmp:ds:marker-2025` (Markkortet 2025, year: 2026)
- `urn:dmp:ds:marker-2024` (Markkortet 2024, year: 2025)

### MARS GeoServer

- **Direct URL**: `https://b0704-prod-intgeo-app.azurewebsites.net/geoserver/mars/ows` (Azure-hosted, CORS blocked)
- **Proxy URL**: `https://mars.sgav.dk/api/geoproxy` (returns 200 via SPA fetch, but "Web App Unavailable" via direct navigation — likely requires authenticated session)
- **Assessment**: The GeoServer contains MARS-specific map layers but appears to require authentication. Not accessible without login credentials.

### Assessment

- **Automation level**: ✅ **VERY HIGH** — public REST API with JSON responses, no auth needed for status endpoints
- **Access**: Public for all `/api/status/*` endpoints; authenticated for `/api/projects` (POST) and geoproxy
- **Risk**: Low for status endpoints (standard REST); medium for long-term stability (API is undocumented, could change)
- **Priority**: 🔴 CRITICAL — **this is no longer a blocker; it's the primary data source**
- **Action**: Build ETL pipeline to periodically fetch `/api/status/plans` and `/api/status/projects`, store in git as JSON

---

## Source 2: MiljøGIS WFS (HIGH VALUE — CONFIRMED WORKING)

**Endpoint**: `https://wfs2-miljoegis.mim.dk/vandprojekter/ows`
**Protocol**: OGC WFS 2.0.0 via GeoServer

### Browser-Verified Findings

**Confirmed working via live browser test** — returns GeoJSON FeatureCollection with MultiPolygon geometries in EPSG:25832.

Sample query result for `vandprojekter:kla_projektomraader`:
- **Feature properties**: `projektn` (project name), `areal_ha` (area in hectares), `a_runde` (application round), `afgoer_fase2` (decision phase), `projektgodk` (project approval status)
- **Geometry type**: MultiPolygon
- **CRS**: EPSG:25832

### How to Query

```bash
# Get features as GeoJSON (first 3)
curl "https://wfs2-miljoegis.mim.dk/vandprojekter/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=vandprojekter:kla_projektomraader&outputFormat=application/json&count=3"
```

### Known Layers

- `vandprojekter:kla_e23_bioprio` — Biodiversity prioritization
- `vandprojekter:kla_projektforslag` — Climate-lowland project proposals
- `vandprojekter:kla_projektomraader` — Climate-lowland project areas
- `vandprojekter:helhedsprojekter_tilsagn2020` — Comprehensive project grants 2020
- Multiple workspaces: `/vandprojekter/ows`, `/np3basis2020/ows`, `/np3h2021/ows`, `/grukos/ows`

### Assessment

- **Automation level**: ✅ HIGH — standard OGC protocol, confirmed working
- **Access**: Public, no authentication required
- **Risk**: Low — GeoServer is mature, WFS standard is stable
- **Priority**: 🔴 CRITICAL — provides geographic geometries that complement MARS project data
- **Action**: Ready to implement immediately

---

## Source 3: VanDa Hydrometry API (WELL-DOCUMENTED)

**Production URL**: `https://vandah.miljoeportal.dk/api/`
**Swagger**: `https://vandah.miljoeportal.dk/api/swagger/index.html`
**Wiki**: `https://github.com/danmarksmiljoeportal/VanDa/wiki/Hydro-API`

### Findings

- Well-documented REST API with Swagger/OpenAPI interface
- Authentication: JWT with OAuth2 via `log-in.miljoeportal.dk` (same identity provider as MARS!)
- Read operations (`GET /stations`): No specific role required
- Key endpoints: `GET /stations`, `POST /measurements`, `PATCH /measurements`
- Data: Water levels (ExaminationType 25), stream discharge (ExaminationType 27)
- Reference implementation: `github.com/SDFIdk/vanda_hydrometry_data` (Java)

### Assessment

- **Automation level**: ✅ HIGH
- **Access**: Read requires OAuth2 token but no special roles
- **Risk**: Low — actively maintained
- **Priority**: 🟡 IMPORTANT — outcome layer data
- **Action**: Register for OAuth2 access

---

## Source 4: DAWA API (CONFIRMED WORKING)

**Endpoint**: `https://api.dataforsyningen.dk/kommuner`

### Browser-Verified Findings

**Confirmed working via live browser test** — returns JSON with municipality data including codes, names, regions, bounding boxes, and visual centers.

Sample response fields: `kode`, `navn`, `regionskode`, `region`, `bbox`, `visueltcenter`, `dagi_id`

### Assessment

- **Automation level**: ✅ HIGH — simplest API in the stack
- **Access**: Public, no auth
- **Risk**: Very low
- **Priority**: 🟡 IMPORTANT — foundational geographic data
- **Action**: Ready to use immediately

---

## Source 5: Danmarks Statistik API (READY TO USE)

**Endpoint**: `https://api.statbank.dk/v1/`

- Public REST API, no auth, CSV and JSON output
- Provides land accounts, emission inventories, environmental statistics

### Assessment

- **Automation level**: ✅ HIGH
- **Priority**: 🟢 NICE-TO-HAVE initially

---

## Source 6: Arealdata (Danmarks Miljøportal)

**Catalogue**: `https://arealdata.miljoeportal.dk/`

- WFS/WMS services for 1,000+ datasets
- Key datasets: `urn:dmp:ds:projektomraader-klima-lavbund`, Kulstof2022
- MARS references these via `app-settings.json` dataset URNs

### Assessment

- **Automation level**: ✅ HIGH (via WFS)
- **Priority**: 🟡 IMPORTANT — carbon soil maps and project overlays

---

## Source 7: Datakatalog API (NEW — from MARS config)

**Endpoint**: `https://datakatalog.miljoeportal.dk/api/`

Discovered via MARS `app-settings.json`. This is the central data catalogue for Danmarks Miljøportal. Can be queried to resolve dataset URNs to actual WFS/WMS endpoints.

### Assessment

- **Automation level**: ⚠️ Unknown — needs investigation
- **Priority**: 🟡 IMPORTANT — could resolve all MARS dataset URNs to WFS endpoints

---

## Summary: What Can Be Built Today

| Data Need | Source | Ready? | Action Required |
|-----------|--------|--------|-----------------|
| **Project progress** | **MARS REST API** | **✅ Yes** | **None — public JSON API!** |
| **Nitrogen targets by area** | **MARS REST API** | **✅ Yes** | **None — /api/status/plans** |
| **National aggregates** | **MARS REST API** | **✅ Yes** | **None — /api/status/metadata** |
| Municipal boundaries | DAWA API | ✅ Yes | None — public REST |
| Water project geometries | MiljøGIS WFS | ✅ Yes | None — public WFS |
| VP3 targets & status | MiljøGIS WFS | ✅ Yes | Download shapefiles |
| Statistical baselines | Danmarks Statistik | ✅ Yes | None — public REST |
| Water measurements | VanDa API | ⚠️ Needs auth | Register for OAuth2 |
| Environmental map layers | Arealdata WFS | ⚠️ Needs URL discovery | Browse catalogue |
| MARS project geometries | MARS GeoServer | ❌ Needs auth | Requires authenticated session |
| MARS project management | MARS Projects API | ❌ Needs auth | POST only, requires login |

### Critical Path — RESOLVED

The MARS API discovery fundamentally changes the project feasibility:

1. **Before**: MARS was "THE blocker" — unknown if any API existed, potential scraping nightmare
2. **After**: MARS has a public, unauthenticated REST API returning rich JSON data for all 1,164+ projects, 37 coastal water group plans, and 23 main catchment aggregations

**Immediate build plan**:
1. ETL pipeline for MARS `/api/status/plans` (richest endpoint — goals, progress, nested projects)
2. ETL pipeline for MARS `/api/status/projects` (individual project details)
3. DAWA fetch for municipality boundaries (one-time)
4. MiljøGIS WFS fetch for project geometries (periodic)
5. Static site rendering aggregated progress dashboard

**The tracker can now answer "Er Den Grønne Trepart på sporet?" with real data:**
- National nitrogen reduction: 3,433 T achieved of 12,769 T goal (~27%)
- 80 projects completed, 462 approved, 727 assessed, 5,503 in sketch phase
- Per-coastal-water-group progress breakdowns available
