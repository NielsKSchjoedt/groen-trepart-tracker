# Automation Assessment

## Per-source feasibility

| Source | Type | Auth | Format | Auto Level | Update Freq | Priority |
|--------|------|------|--------|-----------|-------------|----------|
| MARS Status Module | Web scraping | None (public) | HTML (no API) | ⚠️ Fragile | Weekly check | 🔴 Critical |
| MiljøGIS WFS | OGC WFS 2.0 | None (public) | GeoJSON/GML | ✅ High | Monthly | 🔴 Critical |
| DAWA | REST API | None (public) | JSON/GeoJSON | ✅ High | Rarely changes | 🟡 Important |
| Vandplandata.dk | File download | None (public) | Shapefile | ✅ High | Per plan period | 🟡 Important |
| Danmarks Statistik | REST API | None (public) | CSV/JSON | ✅ High | Annual | 🟢 Nice-to-have |
| VanDa API | REST API | OAuth2 | JSON | ✅ High (with auth) | Monthly | 🟡 Important |
| NaturRestService | REST API | OAuth2 | JSON | ✅ High (with auth) | Monthly | 🟢 Nice-to-have |
| EA-Tools API | REST API | MitID Erhverv | GeoJSON | ✅ High (restricted) | On demand | 🟢 Nice-to-have |
| LandbrugsGIS | File download | None (public) | Shapefile | ✅ High | Annual | 🟢 Nice-to-have |
| NOVANA reports | PDF extraction | None (public) | PDF | ⚠️ Low | Annual | 🟡 Important |
| MARS Planning (CSV) | Export | Login required | CSV | ❌ Blocked | N/A | 🔴 Critical (blocked) |
| Municipal minutes | Web crawl + NLP | None (public) | HTML/PDF | ⚠️ Very fragile | Ongoing | 🟢 Nice-to-have |

## Automation tiers

### Tier 1: Fully automatable (~40% of desired metrics)

Sources with stable, documented APIs or standard protocols. Can run unattended on schedule.

- MiljøGIS WFS layers (environmental projects, water plans)
- DAWA boundaries (municipalities, regions)
- Vandplandata shapefiles (water body targets)
- Danmarks Statistik API (baselines)
- LandbrugsGIS shapefiles (agricultural overlays)

**Tech stack**: Python with `requests`, `geopandas`, `owslib` for WFS, scheduled via GitHub Actions.

### Tier 2: Automatable with effort (~20%)

Require authentication setup, careful error handling, or format conversion.

- VanDa REST API (needs OAuth2 token management)
- NaturRestService (needs OAuth2)
- MARS status scraping (fragile, needs maintenance)

**Tech stack**: Python with `playwright` or `selenium` for scraping, `authlib` for OAuth2.

### Tier 3: Semi-manual (~30%)

PDF extraction, web page transcription, requires human verification.

- NOVANA annual reports (PDF tables → structured data)
- SGAV press releases (key figures manually extracted)
- Reference value tables (PDF → JSON, one-time with annual updates)

**Tech stack**: `pdfplumber` or `camelot` for table extraction, manual verification step.

### Tier 4: Currently inaccessible (~10%)

Requires negotiation, legal requests, or access grants.

- MARS project-level data (login-only planning module)
- Individual project subsidy details (not public)
- Municipal co-financing data (internal reports)

**Strategy**: Miljøoplysningsloven (Environmental Information Act) requests, direct engagement with SGAV.

## Key insight

**If MARS API access is secured, the tracker jumps from ~40% to potentially 90%+ automation.** This makes MARS API advocacy the single highest-leverage action for the project.

## Recommended first implementation

1. Set up GitHub Actions workflow skeleton
2. Implement MiljøGIS WFS fetcher (most reliable, immediate value)
3. Implement DAWA boundary fetcher (one-time, enables geography)
4. Investigate MARS status module network requests (browser dev tools)
5. Build MARS scraper if hidden API found, manual fallback otherwise
6. Implement Vandplandata target loader
7. Add data validation and deduplication layer
8. Connect to static site build pipeline
