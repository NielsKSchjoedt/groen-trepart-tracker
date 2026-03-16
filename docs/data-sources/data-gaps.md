# Data Gaps & Access Barriers

## Gap 1: MARS API — RESOLVED (March 2026)

**Status**: Resolved. An unauthenticated REST API was discovered via browser DevTools at `mars.sgav.dk/api` and is now the project's primary data source.

**Implementation**: `etl/fetch_mars.py` polls 5 JSON endpoints daily via GitHub Actions:
- `/api/master-data` — subsidy schemes, project states, national goals
- `/api/status/plans` — 37 coastal water group plans with N-reduction targets
- `/api/status/projects` — all ~6,000+ projects with status and metrics
- `/api/status/vos` — 23 vandopland (main catchment) aggregations
- `/api/status/metadata` — national goals and plan definitions

**Remaining caveat**: The API is not officially documented by SGAV/Miljøstyrelsen. There is no guarantee of long-term stability or backward compatibility. The ETL pipeline handles errors gracefully and logs failures to `data/etl-log.json`.

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
| **Fully automatable** (GIS/API sources) | ~70% | MARS REST API + WFS polling + REST APIs (daily via GitHub Actions) |
| **Moderate effort** (structured processing) | ~15% | NOVANA data parsing, format-dependent maintenance |
| **Manual processing** (PDF/web scraping) | ~10% | PDF extraction, web page transcription (quarterly-annually) |
| **Currently inaccessible** (requires negotiation) | ~5% | MARS Planning Module (login-only), internal municipal tracking |

**Key insight**: With the MARS REST API discovery (March 2026), automation jumped from ~40% to ~70%. The remaining gaps are mainly PDF-locked data and sources requiring OAuth2 registration (VanDa).

## Legal framework for data access

Two relevant laws:
- **Offentlighedsloven** (Freedom of Information Act): General right to access documents in public administration
- **Miljøoplysningsloven** (Environmental Information Act): Broader access rights for environmental data, especially emissions data — often more favorable than general FOI

**Strategy**: Use Miljøoplysningsloven when requesting environmental data — it limits grounds for refusal, especially for emission-related information.
