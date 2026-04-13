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

## Changelog requirements

**Every commit that changes user-facing data, UI, or methodology must update the changelog.**

There is **one place to write**: `src/lib/changelog.json`. Everything else is generated or derived from it.

| File | Role | Edit? |
|---|---|---|
| `src/lib/changelog.json` | **Single source of truth** — all entries live here | ✅ Yes |
| `CHANGELOG.md` | Auto-generated Markdown for GitHub browsing | ❌ No — run `mise run changelog` to regenerate |
| `src/lib/changelog.ts` | TypeScript types + JSON import for React rendering | ❌ No — only edit if types change |

**Workflow:**
1. Add your entry to `src/lib/changelog.json`
2. Run `mise run changelog` to regenerate `CHANGELOG.md` and sync the version number
3. Commit both files together

### Writing standard: plain language first

**The primary audience is ordinary people — journalists, citizens, and interested readers with no technical background.**

Before writing a changelog entry, ask: *would a journalist understand what changed and why it matters without needing to know what a component, API, or database is?*

Rules:
- Write in plain Danish. Describe the user-visible effect, not the code change.
- Technical references (component names, commit hashes, API endpoints, library names) go in parentheses at the end, or are omitted entirely.
- Never start with a technical term. Start with what the user experienced.

**Bad:** "Refactored ArcGauge SVG viewBox to fix label overflow in constrained bounding box."

**Good:** "Tal og etiketter på fremgangsmålerne overlappede hinanden og var svære at læse. Rettet. *(Teknisk: SVG viewBox justeret.)*"

### Change types

| Type | Label (Danish) | When to use |
|---|---|---|
| `feature` | Ny funktion | New user-facing capability |
| `improvement` | Forbedring | Enhancement to existing feature |
| `fix` | Fejlrettelse | Bug fix or data/calculation correction |
| `data` | Dataopdatering | New or refreshed data fetched from APIs |
| `method` | Metodeændring | Change in how numbers are calculated or displayed |
| `removed` | Fjernet | Removed feature or data source |

### Corrections and fixes: full transparency required

**Fejlrettelse** (`fix`) and **Metodeændring** (`method`) entries must document:

1. **What users saw that was wrong** — in plain terms, not technical jargon
2. **What has been corrected** — what users will now see instead
3. **GitHub issue URL** — if an issue was filed, include it in the `issueUrl` field

Example entry in `src/lib/changelog.json`:
```json
{
  "type": "fix",
  "description": "Fremgangen for kvælstofreduktion viste 3.433 tons som opnået, men det korrekte tal er 26 tons faktisk etableret. Fejlen skyldtes at projekter i planlægningsfasen fejlagtigt blev talt med som gennemført. Rettet. (Teknisk: summering i build_dashboard_data.py begrænsede til fasen \"anlagt\".)",
  "issueUrl": "https://github.com/NielsKSchjoedt/groen-trepart-tracker/issues/42"
}
```

Then run `mise run changelog` — CHANGELOG.md is generated automatically. No need to write Markdown manually.

### Transparency principle

Dokumentation af fejl er ikke pinligt — det er kernen i produktets troværdighed. Dette projekt eksisterer for at skabe gennemsigtighed om Den Grønne Treparts implementering. Den gennemsigtighed gælder også vores egne fejl. Korrektioner dokumenteres med **mindst samme prominens** som nye funktioner. Hvis en fejl opdages af en ekstern bruger, journalist eller forsker, skal det fremgå tydeligt af ændringsloggen.

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
- `etl/fetch_klimaregnskab.py` — fetches per-municipality CO₂ data from Klimaregnskabet API (requires API key)
- `etl/build_klimaregnskab_data.py` — transforms raw CO₂ data to dashboard format
- `etl/assemble_data.py` — fallback assembler for sandboxed environments
- `.github/workflows/fetch-data.yml` — daily scheduled GitHub Actions at 06:00 UTC

## API keys and secrets

Some ETL fetchers require API keys. Keys are stored in `.env` locally (never committed — see `.gitignore`) and as GitHub repository secrets for CI.

| Variable | Used by | How to obtain |
|---|---|---|
| `KLIMAREGNSKAB_API_KEY` | `etl/fetch_klimaregnskab.py` | Register at https://klimaregnskabet.dk/klimaregnskabet-api (free, name + email) |

See `.env.example` for the template. To set up locally:
```bash
cp .env.example .env
# Edit .env and fill in your key
```

To add to GitHub Actions: Settings → Secrets and variables → Actions → New repository secret → name `KLIMAREGNSKAB_API_KEY`.

**Key real data extracted** (March 2026):
- National nitrogen reduction: 3,433 T total pipeline (all phases incl. preliminary). Actually established (built): ~26 T. Goal: 12,769.5 T (sum of 37 plan targets; master-data reports rounded national figure of 12,776 T).
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

## Cursor Cloud specific instructions

### Services

| Service | Command | Port | Notes |
|---|---|---|---|
| Vite dev server | `npm run dev` | 8080 | Main frontend; serves React + TypeScript dashboard |

The ETL pipeline (`etl/*.py`) is optional for frontend development — pre-built data files are committed under `data/` and `public/data/`.

### Key commands

All standard commands are in `package.json` scripts and `mise.toml` tasks. Quick reference:

- **Dev server:** `npm run dev` (port 8080)
- **Lint:** `npm run lint`
- **Typecheck:** `npm run typecheck`
- **Unit tests:** `npm run test` (Vitest)
- **Build:** `npm run build`
- **All checks:** `npm run ci` (lint → typecheck → build → test)

### Gotchas

- `.npmrc` sets `legacy-peer-deps=true` — this is intentional and required for the current dependency tree.
- `mise.toml` defines Node 22 + Python 3.12 as project tools, but the VM already has Node 22 via nvm — no need to install mise separately.
- Playwright tests (`playwright.config.ts`, `tests/` dir) exist but the test directory is currently empty. Playwright browsers are not pre-installed; run `npx playwright install chromium` if you need them.
- The `KLIMAREGNSKAB_API_KEY` env var is only needed for `etl/fetch_klimaregnskab.py`; it is not required for frontend development or testing.
