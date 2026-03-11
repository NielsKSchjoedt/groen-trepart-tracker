# Architecture Decision Records

## ADR-001: Data Storage Strategy (RECOMMENDED: Option C — Hybrid)

**Status**: Recommendation ready — pending team discussion

**Context**: The tracker needs to aggregate data from 10+ heterogeneous sources (WFS, REST APIs, PDFs, web scraping) and present it as a coherent dashboard. Two main approaches exist:

### Option A: Data in Git (JAMstack / Static Site)

ETL pipelines run on schedule (GitHub Actions), fetch data, commit structured JSON/GeoJSON files to the repository. Static site generator builds pages from these files.

**Pros**:
- Zero infrastructure cost (GitHub Pages / Cloudflare Pages)
- Full version history of all data via git commits
- Transparent and auditable — anyone can see exactly what changed when
- No database to manage or secure
- Perfect for open-source collaboration
- Resilient: works offline, no server dependencies

**Cons**:
- Repository size grows with data history (mitigated by git-lfs or periodic archiving)
- Limited query capabilities (no spatial queries, no ad-hoc filtering)
- Build times increase with data volume
- Complex spatial operations require pre-computation

**Good fit when**: Data updates are infrequent (weekly/monthly), datasets are small-medium (<100MB), primary use is visualization/dashboards, spatial operations can be pre-computed.

### Option B: Data in Production Server (PostGIS + API)

Traditional stack: ETL pipelines load data into PostGIS, API layer serves data to frontend.

**Pros**:
- Full spatial query support (ST_Intersects, ST_Area, buffer operations)
- Real-time filtering, aggregation, cross-referencing
- Handles large datasets efficiently
- Can serve as data platform for others (API consumers)

**Cons**:
- Infrastructure cost and maintenance
- Database administration overhead
- Less transparent (data changes not git-tracked by default)
- Single point of failure
- Harder for community contributors

**Good fit when**: Frequent updates, large spatial datasets, need for dynamic queries, data platform ambitions.

### Option C: Hybrid (RECOMMENDED for investigation)

Git-backed data files for core metrics + lightweight server for spatial queries.

- Core metrics (hectares, nitrogen, project counts) → JSON in git, updated by scheduled Actions
- Geographic overlays → pre-computed GeoJSON in git for common views
- Complex spatial queries → serverless function with DuckDB/spatial or lightweight PostGIS
- Historical data → git commit history + periodic snapshots

**Recommendation: Option C (Hybrid)** based on investigation findings (March 2026):

1. **Dataset sizes are manageable for git**: MiljøGIS layers are medium-sized GeoJSON (~1-50MB per layer). Denmark has 98 municipalities, 23 catchments, 37 coastal water groups — not "big data". Pre-computed GeoJSON files in git are entirely feasible.

2. **Spatial operations are primarily pre-defined views**: The dashboard shows progress by municipality, catchment, and coastal water group. These are known geographic aggregations that can be pre-computed in the ETL step. No need for ad-hoc spatial queries.

3. **Query pattern is dashboard-driven**: Users will view national → municipal → catchment drill-downs. These are predictable views that can be pre-built as JSON files. Only the "show projects near me" or custom area queries would need dynamic spatial capability.

4. **Community contribution is a priority**: Git-backed data means anyone can submit corrections, add manual data points, or verify MARS scraping results via pull requests. This aligns with the open-source transparency goal.

5. **MARS data uncertainty favors flexibility**: Since MARS may require scraping (fragile, manual) or may reveal a hidden API, the storage layer should not be tightly coupled to a specific ingestion pattern.

**Proposed hybrid architecture**:
- **Primary**: JSON/GeoJSON files in git, updated by GitHub Actions on schedule
- **Build**: Static site (Astro or Next.js static export) consuming these data files
- **Spatial fallback**: Serverless function or edge worker with DuckDB spatial for any dynamic queries
- **Hosting**: GitHub Pages or Cloudflare Pages (free, global CDN)

## ADR-002: Coordinate System

**Status**: Decided

**Decision**: Use EPSG:25832 (ETRS89 / UTM zone 32N) as primary coordinate system for all stored data. Convert to EPSG:4326 (WGS84) only at the presentation layer for web map rendering.

**Rationale**: All Danish environmental data sources use EPSG:25832. Converting at storage time would lose precision and create reconciliation issues with upstream sources.

## ADR-003: Data Format Standards

**Status**: Decided

**Decision**:
- Geometries: GeoJSON (RFC 7946) for interchange, with EPSG:25832 coordinates
- Tabular data: JSON or CSV with ISO 8601 dates
- Time series: JSON arrays with `{ "date": "YYYY-MM-DD", "value": number }` structure
- Metadata: YAML frontmatter in markdown files or JSON sidecar files

## ADR-004: Frontend Framework — Plain HTML + Chart.js

**Status**: Decided (March 2026)

**Decision**: Plain HTML + vanilla JavaScript + Chart.js (from CDN). No build step, no framework, no bundler.

**Options evaluated**:
- Next.js / React with Leaflet or Mapbox GL JS — too heavy, requires Node.js build pipeline
- Astro (static-first, good for JAMstack) — good option but adds build complexity
- SvelteKit (lightweight, good for data visualization) — requires build step
- **Plain HTML + Chart.js + Leaflet (minimal dependencies)** ← Selected

**Rationale**:
1. **Zero build step**: `site/index.html` can be opened directly in a browser or deployed to GitHub Pages without any compilation, bundling, or Node.js dependency.
2. **Community accessibility**: Any developer can contribute by editing a single HTML file. No framework knowledge required.
3. **Alignment with transparency goal**: The dashboard code is a single readable file — anyone can view-source to verify how data is presented.
4. **Data size is manageable**: With 37 plans, 23 catchments, and aggregate statistics, the entire dataset fits comfortably as embedded JSON in the HTML file (~5KB of data). No need for dynamic data fetching on the client side.
5. **Chart.js from CDN**: Provides publication-quality charts with tooltips, animations, and responsive behaviour. ~65KB gzipped. No npm install required.
6. **Leaflet can be added later**: When municipality map features are needed, Leaflet + GeoJSON can be added incrementally without architectural changes.
7. **Performance**: No hydration, no virtual DOM, no JavaScript framework overhead. Instant render.

**Trade-offs accepted**:
- No component reuse system (acceptable for a single-page dashboard)
- Manual DOM manipulation for dynamic features (acceptable at current complexity level)
- Data must be re-embedded in HTML when it updates (handled by ETL build step)

**Structure**: `site/index.html` — single file with embedded data, CSS, and JS.

## ADR-005: ETL Pipeline Technology — GitHub Actions + Python

**Status**: Decided (March 2026)

**Decision**: GitHub Actions with Python scripts. Daily scheduled runs at 06:00 UTC.

**Options evaluated**:
- **GitHub Actions with Python scripts** ← Selected
- Dagster / Prefect (orchestration, observability, retry logic) — overkill for 2 data sources
- Custom Node.js scripts with cron — adds Node.js dependency
- dbt for transformation layer — designed for SQL warehouses, not REST API ingestion

**Rationale**:
1. **Free and git-native**: GitHub Actions is free for public repos, runs are logged, and data commits create automatic version history.
2. **Simple**: Two Python scripts (`fetch_mars.py`, `fetch_dawa.py`) with zero external dependencies (stdlib `urllib` + `json` only).
3. **Transparent**: Every data update is a git commit with a clear message and diff, visible to anyone.
4. **Reliable enough**: Daily cron schedule, manual dispatch for ad-hoc updates, simple retry logic (GitHub Actions retries by default).

**Structure**:
- `etl/fetch_mars.py` — fetches 5 MARS API endpoints
- `etl/fetch_dawa.py` — fetches DAWA municipality data
- `etl/assemble_data.py` — fallback for sandboxed environments (browser-extracted data)
- `etl/fetch_all.sh` — orchestration script
- `.github/workflows/fetch-data.yml` — scheduled GitHub Actions workflow
