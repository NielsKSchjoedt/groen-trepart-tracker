# Data Model

## Core Entities

The data model reflects the governance hierarchy and tracks both administrative progress and environmental outcomes.

### Geographic Units

```
geography_unit
├── id (UUID)
├── type: enum(nation, district, catchment, coastal_water_group, sub_catchment, municipality)
├── name: string
├── code: string (e.g., municipality code, VP3 water body ID)
├── parent_id: FK → geography_unit (nullable, for hierarchy)
├── geometry: GeoJSON (boundaries)
├── area_ha: float
└── metadata: JSON (population, land use breakdown, etc.)
```

**Hierarchy**:
- Nation (1) → Districts (4) → Catchments (23) → Coastal Water Groups (37) → Sub-catchments (108)
- Nation (1) → Municipalities (98) — cross-cutting, linked via spatial overlap

### Targets

```
target
├── id (UUID)
├── geography_id: FK → geography_unit
├── metric_type: enum(nitrogen_tonnes, lowland_ha, forest_ha, nature_ha, barriers_count)
├── target_value: float
├── target_year: int
├── source: string (VP3-II, political agreement, etc.)
├── source_date: date
└── notes: text
```

### Projects (from MARS)

```
project
├── id (UUID)
├── mars_id: string (if available)
├── name: string
├── type: enum(nitrogen_wetland, lowland, climate_lowland, afforestation, nature, barrier_removal)
├── status: enum(sketch, preliminary_study, establishment, completed)
├── geography_id: FK → geography_unit (primary municipality or catchment)
├── geometry: GeoJSON (project boundary, if available)
├── area_ha: float
├── nitrogen_effect_tonnes: float (calculated by MARS via NKMv2025)
├── lowland_extraction_ha: float
├── forest_area_ha: float
├── responsible_entity: string (municipality, foundation, etc.)
├── data_source: string
├── source_date: date
├── first_seen: date
├── last_updated: date
└── raw_data: JSON (original source record)
```

### Progress Snapshots

```
progress_snapshot
├── id (UUID)
├── geography_id: FK → geography_unit
├── snapshot_date: date
├── metric_type: enum (matches target.metric_type)
├── pipeline_value: float (projects in all stages)
├── completed_value: float (anlagt/completed only)
├── target_value: float (denormalized for easy comparison)
├── completion_pct: float (computed)
├── on_track: boolean (computed: is pace sufficient to meet target_year?)
├── data_source: string
└── notes: text
```

### Environmental Outcomes (from NOVANA)

```
outcome_measurement
├── id (UUID)
├── geography_id: FK → geography_unit (water body, coastal area, etc.)
├── indicator: enum(nitrogen_transport, ecological_status, dvfi_index, oxygen_depletion, ...)
├── value: float
├── unit: string
├── status_class: enum(high, good, moderate, poor, bad) — WFD classification
├── measurement_date: date
├── publication_date: date
├── source: string (NOVANA report reference)
└── methodology_notes: text
```

### Data Harvest Log

```
harvest_log
├── id (UUID)
├── source_name: string
├── harvest_type: enum(api_poll, wfs_fetch, web_scrape, manual_entry, pdf_extract)
├── started_at: timestamp
├── completed_at: timestamp
├── status: enum(success, partial, failed)
├── records_fetched: int
├── records_updated: int
├── error_message: text (nullable)
└── raw_response_hash: string (for deduplication)
```

## Relationships

```
geography_unit 1──M target
geography_unit 1──M project (via primary geography)
geography_unit 1──M progress_snapshot
geography_unit 1──M outcome_measurement
project M──M geography_unit (a project can span multiple municipalities)
```

## JSON/File-based Alternative (for git-backed approach)

If ADR-001 resolves toward Option A or C, the same model maps to files:

```
data/
├── geography/
│   ├── municipalities.geojson      # 98 features with properties
│   ├── catchments.geojson          # 23 features
│   ├── coastal_water_groups.geojson # 37 features
│   └── sub_catchments.geojson      # 108 features
├── targets/
│   ├── nitrogen_by_coastal_water.json
│   ├── lowland_by_municipality.json
│   └── national_targets.json
├── projects/
│   ├── latest.json                 # Current project list
│   └── snapshots/
│       ├── 2026-03-01.json         # Point-in-time snapshots
│       └── 2026-02-01.json
├── progress/
│   ├── national.json               # Aggregated progress metrics
│   ├── by_catchment.json
│   └── by_municipality.json
├── outcomes/
│   ├── nitrogen_transport.json     # Time series
│   ├── water_body_status.json
│   └── stream_ecology.json
└── harvest/
    └── log.json                    # ETL run history
```

## Phase-Aware Progress Model

All progress metrics are broken down by implementation phase. This is critical because a project in preliminary investigation has a fundamentally different reliability than one that has been physically constructed.

### Phase Classification (from MARS `projectStatus`)

| Status Code | Phase         | Danish Name                  | Implemented? |
| ----------- | ------------- | ---------------------------- | ------------ |
| 6           | preliminary   | Forundersøgelsestilsagn      | No           |
| 10          | approved      | Etableringstilsagn           | No           |
| 15          | established   | Anlagt                       | **Yes**      |
| Other       | preliminary   | (conservative default)       | No           |

### Phase Breakdown Structure

```json
{
  "byPhase": {
    "established": { "T": 26.4, "description": "Anlagt — actually built" },
    "approved": { "T": 580.6, "description": "Approved, not yet built" },
    "preliminary": { "T": 3238.2, "description": "Investigation only" }
  }
}
```

This structure appears at:
- **National level**: `national.progress.nitrogen.byPhase`, `...extraction.byPhase`, etc.
- **Per-plan level**: `plans[].nitrogenByPhase`, `plans[].extractionByPhase`, `plans[].afforestationByPhase`

### Data Provenance

Every section of `dashboard-data.json` carries source attribution:
- `sources` — full provenance for each data source (URL, maintainer, license, disclaimer, fetchedAt)
- `projectStates` — reference array of all 18 MARS project states
- `projectPipeline` — phase descriptions with `implemented` boolean for frontend use

See `docs/data-sources/data-provenance.md` for the complete data lineage documentation.

---

## Key Computed Metrics

These are derived, not stored directly:

1. **Pace indicator** = `completed_value / ((current_date - start_date) / (target_date - start_date))` — ratio >1 means ahead of schedule
2. **Pipeline coverage** = `pipeline_value / target_value` — how much is at least planned
3. **Conversion rate** = `completed_value / pipeline_value` — what fraction of planned projects finish
4. **Nitrogen gap** = `target_nitrogen - current_pipeline_nitrogen_effect` — tonnes still unaccounted for
5. **Municipal participation** = count of municipalities with ≥1 adopted plan / 98
6. **Combined protected area** = Natura 2000 terrestrial + §3 areas − estimated overlap — compared to 20% target
7. **Afforestation baseline** = fredskov area (legal baseline) — new forest measured above this
