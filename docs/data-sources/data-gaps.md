# Data Gaps & Access Barriers

## Gap 1: No public API for MARS (CRITICAL)

**Impact**: Blocks real-time automated tracking of the most important implementation data.

MARS status module is public (no login), but:
- No documented REST API for machine-to-machine access
- No open JSON/CSV export from status views
- Detailed project data (individual boundaries, status, effects, timelines) requires authorized login
- CSV/Shapefile export only available in planning module (login required)

**Workarounds**:
- Web scraping of public status module (fragile — breaks on UI updates)
- Manual periodic data collection
- Request API access from SGAV/Danmarks Miljøportal
- Monitor MARS release notes for new export capabilities

**Potential lead**: `github.com/james-langridge/mars-vista-api` contains an OpenAPI spec that may reveal MARS API structure.

## Gap 2: PDF-locked data ("PDF-fælden")

Essential data trapped in static document formats:

- **Reference values for watercourse restoration**: Annual index-regulated prices in PDF tables (e.g., remeandering: 73,418 kr/km, otter fence: 33,038 kr/piece). Not in any database.
- **NOVANA annual reports**: 100+ page PDFs from DCE. Underlying raw data technically in Miljøportal systems but requires expert navigation.
- **Technical ecological standards**: DTU Aqua guidelines for spawning banks (5‰ fall, 10-60mm gravel, 20-30cm depth), fish screen requirements (max 1mm mesh) — only in academic reports, not as metadata in project databases.
- **NKMv2025 retention data**: High-resolution spatial data, but often presented aggregated or in heavy modelling reports.

**Impact**: ~30% of desired metrics require PDF parsing or manual extraction.

## Gap 3: Aggregate-only reporting

The most politically salient metric (hectares completed vs target) exists only in:
- Press releases and news articles
- Web page figures on SGAV website
- Semi-annual collective measures status reports (web figures + PDF)

**NOT available as**: downloadable structured dataset, API, or machine-readable format.

As of Nov 2025: **187 ha completed** vs **140,000 ha target** — but this data point exists only in press releases.

## Gap 4: Municipal process data fragmentation

- Principle adoption decisions: Scattered across 98 municipal council minutes (teknik- og miljøudvalg, byråd)
- Would require advanced web crawlers (RPA) + NLP to automate collection
- Not centralized until reflected in MARS

## Gap 5: Barrier removal tracking

Individual barrier status (removed vs remaining) not available as queryable dataset. Only aggregate figures exist (e.g., "~450 barriers removed in VP2").

## Gap 6: Financial/subsidy data

- Individual project tilsagn details (amounts, boundaries, effect estimates) not public
- Tast Selv application data not accessible
- Budget vs realized for municipal co-financing only in internal municipal reports
- Would likely require Freedom of Information (aktindsigt) requests

## Gap 7: Temporal lag

- NOVANA: ~12 months between monitoring year and publication
- Vandplandata: reflects plan-period assessments, not real-time
- SGAV status reports: approximately annually
- Creates diverging picture: administrative success visible in MARS while ecological reality invisible for years

## Gap 8: Non-state projects

Projects without state subsidy/anchoring (foundations, LIFE, private) — SGAV has ambition to include in MARS but not fully implemented as open data yet.

## Automation feasibility summary

| Category | % of desired metrics | Approach |
|----------|---------------------|----------|
| **Fully automatable** (GIS/API sources) | ~40% | WFS polling, REST API calls (weekly-monthly) |
| **Moderate effort** (structured processing) | ~20% | NOVANA data parsing, format-dependent maintenance |
| **Manual processing** (PDF/web scraping) | ~30% | PDF extraction, web page transcription (quarterly-annually) |
| **Currently inaccessible** (requires negotiation) | ~10% | MARS project-level data, internal municipal tracking |

**Key insight**: If MARS API access is secured, the tracker jumps from ~40% to potentially 90%+ automation.

## Legal framework for data access

Two relevant laws:
- **Offentlighedsloven** (Freedom of Information Act): General right to access documents in public administration
- **Miljøoplysningsloven** (Environmental Information Act): Broader access rights for environmental data, especially emissions data — often more favorable than general FOI

**Strategy**: Use Miljøoplysningsloven when requesting environmental data — it limits grounds for refusal, especially for emission-related information.
