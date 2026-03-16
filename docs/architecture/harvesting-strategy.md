# Data Harvesting Strategy

## Three-track approach

### Track 1: MARS Data (Critical Path)

**Source**: MARS Status Module (public, no login)
**URL**: https://mars.sgav.dk/status/lavbundsindsatsen
**Frequency**: Weekly check, meaningful changes probably monthly

**Current approach** (REST API discovered March 2026):

An unauthenticated JSON API was discovered at `mars.sgav.dk/api` via browser DevTools. Implemented in `etl/fetch_mars.py`, polling 5 endpoints daily via GitHub Actions:

1. `/api/master-data` — subsidy schemes, project states, national goals
2. `/api/status/plans` — 37 coastal water group plans with N-reduction targets + nested projects
3. `/api/status/projects` — all ~6,000+ individual projects with status and metrics
4. `/api/status/vos` — 23 vandopland (main catchment) aggregations
5. `/api/status/metadata` — national goals and plan definitions

**Caveat**: The API is not officially documented by SGAV. There is no guarantee of long-term stability. The ETL pipeline handles errors gracefully and logs failures to `data/etl-log.json`.

### Track 2: Context & Geography (GIS/API sources)

These are the most automatable sources — stable APIs with documented interfaces.

#### 2a. MiljøGIS WFS — Environmental map layers

**Endpoint**: `wfs2-miljoegis.mim.dk/vandprojekter/ows`
**Protocol**: OGC WFS 2.0.0
**Format**: GeoJSON, GML
**Auth**: None (public)
**Frequency**: Monthly or when plan periods update

```
GET {endpoint}?service=WFS&version=2.0.0&request=GetCapabilities
GET {endpoint}?service=WFS&version=2.0.0&request=GetFeature&typeName={layer}&outputFormat=application/json
```

**Layers to harvest**:
- Vandprojekter (water projects — climate-lowland, wetlands)
- VP3/VP3-II indsatser (planned interventions)
- Vandområdeplandata (water area plan data)

#### 2b. VanDa REST API — Surface water data

**Endpoint**: `vandah.miljoeportal.dk/api`
**Protocol**: REST with Swagger/OpenAPI docs
**Format**: JSON
**Auth**: OAuth2 (OpenID Connect)
**Frequency**: Monthly

**Data available**: Chemistry, biology, hydrology measurements for surface water bodies. Historical time series.

#### 2c. DAWA — Administrative boundaries

**Endpoint**: `api.dataforsyningen.dk/kommuner`
**Protocol**: REST
**Format**: JSON, GeoJSON
**Auth**: None (public)
**Frequency**: Once (boundaries rarely change)

**Data available**: Municipality boundaries, reverse geocoding, geographic hierarchy.

#### 2d. Vandplandata.dk — Water body status & targets

**URL**: https://vandplandata.dk/
**Format**: Shapefiles, available from `files-miljoegis.mim.dk`
**Auth**: None (public download)
**Frequency**: Per plan period (VP3: 2021-2027)

**Data available**: Ecological/chemical status for all 18,600 km designated watercourses, 7,500 km designated for restoration, 1,500 barrier removals.

#### 2e. Danmarks Statistik — Statistical baselines

**Endpoint**: `statistikbanken.dk`
**Protocol**: REST API
**Format**: CSV, JSON
**Auth**: None (public)
**Frequency**: Annual

**Data available**: Land accounts, emission inventories, land use per municipality.

#### 2f. LandbrugsGIS — Agricultural overlays

**URL**: `landbrugsgeodata.fvm.dk`
**Format**: Shapefiles (free download)
**Auth**: None (public)
**Frequency**: Annual

**Data available**: Field blocks, land use, nitrogen retention, carbon-rich soil (Kulstof2022).

### Track 3: Outcomes (NOVANA / DCE reports)

**Source**: DCE/Aarhus University scientific reports
**Format**: PDF (primary), some raw data via Miljøportal systems
**Auth**: None for reports; Miljøportal access for raw data
**Frequency**: Annual (with ~12 month lag)

**Approach**:
1. Monitor DCE publication page for new reports
2. Extract key metrics (nitrogen transport, water body status counts, DVFI scores)
3. Cross-reference with Miljøtilstand.dk for pre-processed indicators
4. Store as time series with explicit measurement/publication dates

**Key limitation**: The ~12 month lag means outcome data is always behind administrative data. The tracker must communicate this clearly.

## Harvesting Pipeline Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│   Sources    │────▶│   Fetchers   │────▶│  Transform   │────▶│   Storage   │
│              │     │              │     │              │     │             │
│ MARS (REST)  │     │ Python/Node  │     │ Normalize    │     │ JSON/GeoJSON│
│ WFS (OGC)   │     │ scripts per  │     │ Validate     │     │ in git repo │
│ REST APIs   │     │ source       │     │ Deduplicate  │     │ (or PostGIS)│
│ PDF reports │     │              │     │ Compute      │     │             │
│ Shapefiles  │     │              │     │ derived      │     │             │
└─────────────┘     └──────────────┘     └──────────────┘     └─────────────┘
                                                                     │
                                                              ┌──────▼──────┐
                                                              │  Dashboard  │
                                                              │  (static or │
                                                              │   dynamic)  │
                                                              └─────────────┘
```

## Priority Order for Implementation

1. **MARS REST API polling** — unblocks the core value proposition (resolved March 2026)
2. **MiljøGIS WFS** — richest automated source, enables geographic context
3. **DAWA boundaries** — enables geographic drill-down in dashboard
4. **Vandplandata targets** — enables on-track/off-track calculations
5. **Danmarks Statistik baselines** — enables trend context
6. **VanDa API** — enables outcome correlation
7. **NOVANA/DCE reports** — manual but essential for outcome layer
8. **LandbrugsGIS** — enables agricultural land overlap analysis
