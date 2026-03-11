# MARS Platform (Miljø- og ArealRegistrerings Systemet)

**The single most critical data source for the tracker.** Built by SGAV in collaboration with Danmarks Miljøportal, launched January 29, 2025.

## Four modules

### 1. Screening Module (PUBLIC — no login)
- Anyone can draw polygons on an interactive map
- Shows potential for lowland extraction, afforestation, nitrogen effect
- Useful for understanding site eligibility
- URL: https://mars.sgav.dk

### 2. Planning Module (LOGIN REQUIRED)
- Used by 23 local tripartites to create transformation plans
- Produces coastal water group reports (kystvandgrupperapporter)
- Dynamically shows whether plans meet nitrogen targets
- **Export capability**: CSV lists of projects per coastal water group
- **Export capability**: Shapefiles (.shp) of project areas
- **Print capability**: PDF reports per local tripartite (used for principle adoption)

### 3. Application Module (LOGIN REQUIRED)
- Gateway to formal subsidy application systems
- Project owners register and manage project applications

### 4. Status Module (PUBLIC — no login, since spring 2025)
- Shows aggregate progress: nitrogen, lowland extraction, afforestation
- Navigable by: national → kommune → local tripartite → coastal water group
- Shows project/measure distribution per geographic unit
- Can show sketch projects (added in MARS v2.5)
- **THIS IS THE PRIMARY DATA SOURCE for a public tracker**

## What MARS calculates automatically

For each project/sketch project, MARS calculates:
- **Nitrogen effect** (tonnes N) — based on NKMv2025 retention maps
- **Lowland extraction area** (ha) — using Kulstof2022 overlap logic
- **Afforestation area** (ha) — including untouched forest designation

Nature projects tracked separately (no nitrogen contribution).

## Access limitations (THE CRITICAL GAP)

**No public REST API exists.** This is the single largest bottleneck for an independent tracker.

Current options for data access:
1. **Status module web views** — public, but no machine-readable export
2. **CSV export from planning module** — requires authorized login
3. **Shapefile export from planning module** — requires authorized login
4. **PDF reports** — structured but not machine-readable
5. **Web scraping** — technically possible but fragile (UI changes break scrapers)

## Version history / updates

SGAV publishes release notes for MARS updates:
- https://sgav.dk/groen-trepart/lokale-treparter/mars/opdateringer-til-mars

**Track these closely** — new export capabilities or data layers may be added that change what can be harvested automatically.

## Known data in MARS (as of Feb 2026)

- 1,059+ projects registered
- 236 nitrogen wetlands, 188 lowland, 170 climate-lowland, 255 afforestation
- Status tracked through phases: skitseprojekt → forundersøgelse → etablering → anlagt

## Strategy for accessing MARS data

**Short term**: Semi-automated scraping of public status module views; periodic manual screenshots/data collection for critical metrics.

**Medium term**: Request open data exports or API access from SGAV/Danmarks Miljøportal. Note: MARS is described as being under continuous expansion with new export capabilities.

**Long term**: Advocate for public API (reference: james-langridge/mars-vista-api on GitHub may contain clues about API structure: https://github.com/james-langridge/mars-vista-api/blob/main/openapi.json)

## Key URLs

- MARS portal: https://mars.sgav.dk
- MARS status (lavbund): https://mars.sgav.dk/status/lavbundsindsatsen
- SGAV MARS page: https://sgav.dk/groen-trepart/lokale-treparter/mars
- MARS user guide (PDF): https://sgav.dk/Media/638995678727481039/MARS%20-%20Vejledning.pdf
- Plan format + verification doc: https://sgav.dk/Media/638862809001703401/Bilag%208%20-%20Format%20for%20oml%C3%A6gningsplanen%20i%20MARS%20og%20verificering%20af%20oml%C3%A6gningsplanen%20ved%20SGAV.pdf
- MARS updates: https://sgav.dk/groen-trepart/lokale-treparter/mars/opdateringer-til-mars
