# Data Provenance & Lineage

This document describes the complete data pipeline from source to dashboard, including phase-awareness, quality disclaimers, and how each metric is computed.

---

## Pipeline Overview

```
External APIs (MARS, MiljøGIS, DST, DAWA, VanDa)
    │
    ▼
ETL Fetchers (etl/fetch_*.py)
    │ ── raw JSON/GeoJSON saved to data/*/
    ▼
Dashboard Builder (etl/build_dashboard_data.py)
    │ ── aggregates, computes phases, adds provenance
    ▼
dashboard-data.json (101 KB)
    │
    ▼
Frontend (React/TypeScript)
```

Most fetchers use Python stdlib only. Two exceptions: `build_co2_data.py` requires `openpyxl` (Excel parsing), and `fetch_water_body_geometries.py` uses `requests`. The pipeline runs via `etl/fetch_all.sh` which orchestrates all fetchers + the dashboard build step.

---

## Data Sources

### 1. MARS API (mars.sgav.dk)

**Feeds**: Nitrogen pillar, Extraction pillar, Afforestation pillar, Project pipeline

**Endpoints used** (base URL: `https://mars.sgav.dk/api`):
- `/api/master-data` — subsidy schemes, project states, national goals
- `/api/status/plans` — all 37 coastal water group plans with N-reduction targets + nested projects
- `/api/status/projects` — all ~6,000+ individual projects with status and metrics
- `/api/status/vos` — 23 vandopland (main catchment) aggregations
- `/api/status/metadata` — national goals and plan definitions

**Phase classification (two layers)**:
1. **Sprint 2 — full MARS / DN pipeline** (`etl/mars_pipeline_s2.py`, exposed as `national.byPipelinePhase` in `dashboard-data.json`): all official `stateNr` values in `master-data` map to five main stages (`sketch` with sub-states kladde/ansøgt, `preliminary_grant`, `preliminary_done`, `establishment_grant`, `established`) plus a **cancelled** sidecar. Sketch-only rows come from `plans[].sketchProjects` (deduplicated by `sketchProjectId` for national totals).
2. **Legacy 3-bucket** (unchanged for charts that still use it): the same build rolls those five stages into `preliminary` (sketch + forundersøgelse before etableringstilsagn), `approved` (etableringstilsagn), and `established` (anlagt). Older copy may still list only 6/10/15; the ETL now uses the full map.

**Key disclaimer**: The vast majority of reported nitrogen reduction is in the preliminary phase. As of the latest data:
- Established (actually built): ~26 T (0.8% of pipeline)
- Approved (not yet built): ~581 T (16.8%)
- Preliminary (investigation only): ~3,238 T (82.4%)

**Maintainer**: Miljøstyrelsen / Danmarks Miljøportal

### 2. DAWA API (api.dataforsyningen.dk)

**Feeds**: Municipality boundaries, geographic reference data

**Endpoints used**:
- `/kommuner` — 98 municipality records
- `/kommuner/{kode}` — individual municipality with GeoJSON boundary

**Disclaimer**: CC0 licensed. Geographic boundaries are administrative and may not align perfectly with environmental boundaries.

### 3. MiljøGIS WFS — Vandprojekter (wfs2-miljoegis.mim.dk)

**Feeds**: Project geometries, catchment boundaries

**Layers used**:
- `vandprojekter:vp3_2025_kystvandoplande` — VP3 catchment boundaries
- `vandprojekter:vp3_2025_hovedoplande` — main catchment areas

**Disclaimer**: WFS data updates are not synchronized with MARS. Geometry data may lag behind project status changes.

### 4. Natura 2000 (wfs2-miljoegis.mim.dk/natur)

**Feeds**: Nature pillar — "20% protected land" metric

**Layer**: `natur:natura_2000_omraader` (~250 features)

**Processing**:
1. All Natura 2000 site polygons fetched with `shape_area` (m²)
2. Marine sites classified heuristically: if site name contains marine keywords (kattegat, skagerrak, vadehav, etc.) AND area > 10,000 ha → marine
3. Only terrestrial area contributes to the "% of land protected" metric

**Known limitations**:
- Marine/terrestrial classification is name-based, not spatial. Coastal sites with mixed coverage may be misclassified.
- Natura 2000 and §3 areas overlap significantly. The overlap is estimated, not computed spatially.

### 5. §3 Protected Nature (wfs2-miljoegis.mim.dk/natur)

**Feeds**: Nature pillar — combined with Natura 2000 for protected area total

**Layer**: `natur:ais_par3` (~186,628 features)

**Processing**:
1. Paginated fetch (10,000 features/page) — only `a_type` and `hectares` properties (no geometry for stats)
2. Aggregated by nature type code (§3 uses numeric codes: 3110=oligotrophic lake, 4030=dry heath, etc.)
3. Total area computed; overlap with Natura 2000 deducted conservatively (~30% estimate)

**Known limitations**:
- The 30% overlap estimate is a rough approximation. True overlap varies by region and would require spatial union computation (GIS tooling).
- Feature count and area may differ from official statistics due to timing of WFS data updates.

### 6. Forest Data (wfs2-miljoegis.mim.dk)

**Feeds**: Afforestation pillar — baseline and current forest extent

**Layers**:
- `np3basis2020:np3b2020_fredskov` (~59,822 parcels) — legally protected forests (cadastral baseline)
- `skovdrift:digitalt_skovkort_2022` (~61,588 polygons) — digital forest map (current coverage)

**Processing**:
- Fredskov: paginated fetch, area aggregated from `areal` field (m²)
- Skovkort: count only (geometry-only layer, no area attribute)

**Known limitations**:
- Fredskov is a legal designation, not a measurement of actual tree cover.
- The afforestation target (250,000 ha) should be measured as new forest above the fredskov baseline, but precise year-over-year comparison requires temporal forest map data that isn't yet available.

### 7. Danmarks Statistik (api.statbank.dk)

**Feeds**: Land use context, forest statistics, subsidy data

**Tables**: ARE207 (land use), SKOV1 (forest stats), FOND19 (foundations), TILSKUD2 (subsidies)

**Disclaimer**: CC BY 4.0 — attribution required. Source: Danmarks Statistik, [table name].

### 8. Klimaskovfonden (Den Danske Klimaskovfond)

**Feeds**: Voluntary afforestation and lowland project polygons (213 features, ~2,314 ha total — 210 skovrejsning / 3 lavbund)

**Pillar assignment**: The two project types feed different pillars:
- **Skovrejsning** (210 projects, ~2,284 ha) → **Afforestation pillar** — counts towards the 250,000 ha new forest target
- **Lavbund** (3 projects, ~30 ha) → **Extraction pillar** — counts towards the 140,000 ha lowland extraction target

**Source**: WFS endpoint at `test.admin.gc2.io/ows/klimaskovfonden/public/` — layer `klimaskovfonden:public.klimaskovfondens_projekter`

**ETL**: `etl/fetch_klimaskovfonden.py` — fetches GML, computes area from polygon geometry (Shoelace formula on WGS84 coords), outputs `data/klimaskovfonden/summary.json` and `data/klimaskovfonden/projects.json`

**Fields**: `sagsnummer` (case number), `aargang` (batch/year e.g. "2024-5"), `projekttyp` ("Skovrejsning" or "Lavbund"), polygon geometry (MultiPolygon, EPSG:4326)

**Registry**: The full Klimaregister (with CO₂ estimates, status, validators) is at [klimaskovfonden.dk/vores-standard/register](https://klimaskovfonden.dk/vores-standard/register) — Power BI dashboard, not API-accessible. The WFS only provides geometry, case number, year, and type.

**Data freshness** (confirmed via correspondence with Klimaskovfonden, 24. marts 2026):
- WFS-data opdateres minimum ved hver ansøgningsrunde — i praksis ca. **4 gange om året**
- Klimaregisteret (Power BI) opdateres oftere og viser projektfaser
- Samlet areal fra WFS bekræftet: **2.918 ha** (pr. 24. marts 2026)

**Note**: Historical snapshots exist as separate layers (`_marts_2025`, `_april_2025`). The main layer is the current/live dataset.

---

## Phase-Aware Data Structure

The `dashboard-data.json` breaks down every progress metric by implementation phase. This is critical because a project in preliminary investigation is fundamentally different from one that's been built.

### National Level

```json
{
  "national": {
    "progress": {
      "nitrogen": {
        "goalT": 12769.5,
        "achievedT": 3445.9,
        "byPhase": {
          "established": { "T": 26.4, "description": "Anlagt — actually constructed" },
          "approved": { "T": 580.6, "description": "Etableringstilsagn — approved, not built" },
          "preliminary": { "T": 3238.2, "description": "Forundersøgelsestilsagn — investigation only" }
        },
        "source": "MARS API — mars.sgav.dk",
        "disclaimer": "Nitrogen reduction figures are modelled..."
      }
    }
  }
}
```

### Per-Plan Level

Each of the 37 coastal water group plans carries its own phase breakdown:

```json
{
  "plans": [{
    "name": "Nibe Bredning og Langerak",
    "nitrogenGoalT": 1214.0,
    "nitrogenAchievedT": 1123.5,
    "nitrogenByPhase": {
      "established": 0.2,
      "approved": 134.7,
      "preliminary": 988.6
    }
  }]
}
```

### Project Pipeline Reference

The JSON includes a `projectPipeline` array describing each phase with an `implemented` boolean flag:

```json
{
  "projectPipeline": [
    {
      "phase": "preliminary",
      "danishName": "Forundersøgelsestilsagn",
      "description": "Preliminary investigation granted",
      "implemented": false
    },
    {
      "phase": "approved",
      "danishName": "Etableringstilsagn",
      "description": "Approved for construction",
      "implemented": false
    },
    {
      "phase": "established",
      "danishName": "Anlagt",
      "description": "Actually built and operational",
      "implemented": true
    }
  ]
}
```

---

## Sources Provenance in JSON

The `dashboard-data.json` includes a `sources` object with full provenance for each data source:

```json
{
  "sources": {
    "mars": {
      "name": "MARS — Miljøstyrelsens Arealregister",
      "url": "https://mars.sgav.dk",
      "description": "...",
      "maintainer": "Miljøstyrelsen / Danmarks Miljøportal",
      "license": "CC0-like (PSI-loven)",
      "disclaimer": "...",
      "fetchedAt": "2026-03-11T..."
    }
  }
}
```

Frontend components should use these `sources` entries to display attribution and disclaimers wherever data is shown.

---

## ETL Log

Every fetcher run is logged in `data/etl-log.json` with:
- Source name, endpoints contacted
- Record counts, duration
- Status (ok/partial/error)
- Timestamp (UTC)

This provides an audit trail for data freshness and pipeline health.
