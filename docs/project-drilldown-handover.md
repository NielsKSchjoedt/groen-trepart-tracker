# Project Drill-Down Feature — Handover Notes

**Date:** 2026-03-11
**Author:** Claude (via Cowork session with Niels Kristian)

## What was built

A project drill-down feature that lets users click into a plan (e.g. "Odense Fjord") on the detail panel and see every individual project — its name, type, phase, metrics, dates, and subsidy scheme link.

Previously the detail panel only showed aggregate counts (e.g. "363 Skitser, 13 Vurderet, 26 Godkendt, 1 Anlagt"). Now you can explore what those projects actually are.

## Files changed

### 1. `etl/build_dashboard_data.py` (541 → 614 lines)

**New lookup dicts** (lines 82–84):
```python
measure_lookup = {m["id"]: m for m in master.get("mitigationMeasures", [])}
scheme_lookup = {s["id"]: s for s in master.get("subsidySchemes", [])}
```

**Three new enrichment functions** (lines 117–180):
- `enrich_project(p)` — Takes a raw MARS project dict, joins with `state_lookup`, `measure_lookup`, `scheme_lookup` to produce a flat dict with human-readable names, phase classification, metrics, and timestamps.
- `enrich_sketch(s)` — Same for sketch projects (early-stage, no formal status).
- `slim_nature_potential(np_item)` — Extracts the relevant fields from nature potential entries including area breakdowns (biodiversity, Natura 2000, §3, protected nature overlaps).

**Per-plan detail arrays** (lines 449–451):
Each plan entry now includes three additional arrays:
```python
"projectDetails": [enrich_project(proj) for proj in plan_projects],
"sketchProjects": [enrich_sketch(sp) for sp in p.get("sketchProjects", [])],
"naturePotentials": [slim_nature_potential(np_item) for np_item in p.get("naturePotentials", [])],
```

**Subsidy scheme URL** added to the reference array (line 379) — `"url": s.get("url", "")`.

**Impact:** `dashboard-data.json` grew from ~80 KB to ~3.1 MB. This is because all ~1,167 projects + ~2,600 sketches + nature potentials are now inline per plan. The file is fetched once at runtime, so this is acceptable.

### 2. `src/lib/types.ts` (84 → 132 lines)

Three new interfaces added:

```typescript
export interface ProjectDetail {
  id: string; name: string;
  phase: 'preliminary' | 'approved' | 'established';
  statusName: string; statusNr: number;
  measureName: string;
  schemeName: string; schemeOrg: string; schemeUrl: string;
  nitrogenT: number; extractionHa: number; afforestationHa: number; areaHa: number;
  appliedAt: string; lastChanged: string;
}

export interface SketchProject {
  id: string; name: string; phase: 'sketch';
  measureName: string; schemeName: string; schemeOrg: string;
  nitrogenT: number; extractionHa: number; afforestationHa: number; areaHa: number;
}

export interface NaturePotential {
  id: string; name: string; areaHa: number;
  biodiversityHa: number; protectedNatureHa: number;
  section3Ha: number; natura2000Ha: number;
}
```

`Plan` interface extended with:
```typescript
projectDetails: ProjectDetail[];
sketchProjects: SketchProject[];
naturePotentials: NaturePotential[];
```

`SubsidyScheme` interface extended with `url: string`.

### 3. `src/components/ProjectList.tsx` (new, 374 lines)

A tabbed drill-down component with three views:

- **Projekter tab** — Formal MARS projects. Each is an expandable card showing name, phase (color-coded dot), measure type, and key metrics. Expanding shows full detail: status, type, area, N-reduction, extraction, afforestation, subsidy scheme with org, application date, last update, and an external link to the scheme. Searchable and filterable by phase. Sorted: established → approved → preliminary, then by nitrogen desc.
- **Skitser tab** — Early-stage sketch projects. Compact cards with name, measure type, and metrics. Sorted by nitrogen impact.
- **Naturpotentialer tab** — Nature restoration potential sites. Shows total area and breakdowns (biodiversity, Natura 2000, §3, protected nature). Only visible when the Nature pillar is active. Sorted by area.

All three tabs have scrollable lists capped at 400px height.

### 4. `src/components/DetailPanel.tsx` (337 → 347 lines)

Two changes:
1. Import added: `import { ProjectList } from './ProjectList';`
2. `<ProjectList>` rendered between the pillar-specific sections and the stacked project bar, only when a `plan` is selected (not for catchments, which don't have nested project data in the current data model).

## Architecture notes

- **Data flow:** MARS `plans.json` → `build_dashboard_data.py` (enrichment) → `dashboard-data.json` → React frontend
- **Enrichment is done at build time** in Python, not at runtime in the browser. The frontend receives pre-joined data with human-readable names.
- **Catchments don't have drill-down yet.** The VOS data (`vos.json`) has nested projects but the current ETL doesn't enrich them. This could be added later using the same pattern.
- **No geometry per project.** Individual project map pins aren't feasible — only ~100 of 1,167 projects have WFS geometry. The drill-down is a list/table approach.

## How to test

1. Run `python3 etl/build_dashboard_data.py` to rebuild the dashboard data
2. Copy `data/dashboard-data.json` to `public/data/dashboard-data.json`
3. Start dev server (`npm run dev`)
4. Click any plan on the map (e.g. Odense Fjord)
5. Scroll down in the detail panel — the "Projektdetaljer" section should appear with tabs for Projekter, Skitser, and (if Nature pillar is active) Naturpotentialer
6. Click a project card to expand its full detail
7. Try the search bar and phase filter on the Projekter tab
