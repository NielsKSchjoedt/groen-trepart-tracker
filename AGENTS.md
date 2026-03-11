# Den Grønne Trepart – Public Implementation Tracker

## Project overview

An open-source public tracker website monitoring the implementation of Denmark's Green Tripartite agreement ("Aftale om et Grønt Danmark", June 2024). The agreement commits to converting 140,000 ha of carbon-rich lowland soils by 2030 and 250,000 ha of new forest by 2045 — the largest landscape transformation in Denmark in over 100 years, backed by DKK 43 billion.

**Goal**: A radically transparent, data-driven platform that enables citizens, journalists, and researchers to assess whether implementation is on-track or off-track — similar to how SSI's COVID dashboards made pandemic data accessible.

**Core question the tracker answers**: "Er Den Grønne Trepart på sporet?"

## Key targets

- **140,000 ha** carbon-rich lowland soils withdrawn/rewetted by 2030 (incl. buffer zones)
- **250,000 ha** new forest by 2045
- **13,800 tonnes N/year** reduction via collective measures
- **7,500 km** watercourse restoration + **1,500 barrier removals**
- **20% protected nature** by 2030

## Architecture (recommended: Hybrid — Option C)

See `docs/architecture/decisions.md` for full ADR. Recommendation: **git-backed data files + static site + optional serverless spatial fallback**. Rationale: datasets are small enough for git, views are pre-defined, community contribution via PRs aligns with transparency goal, and MARS data uncertainty favors loose coupling.

## Knowledge structure

```
docs/
├── domain/                    # What the project is about
│   ├── overview.md            # Political agreement, targets, timeline
│   ├── governance.md          # 23 local tripartites, SGAV, MGTP hierarchy
│   ├── metrics-taxonomy.md    # 4-layer metric model (governance → outcomes)
│   └── geographic-model.md    # Catchments, coastal water groups, municipalities
├── data-sources/              # Where data comes from
│   ├── mars-platform.md       # MARS modules, access levels, export options
│   ├── miljoeportal-apis.md   # Danmarks Miljøportal, WFS/WMS, REST APIs
│   ├── novana-monitoring.md   # Scientific monitoring programme
│   ├── geographic-data.md     # DAGI, DAWA, GeoDanmark, Dataforsyningen
│   ├── data-gaps.md           # Known barriers, PDF-locked data, access issues
│   └── investigation-results.md # Live probe results from March 2026
├── architecture/              # How we build it
│   ├── decisions.md           # Architecture decision records
│   ├── data-model.md          # PostgreSQL/PostGIS schema proposal
│   ├── harvesting-strategy.md # 3-track ETL pipeline approach
│   └── automation-assessment.md # What can/cannot be automated
└── references/                # Quick-lookup resources
    ├── urls.md                # All key URLs by category
    └── glossary.md            # Danish/English terms, acronyms
```

## Development conventions

- **Language**: Danish for domain docs and user-facing content; English for code and technical docs
- **Coordinate system**: EPSG:25832 (ETRS89/UTM zone 32N) for all Danish geodata; transform to EPSG:3857 for web rendering
- **GeoJSON**: RFC 7946 standard
- **Data format**: Prefer GeoJSON and JSON; CSV as fallback
- **Spatial DB**: PostGIS on PostgreSQL (recommended by all research sources)

## Current phase

**Phase 0: Knowledge Foundation** ✅ Complete — 17 structured docs (1,637 lines) synthesized from 3 AI research sessions.

**Phase 1: Data Source Validation** ✅ Complete (March 2026). Key findings:
- ✅ **MARS REST API**: Public, unauthenticated JSON API discovered via browser DevTools. 6 working endpoints returning project data, plans, catchment aggregations, and master data. **This was the critical breakthrough** — MARS went from "THE blocker" to "the primary data source."
- ✅ MiljøGIS WFS: public, working GeoServer, returns GeoJSON with project geometries
- ✅ DAWA API: public, no auth, returns municipality data with boundaries
- ✅ Danmarks Statistik API: public, no auth, ready to use
- ✅ VanDa API: documented REST + Swagger, needs OAuth2 registration
- ⚠️ MARS GeoServer: requires authenticated session (not blocking — project data available via REST)
- ❌ MARS Planning Module: login-only, requires negotiation with SGAV

**Phase 2: ETL Pipeline & Data Collection** ✅ Complete (March 2026). Built automated data fetchers:
- `etl/fetch_mars.py` — fetches 5 MARS API endpoints (plans, projects, vos, metadata, master-data)
- `etl/fetch_dawa.py` — fetches DAWA municipality data + GeoJSON boundaries
- `etl/assemble_data.py` — fallback assembler for sandboxed environments
- `.github/workflows/fetch-data.yml` — daily scheduled GitHub Actions at 06:00 UTC

**Key real data extracted** (March 2026):
- National nitrogen reduction: 3,433 T achieved of 12,769 T goal (~27%)
- 1,164 projects: 80 established, 634 approved, 450 in preliminary study, 5,260+ sketches
- 37 coastal water group plans with per-group progress breakdowns
- 23 catchment areas with nitrogen, extraction, and afforestation metrics
- 98 municipalities with geographic center coordinates

**Phase 3: Dashboard / Static Site** ✅ v1 Complete (March 2026).
- `site/index.html` — single-file dashboard, plain HTML + Chart.js (CDN), zero build step
- KPI cards: nitrogen progress, project counts, deadline countdown
- Project pipeline visualization (sketch → forundersøgelse → godkendt → anlagt)
- Interactive stacked bar charts for 37 kystvandgrupper and 23 vandoplande
- Sortable data tables with mini progress bars
- Subsidy scheme reference table (17 ordninger)
- Fully responsive, Danish-language, accessible
- ADR-004 decided: Plain HTML + Chart.js. ADR-005 decided: GitHub Actions + Python.

**Next**:
- Push to GitHub and deploy to GitHub Pages
- Add Leaflet map with municipality overlay (GeoJSON data already available)
- Add historical data tracking (git-committed time series)
- Investigate MiljøGIS WFS integration for project geometries
- Register for VanDa API OAuth2 access

## Learning loop

This project uses a domain learning loop to capture and consolidate knowledge across sessions. See `.skills/learning-loop/SKILL.md` for the full process.

- **`docs/Learnings.md`** — Working scratchpad where new insights land first (timestamped, categorized, confidence-rated)
- **`docs/`** — Structured knowledge base where high-confidence learnings get consolidated

When working on this project, watch for corrections, data source discoveries, policy clarifications, and naming/geographic insights. Capture them to `docs/Learnings.md` and periodically consolidate into the appropriate doc.

## Research sources

Original research documents are in `transcripts_and_research/`:
- `Open Source Miljø Tracker Research.md` — Gemini deep research (most comprehensive on data infrastructure)
- `compass_artifact_wf-*.md` — Claude/Compass research (strongest on governance, metrics taxonomy, data schema)
- `deep-research-report.md` — ChatGPT deep research (strongest on dataset inventory and automation assessment)
- `ChatGPT-Idé og mailhjælp.md` — Original idea development conversation
- `1000011611.jpg` — Original email to Danmarks Naturfredningsforening
