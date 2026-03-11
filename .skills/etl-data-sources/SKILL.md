---
name: etl-data-sources
description: >
  ETL pipeline and data source policies for the Grøn Trepart Tracker. Use this skill whenever
  working on ETL fetchers, data ingestion, API integration, build_dashboard_data.py, or anything
  touching the data/ directory, etl/ scripts, or dashboard-data.json. Also trigger when adding new
  data sources, debugging data quality issues, or modifying how data flows from external APIs into
  the dashboard. Even if someone just says "add a new data source" or "the numbers look wrong" —
  this skill has the policies you need.
---

# ETL & Data Sources — Grøn Trepart Tracker

This skill codifies the rules and patterns for fetching, transforming, and structuring data in the
Grøn Trepart Tracker. The project tracks Denmark's progress on the Green Tripartite Agreement
(Grøn Trepart) across 5 environmental pillars.

## Golden Rules

1. **Python stdlib only** — Every fetcher uses only `urllib.request`, `json`, `os`, `datetime`, and
   other standard library modules. No pip dependencies. This keeps the pipeline portable and
   eliminates version conflicts. If you need something fancy, write it yourself with stdlib.

2. **Phase-aware data is non-negotiable** — Every metric that comes from MARS must be broken down by
   implementation phase. A project in "preliminary investigation" is fundamentally different from one
   that's been physically built. Lumping them together is misleading. See the Phase Classification
   section below.

3. **Provenance on everything** — Every data section in `dashboard-data.json` must carry source
   metadata: API URL, maintainer, license, disclaimer, and fetchedAt timestamp. The public should
   be able to trace any number back to its origin.

4. **Conservative defaults** — When in doubt, undercount rather than overcount. Unknown MARS status
   codes map to "preliminary". Overlap between Natura 2000 and §3 areas uses a conservative 30%
   estimate. Marine/terrestrial classification is heuristic and documented as such.

---

## Phase Classification (Critical)

MARS projects have a `projectStatus` integer. The dashboard maps these to three phases:

```python
PHASE_MAP = {
    6: "preliminary",   # Forundersøgelsestilsagn — investigation granted, not approved
    10: "approved",      # Etableringstilsagn — approved for construction, not built
    15: "established",   # Anlagt — actually built and operational
}
# All other status codes → "preliminary" (conservative default)
```

Why this matters: as of the latest data, only ~0.8% of the nitrogen reduction pipeline comes from
actually-built projects. The rest is in investigation or approval stages. Displaying the total
without this breakdown would make it look like Denmark is 27% of the way to its goal, when in
reality the implemented effect is closer to 0.2%.

The phase breakdown must appear:
- At the **national level**: `national.progress.nitrogen.byPhase`, `...extraction.byPhase`, etc.
- At the **per-plan level**: `plans[].nitrogenByPhase`, `plans[].extractionByPhase`
- In the **project pipeline reference**: `projectPipeline[]` array with `implemented: boolean`

### Phase Breakdown Computation

```python
def compute_project_phase_breakdown(project_list):
    phases = {
        "preliminary": {"count": 0, "nitrogenT": 0, "extractionHa": 0, "afforestationHa": 0},
        "approved":    {"count": 0, "nitrogenT": 0, "extractionHa": 0, "afforestationHa": 0},
        "established": {"count": 0, "nitrogenT": 0, "extractionHa": 0, "afforestationHa": 0},
    }
    for p in project_list:
        status = p.get("projectStatus")
        phase = PHASE_MAP.get(status, "preliminary")
        phases[phase]["count"] += 1
        phases[phase]["nitrogenT"] += p.get("nitrogenReductionT", 0) or 0
        phases[phase]["extractionHa"] += p.get("extractionEffortHa", 0) or 0
        phases[phase]["afforestationHa"] += p.get("afforestationEffortHa", 0) or 0
    # Round all values
    for phase in phases.values():
        for k in ["nitrogenT", "extractionHa", "afforestationHa"]:
            phase[k] = round(phase[k], 1)
    return phases
```

---

## Data Sources & API Patterns

### MARS API (mars.sgav.dk)

The primary source for project data, targets, and plans.

**Endpoints:**
- `/api/master/states` — 18 project state definitions
- `/api/plans/all` — 37 coastal water group plans with nitrogen targets
- `/api/projects/all` — ~1,200 projects with status, nitrogen, extraction, afforestation data

**Critical pattern — per-plan projects:** Plans from `/api/plans/all` contain nested `projects`
arrays. When computing per-plan phase breakdowns, iterate `plan.get("projects", [])` — do NOT try
to match projects to plans via `geoLocationId` (these IDs don't align between the two endpoints).

**User-Agent:** All requests must include `User-Agent: TrepartTracker/0.1 (open-source dashboard; contact nielskristian@autouncle.com)`.

**Timeout:** 30 seconds per request.

### MiljøGIS WFS (wfs2-miljoegis.mim.dk)

OGC WFS 2.0.0 endpoints for geospatial data.

**Common parameters:**
```python
params = {
    "service": "WFS",
    "version": "2.0.0",
    "request": "GetFeature",
    "typeName": "workspace:layer_name",
    "outputFormat": "application/json",
    "srsName": "EPSG:25832",
}
```

**Workspaces and layers:**
- `vandprojekter:vp3_2025_kystvandoplande` — VP3 catchment boundaries
- `vandprojekter:vp3_2025_hovedoplande` — main catchment areas
- `natur:natura_2000_omraader` — Natura 2000 sites (~250 features)
- `natur:ais_par3` — §3 protected nature (~186,628 features — requires pagination!)
- `np3basis2020:np3b2020_fredskov` — legally protected forests (~59,822 parcels)
- `skovdrift:digitalt_skovkort_2022` — digital forest map (~61,588 polygons)

**Pagination for large datasets:** Use `startIndex` and `count` parameters:
```python
start_index = 0
PAGE_SIZE = 10000
while True:
    params["startIndex"] = str(start_index)
    params["count"] = str(PAGE_SIZE)
    # fetch...
    if len(features) < PAGE_SIZE:
        break
    start_index += PAGE_SIZE
```

**Selective property fetching:** For stats-only fetches (no geometry needed), use
`propertyName=field1,field2` to reduce payload size dramatically.

### Danmarks Statistik (api.statbank.dk)

CC BY 4.0 — **attribution is legally required**.

Attribution format: `Kilde: Danmarks Statistik, [tabelnavn]. https://statistikbanken.dk/[tabel-ID]`

Tables used: ARE207, SKOV1, FOND19, TILSKUD2.

### DAWA (api.dataforsyningen.dk)

CC0 licensed. Municipality boundaries and geographic reference data.

---

## Fetcher Script Pattern

Every new fetcher should follow this template:

```python
#!/usr/bin/env python3
"""Fetch [description] from [source]."""

import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

# Add parent for shared modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from etl import etl_log

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "data", "subfolder")
USER_AGENT = "TrepartTracker/0.1 (open-source dashboard; contact nielskristian@autouncle.com)"
TIMEOUT_SECONDS = 30

def fetch_url(url, params=None):
    if params:
        query = urllib.parse.urlencode(params)
        url = f"{url}?{query}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
        return json.loads(resp.read().decode("utf-8"))

def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    started = datetime.now(timezone.utc)
    errors = []
    records_fetched = 0

    try:
        # ... fetch logic ...
        pass
    except Exception as e:
        errors.append(str(e))

    # Save raw data
    with open(os.path.join(DATA_DIR, "raw_data.json"), "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # Save summary
    summary = {
        "fetchedAt": started.isoformat(),
        "recordCount": records_fetched,
        # ... headline numbers ...
    }
    with open(os.path.join(DATA_DIR, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    # Log ETL run
    etl_log.log_etl_run(
        source="source_name",
        endpoints=["endpoint1"],
        record_count=records_fetched,
        status="ok" if not errors else "error",
        started_at=started,
        errors=errors or None,
    )

    print(f"✓ Fetched {records_fetched} records")

if __name__ == "__main__":
    main()
```

### Integrating into the Pipeline

After creating a new fetcher:
1. Add it to `etl/fetch_all.sh` with the same pattern: `python3 etl/fetch_new.py || FAILED=$((FAILED+1))`
2. Add processing logic in `etl/build_dashboard_data.py` to incorporate the new data
3. Add a source entry in the `sources` dict in `build_dashboard_data.py`
4. Update `DATA_SOURCES.md` with license, attribution, and limitations
5. Update `docs/data-sources/data-provenance.md`
6. Update `src/components/DataSourceSection.tsx` if the source should appear in the frontend

---

## Data Provenance Structure

Every data source must have an entry in the `sources` object of `dashboard-data.json`:

```python
"source_key": {
    "name": "Human-readable name",
    "url": "https://api.endpoint.dk",
    "description": "What data this provides",
    "maintainer": "Responsible organization",
    "license": "CC0 / CC BY 4.0 / CC0-like (PSI-loven)",
    "disclaimer": "Known limitations, caveats, methodology notes",
    "fetchedAt": "2026-03-11T12:00:00+00:00"
}
```

---

## Known Data Quality Caveats

These should be preserved and communicated, not hidden:

1. **Natura 2000 marine/terrestrial split** is heuristic (name-based + area > 10,000 ha). Precise
   classification would require spatial overlay with a coastline dataset.

2. **§3 / Natura 2000 overlap** uses a ~30% estimate. True overlap varies by region and requires
   GIS spatial union computation.

3. **Fredskov ≠ actual forest** — fredskov is a legal designation (land that must remain forested),
   not a measurement of current tree cover.

4. **MARS nitrogen figures are modelled**, not measured. They come from the NKMv2025 model applied
   to project parameters.

5. **WFS data updates are not synchronized with MARS** — geometry data may lag behind project status.

6. **VanDa license is unconfirmed** — currently only station metadata is used. Measurement data
   would require license verification with Danmarks Miljøportal.
