# ETL pipeline overview

How raw public data becomes the JSON/GeoJSON the React app renders. This is a
map of the moving parts — the source of truth for *what runs* is `etl/`,
`scripts/`, `mise.toml` and `.github/workflows/`. For *where each number comes
from* see [`../../DATA_SOURCES.md`](../../DATA_SOURCES.md) and
[`../data-sources/`](../data-sources/); for the "data in git, static site"
decision see [`decisions.md`](./decisions.md) (ADR-001, ADR-005).

## Data flow

```
public APIs / WFS / WMS / PDFs
        │   etl/fetch_*.py            (fetchers — pull raw data)
        ▼
   data/<source>/                     (raw + lightly-shaped source data, committed to git)
        │   etl/build_*.py            (builders — aggregate, enrich, compute)
        ▼
   data/dashboard-summary.json, data/project-details.json,
   data/kommune-benchmark/*, data/*.geojson, …
        │   copied / built into
        ▼
   public/data/…                      (what the browser fetches)
        │   Vite build (npm run build)
        ▼
   static site  →  Cloudflare Pages
```

Everything is committed to git, so each data refresh is a reviewable diff and the
site has no backend. Coordinates are handled in EPSG:25832 (ETRS89/UTM 32N) and
reprojected to EPSG:3857/WGS84 for the web layers.

## 1. Daily pipeline — API data

Runs in `.github/workflows/fetch-data.yml` (and locally via `mise run fetch-data`
→ `etl/fetch_all.sh`). Fetchers are Python-stdlib-only (the one exception is
`build_co2_data.py`, which needs `openpyxl`), so this pipeline stays cheap and
dependency-light.

- **Fetchers** (`etl/fetch_*.py`): MARS (projects, plans, nitrogen — the primary
  source), DAWA (municipalities/boundaries), MiljøGIS WFS (project geometries),
  Danmarks Statistik, VanDa, Natura 2000, §3, fredskov, Klimaskovfonden,
  Naturstyrelsen skov, KF25, project geometries, Klimaregnskabet (needs
  `KLIMAREGNSKAB_API_KEY`), Klimarådet (URL/timestamp check), Arealdata
  biodiversitet, FVM Markkort (VNS 2026).
- **Builders** (`etl/build_*.py`): `build_dashboard_data.py` (emits the split
  `dashboard-summary.json` + `project-details.json`), `build_co2_data.py`,
  `build_klimaregnskab_data.py`. The MARS five-phase aggregation lives in
  `mars_pipeline_s2.py`; the Sprint-1 national merge in `merge_sprint1_national.py`.

The bot opens a PR with the refreshed data (branch protection blocks direct push
to `main`).

## 2. Monthly pipeline — spatial overlays

Runs in `.github/workflows/spatial-overlay.yml` (monthly + manual dispatch). These
are the heavy GeoPandas/Shapely/Rtree jobs, kept out of the daily run; they need
the optional deps in `etl/requirements-spatial.txt` (`mise run setup-spatial`).

- `fetch_marker2026.py`, `fetch_section3_by_kommune.py` — per-municipality polygon
  fetches.
- `build_kommune_benchmark.py` — the kommune nature benchmarks **B1–B4** (DCE 30 %,
  KU prio 1+2, Markkort 2026, Natura 2000), with sanity checks that fail the build.
- `build_project_nature_overlap.py` — per-project overlap with §3 / Natura 2000 /
  biodiversity, attributed (clipped) to municipality.
- `build_kommune_ranking.py`, `build_kommune_oplande.py` — the kommune ranking and
  kommune × water-catchment overlap.
- `kommune_area_clip.py`, `spatial_overlay.py`, `spatial_utils.py` — shared spatial
  helpers.

The full-resolution DCE layer is only materialised here (`--full-dce`); the daily
biodiversity fetch counts hits only.

## 3. Map data prep — TopoJSON / simplified layers

Run on a machine with the CLI tools, not in CI (`mise run prepare-map` →
`etl/prepare_map_data.sh`, plus `build_kommune_topojson.py`,
`build_natura2000_map.py`, `build_section3_map.py`). Produces the web-ready
boundary TopoJSON and the simplified national overlays
(`public/data/natura2000-simplified.geojson`, `section3-simplified.geojson`).
Needs `topojson-*` and `mapshaper` (`mise run setup`).

## 4. Frontend content build

Node scripts in `scripts/`, run as part of `npm run build`:

- `build-videnscenter.mjs` — compiles `content/videnscenter/*.md` →
  `public/data/videnscenter/articles.json`.
- `build-trepart-links.mjs` — `data/kommune-trepart-links.csv` →
  `public/data/kommune-trepart-links.json`.
- `generate-changelog.mjs` — regenerates `CHANGELOG.md` from
  `src/lib/changelog.json` (run via `mise run changelog`; see the changelog rules
  in [`../../AGENTS.md`](../../AGENTS.md)).

## Workflows at a glance

| Workflow | Trigger | Does |
|---|---|---|
| `fetch-data.yml` | daily + dispatch | Daily API pipeline → data PR |
| `spatial-overlay.yml` | monthly + dispatch | GeoPandas benchmarks & overlaps |
| `ci.yml` | push / PR | lint, typecheck, build, JS + Python tests |
| `preview-deploy.yml` | PR | Cloudflare Pages preview build |

## Conventions

- Fetchers are stdlib-only where possible; heavy GIS deps are isolated to the
  monthly spatial pipeline.
- `data/` is the committed source-of-record; `public/data/` is what ships. Builders
  write both where the app reads from `public/`.
- Re-validate MARS endpoints and field names after a major MARS release — phase
  states have changed across versions.
