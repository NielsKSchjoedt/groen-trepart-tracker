# MARS Platform (Multifunktionel Arealregistrering)

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

## Data access (public REST API + official WFS)

**Update (March 2026): a public, unauthenticated MARS REST JSON API was found** and is now the tracker's primary data source — what was previously documented here as "THE critical gap" is resolved. The status module is backed by JSON endpoints returning projects, plans, catchment aggregations and master data; `etl/fetch_mars.py` pulls them daily, and `etl/fetch_geometries.py` fetches full-resolution project polygons. See `docs/data-sources/investigation-results.md` and `docs/references/urls.md` for the concrete endpoints.

### Official WFS (since 2026-11 the source of the flat project list and all project/sketch polygons)

MARS also publishes an **official, documented WFS** at `https://mars.sgav.dk/geo/wfs`
(GeoServer, no key, refreshed nightly ~01:00 UTC). Layers:

| Layer | Rows (2026-11-06) | Content |
|---|---|---|
| `mars:projekter_samlet` | 1,668 | Every project in a formal phase: `mars_id` (= REST `projectId`), titel, sags_id, areal_ha, tilskudsordning, status (name), ansoeger, ansoegningsrunde_aar, kvaelstofeffekt_t, udtagningseffekt_ha, skovrejsningseffekt_ha, forundersoegelsestilsagn_dato, etableringstilsagn_dato, anlaegelse_dato, virkemiddel, MultiPolygon |
| `mars:projekter_status_forundersoegelsestilsagn` | 732 | Status-6 subset of the above (+ `medregnes`) |
| `mars:skitseprojekter` | 5,012 | Sketches; `mars_id` = REST `sketchProjectId`; whole-sketch effects (not split per kystvandgruppe) |
| `mars:naturpotentialer` | 258 | Nature potentials (no biodiversity / Natura 2000 overlaps) |
| `mars:projekter_tilskudsordning_skovrejsning` | 1,185 rows / 540 projects | One row per forest sub-polygon (`geometri_type`: Projektpolygon, Tilskudsberettiget areal, Urørt skov, Lysåbne arealer, …); also projects not yet in a formal phase (Ansøgt, Høring) |
| `mars:hensigtserklaeringer` | 278 | Hensigtserklæringer (midlertidig ekstensivering) |

Same-day comparison against REST (2026-11-06): ids, names, effects, areal, scheme and
measure (by name via master-data), status (by state name: 6 Forundersøgelsestilsagn,
10 Etableringstilsagn, 15 Anlagt) identical for all 1,668 projects; `lastStateChanged`
= the WFS date of the current phase for all 1,667 unchanged projects; every project and
sketch polygon `equals_exact` (1e-6 m) the REST `/api/geometries/{geoLocationId}` WKT.

How the tracker uses it (`etl/mars_wfs.py`):
- `fetch_mars.py` builds `data/mars/projects.json` from `mars:projekter_samlet` (+ forest
  sub-polygons as `supplementaryGeometries`) in the REST row shape, adding `sagsId`,
  `ansoeger`, `ansoegningsrundeAar` and the three phase dates. `geoLocationId` and
  `applicationTimestamp` (not in the WFS) come from the project's row in `/status/plans`.
- The WFS is a nightly snapshot while `/status/plans` and `/status/municipality` are live.
  Projects created or re-phased since the refresh (seen: 3 of 1,670 by evening; historically
  ~1 % of state changes fall in the 01–06 UTC window before the daily run) are detected
  against the live plans and taken from REST `/status/projects` (`source: "rest-fallback"`),
  so one build never mixes two moments. `summary.json → projectsSource` records the counts.
- `fetch_geometries.py` takes project and sketch polygons from two bulk WFS requests
  (~10 s instead of ~6,700 single REST calls, 20–38 min cold) and only calls
  `/api/geometries/{id}` for ids newer than the nightly refresh.
- Known source differences: REST lists empty "Urørt skov"/"Ekstra tilskudsareal" placeholders
  (no polygon, no area) that the WFS omits — urørt skov is therefore counted only where a
  polygon exists (9 projects / 18 polygons / 30,7 ha, vs 11 / 22 / 30,7 ha incl. placeholders).

Must stay on REST (no WFS equivalent): `/status/plans` (sketch and nature-potential effects
split per kystvandgruppe; nature-potential biodiversity/§3/Natura 2000 overlaps),
`/status/municipality`, `/status/vos`, `/master-data`, `/status/metadata`,
`/status/permanent-ekstensivering`, `/status/projects/history`.

Still login-gated (not required by the tracker):
1. **CSV / shapefile export from the planning module** — authorized login
2. **Planning module** detail data — negotiated access with SGAV

## Version history / updates

SGAV publishes release notes for MARS updates:
- https://sgav.dk/groen-trepart/lokale-treparter/mars/opdateringer-til-mars

**Track these closely** — new export capabilities or data layers may be added that change what can be harvested automatically.

## Known data in MARS (as of Feb 2026)

- 1,059+ projects registered
- 236 nitrogen wetlands, 188 lowland, 170 climate-lowland, 255 afforestation
- Status tracked through phases: skitseprojekt → forundersøgelse → etablering → anlagt

## Working with the MARS API

The public REST API (above) is the primary path and removed the need for scraping. Ongoing practice:
- **Track MARS release notes** for new endpoints, fields or data layers that change what can be harvested (see updates URL below).
- **Re-validate the endpoints** when MARS ships a major version — field names and phase states have changed across releases.
- For data still behind login (planning-module CSV/shapefile), request open exports from SGAV / Danmarks Miljøportal as needed.

## Key URLs

- MARS portal: https://mars.sgav.dk
- MARS status (lavbund): https://mars.sgav.dk/status/lavbundsindsatsen
- SGAV MARS page: https://sgav.dk/groen-trepart/lokale-treparter/mars
- MARS user guide (PDF): https://sgav.dk/Media/638995678727481039/MARS%20-%20Vejledning.pdf
- Plan format + verification doc: https://sgav.dk/Media/638862809001703401/Bilag%208%20-%20Format%20for%20oml%C3%A6gningsplanen%20i%20MARS%20og%20verificering%20af%20oml%C3%A6gningsplanen%20ved%20SGAV.pdf
- MARS updates: https://sgav.dk/groen-trepart/lokale-treparter/mars/opdateringer-til-mars
