#!/usr/bin/env python3
"""
Build a slim dashboard JSON from raw MARS data and supplementary sources.

Reads ~10 MB of raw MARS/DAWA data plus Natura 2000, §3, and forest data
and produces:
  - data/dashboard-data.json (~80 KB) — pre-joined dashboard data
  - data/name-lookup.json (~2 KB) — WFS↔MARS name mapping

Key design principles:
  1. Phase distinction: Every metric is broken down by project phase
     (sketch → assessed → approved → established) so the dashboard can
     show what is planned vs. what is actually implemented.
  2. Data provenance: Every data section carries source metadata (API URL,
     dataset name, coordinate system, disclaimers) so the dashboard can
     show where each number comes from.

Run via: mise run build-dashboard
"""

import json
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BASE = str(SCRIPT_DIR.parent)

# Load core MARS/DAWA sources
with open(f"{BASE}/data/mars/plans.json") as f:
    plans = json.load(f)
with open(f"{BASE}/data/mars/vos.json") as f:
    vos = json.load(f)
with open(f"{BASE}/data/mars/projects.json") as f:
    projects = json.load(f)
with open(f"{BASE}/data/mars/master-data.json") as f:
    master = json.load(f)
with open(f"{BASE}/data/mars/metadata.json") as f:
    metadata = json.load(f)
with open(f"{BASE}/data/mars/summary.json") as f:
    summary = json.load(f)
with open(f"{BASE}/data/dawa/kommuner.json") as f:
    kommuner = json.load(f)

# Load supplementary sources (optional — graceful if missing)
natura2000_summary = None
section3_summary = None
forest_summary = None

try:
    with open(f"{BASE}/data/natura2000/summary.json") as f:
        natura2000_summary = json.load(f)
except FileNotFoundError:
    print("⚠ Natura 2000 data not found — run fetch_natura2000.py first")

try:
    with open(f"{BASE}/data/section3/summary.json") as f:
        section3_summary = json.load(f)
except FileNotFoundError:
    print("⚠ §3 nature data not found — run fetch_section3.py first")

try:
    with open(f"{BASE}/data/forest/summary.json") as f:
        forest_summary = json.load(f)
except FileNotFoundError:
    print("⚠ Forest data not found — run fetch_fredskov.py first")


# ========================================
# Build MARS state lookup
# ========================================
# Maps stateNr → {name, type, description}
# Types: Initial, Preliminary, Established, Canceled, Hearing
state_lookup = {}
for s in master.get("states", []):
    state_lookup[s["stateNr"]] = {
        "name": s["name"],
        "type": s["type"],
        "description": s.get("description", ""),
    }

# Build lookup dicts for enriching project details
measure_lookup = {m["id"]: m for m in master.get("mitigationMeasures", [])}
scheme_lookup = {s["id"]: s for s in master.get("subsidySchemes", [])}

# Map MARS project status codes to dashboard phase categories
# Status 6 = Forundersøgelsestilsagn (preliminary investigation granted)
# Status 10 = Etableringstilsagn (establishment grant given — approved but not built)
# Status 15 = Anlagt (constructed / established)
PHASE_MAP = {
    6: "preliminary",   # Investigation granted — not yet approved for construction
    10: "approved",      # Approved for construction — not yet built
    15: "established",   # Actually built and operational
}


def compute_project_phase_breakdown(project_list):
    """Break down project metrics by phase (preliminary / approved / established)."""
    phases = {
        "preliminary": {"count": 0, "nitrogenT": 0, "extractionHa": 0, "afforestationHa": 0},
        "approved": {"count": 0, "nitrogenT": 0, "extractionHa": 0, "afforestationHa": 0},
        "established": {"count": 0, "nitrogenT": 0, "extractionHa": 0, "afforestationHa": 0},
    }
    for p in project_list:
        status = p.get("projectStatus")
        phase = PHASE_MAP.get(status, "preliminary")
        phases[phase]["count"] += 1
        phases[phase]["nitrogenT"] += p.get("nitrogenReductionT", 0) or 0
        phases[phase]["extractionHa"] += p.get("extractionEffortHa", 0) or 0
        phases[phase]["afforestationHa"] += p.get("afforestationEffortHa", 0) or 0

    # Round all values
    for phase in phases.values():
        phase["nitrogenT"] = round(phase["nitrogenT"], 1)
        phase["extractionHa"] = round(phase["extractionHa"], 1)
        phase["afforestationHa"] = round(phase["afforestationHa"], 1)

    return phases


def enrich_project(p):
    """Enrich a single MARS project with human-readable names from master data."""
    status = p.get("projectStatus")
    phase = PHASE_MAP.get(status, "preliminary")
    state = state_lookup.get(status, {})

    measure_id = p.get("mitigationMeasureId")
    measure = measure_lookup.get(measure_id, {})

    scheme_id = p.get("subsidySchemeId")
    scheme = scheme_lookup.get(scheme_id, {})

    return {
        "id": p.get("projectId", ""),
        "name": p.get("projectName", "Unavngivet projekt"),
        "geoId": p.get("geoLocationId", ""),
        "phase": phase,
        "statusName": state.get("name", ""),
        "statusNr": status,
        "measureName": measure.get("name", ""),
        "schemeName": scheme.get("name", ""),
        "schemeOrg": scheme.get("organization", ""),
        "schemeUrl": scheme.get("url", ""),
        "nitrogenT": round(p.get("nitrogenReductionT", 0) or 0, 3),
        "extractionHa": round(p.get("extractionEffortHa", 0) or 0, 2),
        "afforestationHa": round(p.get("afforestationEffortHa", 0) or 0, 2),
        "areaHa": round(p.get("overlappingAreaHa", 0) or 0, 2),
        "appliedAt": p.get("applicationTimestamp", ""),
        "lastChanged": p.get("lastStateChanged", ""),
    }


def enrich_sketch(s):
    """Enrich a sketch project with human-readable names."""
    measure_id = s.get("mitigationMeasureId")
    measure = measure_lookup.get(measure_id, {})

    scheme_id = s.get("subsidySchemeId")
    scheme = scheme_lookup.get(scheme_id, {})

    return {
        "id": s.get("sketchProjectId", ""),
        "name": s.get("sketchProjectName", "Unavngivet skitse"),
        "geoId": s.get("geoLocationId", ""),
        "phase": "sketch",
        "measureName": measure.get("name", ""),
        "schemeName": scheme.get("name", ""),
        "schemeOrg": scheme.get("organization", ""),
        "nitrogenT": round(s.get("nitrogenReductionT", 0) or 0, 3),
        "extractionHa": round(s.get("extractionEffortHa", 0) or 0, 2),
        "afforestationHa": round(s.get("afforestationEffortHa", 0) or 0, 2),
        "areaHa": round(s.get("overlappingAreaHa", 0) or 0, 2),
    }


def slim_nature_potential(np_item):
    """Slim down a nature potential entry."""
    return {
        "id": np_item.get("naturePotentialId", ""),
        "name": np_item.get("naturePotentialName", "Unavngivet"),
        "areaHa": round(np_item.get("overlappingAreaHa", 0) or 0, 2),
        "biodiversityHa": round(np_item.get("biodiversitetOverlappingAreaHa", 0) or 0, 2),
        "protectedNatureHa": round(np_item.get("beskyttetNaturOverlappingAreaHa", 0) or 0, 2),
        "section3Ha": round(np_item.get("s3NaturOverlappingAreaHa", 0) or 0, 2),
        "natura2000Ha": round(np_item.get("natura2000OverlappingAreaHa", 0) or 0, 2),
    }


# ========================================
# Compute national phase breakdown
# ========================================
national_phases = compute_project_phase_breakdown(projects)

# ========================================
# Build slim dashboard data
# ========================================

dashboard_data = {
    "fetchedAt": summary.get("fetched_at"),
    "builtAt": datetime.now(timezone.utc).isoformat(),

    # Data provenance — every section has source info for transparency
    "sources": {
        "mars": {
            "name": "MARS — Miljøstyrelsens Administrative Registrerings System",
            "url": "https://mars.sgav.dk/api",
            "description": "Official project registry for nitrogen reduction, wetland extraction, and afforestation projects under the Danish Green Tripartite Agreement.",
            "maintainer": "Miljøstyrelsen (Danish Environmental Protection Agency)",
            "license": "Public data (Danish public sector open data)",
            "fetchedAt": summary.get("fetched_at"),
        },
        "dawa": {
            "name": "DAWA — Danmarks Adressers Web API",
            "url": "https://api.dataforsyningen.dk",
            "description": "Official Danish address and administrative boundary data, including municipality boundaries.",
            "maintainer": "Klimadatastyrelsen (Danish Agency for Data Supply and Infrastructure)",
            "license": "Public data (Danish public sector open data)",
        },
        "natura2000": {
            "name": "Natura 2000 — EU Habitat & Birds Directive Protected Areas",
            "url": "https://wfs2-miljoegis.mim.dk/natur/ows",
            "layer": "natur:natura_2000_omraader",
            "description": "Boundaries of Denmark's 250 Natura 2000 protected sites. Includes both terrestrial and marine areas. Marine/terrestrial split is estimated using name-based heuristics.",
            "maintainer": "Miljøstyrelsen via MiljøGIS WFS",
            "license": "Public data (EU INSPIRE directive)",
            "coordinateSystem": "EPSG:25832",
            "disclaimer": "Marine/terrestrial classification is heuristic (name-based with area threshold). For precise split, a spatial overlay with coastline data would be needed.",
            "fetchedAt": natura2000_summary.get("fetched_at") if natura2000_summary else None,
        },
        "section3": {
            "name": "§3-beskyttede naturtyper (Naturbeskyttelseslovens §3)",
            "url": "https://wfs2-miljoegis.mim.dk/natur/ows",
            "layer": "natur:ais_par3",
            "description": "All Danish §3-protected nature areas: heaths (hede), bogs (mose), meadows (eng), salt marshes (strandeng), dry grasslands (overdrev), lakes (søer), and streams (vandløb).",
            "maintainer": "Miljøstyrelsen via MiljøGIS WFS",
            "license": "Public data (EU INSPIRE directive)",
            "coordinateSystem": "EPSG:25832",
            "disclaimer": "§3 areas overlap significantly with Natura 2000 sites. Simple addition of the two overestimates total protected area. A spatial union (GIS overlay) is needed for the exact combined figure. EEA reports ~15% of Danish land as protected.",
            "fetchedAt": section3_summary.get("fetched_at") if section3_summary else None,
        },
        "forest": {
            "name": "Fredskov & Digitalt Skovkort",
            "url": "https://wfs2-miljoegis.mim.dk",
            "layers": ["np3basis2020:np3b2020_fredskov", "skovdrift:digitalt_skovkort_2022"],
            "description": "Protected forest (fredskov) parcels and digital forest map 2022. Fredskov represents the legal baseline of protected forests. The 250,000 ha afforestation target measures *new* forest above this baseline.",
            "maintainer": "Miljøstyrelsen via MiljøGIS WFS",
            "license": "Public data (EU INSPIRE directive)",
            "coordinateSystem": "EPSG:25832",
            "disclaimer": "MARS tracks only 49 ha of afforestation through its project system. The Klimaskovfonden figure (2,871 ha) is from their voluntary project registry and is not part of the MARS data. The true national afforestation rate requires comparison of forest maps over time.",
            "fetchedAt": forest_summary.get("fetched_at") if forest_summary else None,
        },
        "dst": {
            "name": "Danmarks Statistik (Statistics Denmark)",
            "url": "https://api.statbank.dk/v1",
            "description": "Official statistics on land area, forest cover, agricultural subsidies, and environmental funding.",
            "maintainer": "Danmarks Statistik",
            "license": "Public data (Statistics Denmark open data)",
        },
        "klimaskovfonden": {
            "name": "Klimaskovfonden",
            "url": "https://klimaskovfonden.dk",
            "description": "Voluntary afforestation fund tracking private and municipal forest planting projects. Data is manually sourced from their project registry.",
            "disclaimer": "The 2,871 ha figure is from research (not an API). Klimaskovfonden does not currently provide a public API. This number may be outdated.",
        },
    },

    # National targets and progress
    "national": {
        "targets": {
            "nitrogenReductionT": master.get("nitrogenReductionGoalT", 12776),
            "extractionHa": master.get("extractionEffectGoalHa", 140000),
            "afforestationHa": master.get("afforestationEffortGoalHa", 250000),
            "protectedNaturePct": 20.0,
            "deadline": "2030-12-31",
            "forestDeadline": "2045-12-31",
        },

        # Phase-aware progress: breaks down every metric by implementation stage
        # This is critical — "achieved" in MARS includes projects that are only
        # at the preliminary investigation stage, not yet built.
        "progress": {
            # === NITROGEN ===
            "nitrogen": {
                "goalT": round(sum(p.get("nitrogenReductionGoalT") or 0 for p in plans), 1),
                # Total across all phases (what MARS reports as "achieved")
                "totalT": round(summary["endpoints"]["plans"]["nitrogen_achieved_T"], 1),
                "totalProgressPct": summary["endpoints"]["plans"]["nitrogen_progress_pct"],
                # Breakdown by phase — only "established" is truly implemented
                "byPhase": {
                    "established": {
                        "T": national_phases["established"]["nitrogenT"],
                        "description": "Anlagt — projects actually constructed and operational",
                    },
                    "approved": {
                        "T": national_phases["approved"]["nitrogenT"],
                        "description": "Etableringstilsagn — approved for construction, not yet built",
                    },
                    "preliminary": {
                        "T": national_phases["preliminary"]["nitrogenT"],
                        "description": "Forundersøgelsestilsagn — preliminary investigation granted",
                    },
                },
                "source": "mars",
                "disclaimer": "The 'total' figure includes all project phases. Only 'established' projects have been physically implemented. Preliminary and approved projects represent planned or in-progress reductions that may not materialize.",
            },

            # === EXTRACTION (wetland/lowland) ===
            "extraction": {
                "goalHa": master.get("extractionEffectGoalHa", 140000),
                "totalHa": round(summary["endpoints"]["projects"]["total_extraction_effort_ha"], 1),
                "totalProgressPct": round(summary["endpoints"]["projects"]["total_extraction_effort_ha"] / 140000 * 100, 1),
                "byPhase": {
                    "established": {
                        "ha": national_phases["established"]["extractionHa"],
                        "description": "Anlagt — wetland projects actually constructed",
                    },
                    "approved": {
                        "ha": national_phases["approved"]["extractionHa"],
                        "description": "Etableringstilsagn — approved for construction, not yet built",
                    },
                    "preliminary": {
                        "ha": national_phases["preliminary"]["extractionHa"],
                        "description": "Forundersøgelsestilsagn — preliminary investigation granted",
                    },
                },
                "source": "mars",
                "disclaimer": "Extraction area includes all project phases. Only 'established' represents actual land-use change.",
            },

            # === AFFORESTATION ===
            "afforestation": {
                "goalHa": master.get("afforestationEffortGoalHa", 250000),
                "marsTotal": {
                    "ha": round(sum(p.get("totalAfforestationEffortHa") or 0 for p in plans), 1),
                    "byPhase": {
                        "established": {
                            "ha": national_phases["established"]["afforestationHa"],
                            "description": "Anlagt — forest actually planted through MARS projects",
                        },
                        "approved": {
                            "ha": national_phases["approved"]["afforestationHa"],
                            "description": "Etableringstilsagn — approved for planting, not yet planted",
                        },
                        "preliminary": {
                            "ha": national_phases["preliminary"]["afforestationHa"],
                            "description": "Forundersøgelsestilsagn — preliminary investigation granted",
                        },
                    },
                    "source": "mars",
                    "disclaimer": "MARS only tracks afforestation within its project system. This represents a tiny fraction of national forest planting.",
                },
                "supplementary": {
                    "klimaskovfondenHa": 2871,
                    "klimaskovfondenSource": "klimaskovfonden",
                    "disclaimer": "Klimaskovfonden tracks voluntary private/municipal planting. Figure from research (2024), may be outdated.",
                },
                "baseline": {
                    "fredskovHa": round(forest_summary["sources"]["fredskov"]["total_area_ha"], 1) if forest_summary and "total_area_ha" in forest_summary.get("sources", {}).get("fredskov", {}) else None,
                    "skovkortPolygons": forest_summary["sources"]["skovkort_2022"]["total_count"] if forest_summary and "total_count" in forest_summary.get("sources", {}).get("skovkort_2022", {}) else None,
                    "source": "forest",
                    "disclaimer": "Fredskov (578,950 ha) is the legal baseline of protected forests. The 250,000 ha target is *new* forest above this baseline by 2045.",
                },
            },

            # === NATURE PROTECTION ===
            "nature": {
                "targetPct": 20.0,
                "natura2000": {
                    "terrestrialHa": round(natura2000_summary["totals"]["terrestrial_area_ha"], 1) if natura2000_summary else None,
                    "terrestrialPct": round(natura2000_summary["totals"]["terrestrial_pct_of_land"], 2) if natura2000_summary else None,
                    "marineHa": round(natura2000_summary["totals"]["marine_area_ha"], 1) if natura2000_summary else None,
                    "siteCount": natura2000_summary["feature_count"] if natura2000_summary else None,
                    "source": "natura2000",
                },
                "section3": {
                    "totalHa": round(section3_summary["totals"]["total_area_ha"], 1) if section3_summary else None,
                    "pctOfLand": round(section3_summary["totals"]["pct_of_land"], 2) if section3_summary else None,
                    "featureCount": section3_summary["total_feature_count"] if section3_summary else None,
                    "byType": section3_summary["by_type"][:6] if section3_summary else None,  # Top 6 types
                    "source": "section3",
                },
                "marsNaturePotential": {
                    "areaHa": round(sum(p.get("totalNaturePotentialAreaHa") or 0 for p in plans), 1),
                    "count": sum(p.get("countNaturePotentials") or 0 for p in plans),
                    "source": "mars",
                    "disclaimer": "Nature potential areas identified in MARS project plans. These are potential restoration sites, not yet implemented.",
                },
                # Combined estimate
                "combinedEstimatePct": 15.0,
                "combinedEstimateDisclaimer": "Natura 2000 (~18%) and §3 (~9.5%) overlap significantly. Simple addition gives ~27.5% which overestimates. EEA reports ~15% of Danish land as protected. A proper spatial union (GIS overlay) is needed for the exact figure.",
                "denmarkLandAreaKm2": 42951,
            },
        },

        # Project pipeline overview with phase counts
        "projectPipeline": {
            "total": summary["endpoints"]["projects"]["total_count"],
            "phases": {
                "sketches": {
                    "count": summary["endpoints"]["plans"]["sketch_projects"],
                    "description": "Skitse — early concept, not yet formally assessed",
                    "implemented": False,
                },
                "assessed": {
                    "count": summary["endpoints"]["plans"]["assessed_projects"],
                    "description": "Vurderet — formally assessed by authorities",
                    "implemented": False,
                },
                "approved": {
                    "count": summary["endpoints"]["plans"]["approved_projects"],
                    "description": "Godkendt — approved for implementation",
                    "implemented": False,
                },
                "established": {
                    "count": summary["endpoints"]["plans"]["established_projects"],
                    "description": "Anlagt — physically implemented and operational",
                    "implemented": True,
                },
            },
            "source": "mars",
            "disclaimer": "Project counts from MARS plan-level aggregation. Only 'established' projects represent actual environmental impact. The pipeline shows progression from concept to implementation.",
        },
    },

    # MARS project states reference — for the frontend to use
    "projectStates": [
        {
            "stateNr": s["stateNr"],
            "name": s["name"],
            "type": s["type"],
            "description": s.get("description", ""),
            "dashboardPhase": PHASE_MAP.get(s["stateNr"], "other"),
        }
        for s in master.get("states", [])
    ],

    # 37 kystvandgrupper (coastal water groups) — the map's primary layer
    "plans": [],

    # 23 vandoplande (catchments) — secondary map layer
    "catchments": [],

    # Mitigation measure types (for legends/tooltips)
    "mitigationMeasures": [
        {"id": m["id"], "name": m["name"], "color": m.get("color", "#888"), "icon": m.get("icon", "")}
        for m in master.get("mitigationMeasures", [])
    ],

    # Subsidy schemes (for reference)
    "subsidySchemes": [
        {"id": s["id"], "name": s["name"], "organization": s.get("organization", ""), "url": s.get("url", ""), "active": s.get("active", True)}
        for s in master.get("subsidySchemes", [])
    ],
}

# ========================================
# Build per-plan project phase breakdown
# ========================================
# Plans have nested project lists (plan["projects"]) — use those directly.
# The top-level /api/status/projects endpoint has its own geoLocationIds
# (per-project, not per-plan), so we use the nested data.


# Build slim plan data (37 entries)
for p in plans:
    goal = p.get("nitrogenReductionGoalT") or 0
    achieved = p.get("totalNitrogenReductionT") or 0
    pct = round(achieved / goal * 100, 1) if goal > 0 else 0

    # Compute per-plan phase breakdown from the plan's nested project list
    plan_projects = p.get("projects", [])
    plan_phases = compute_project_phase_breakdown(plan_projects)

    entry = {
        "id": p["id"],
        "name": p["name"],
        "geoLocationId": p.get("geoLocationId"),
        "nameNormalized": p["name"].replace("Å", "Aa").replace("å", "aa").replace("Ø", "Oe").replace("ø", "oe"),
        # Nitrogen — total + phase breakdown
        "nitrogenGoalT": round(goal, 1),
        "nitrogenAchievedT": round(achieved, 1),
        "nitrogenProgressPct": pct,
        "nitrogenByPhase": {
            "established": plan_phases["established"]["nitrogenT"],
            "approved": plan_phases["approved"]["nitrogenT"],
            "preliminary": plan_phases["preliminary"]["nitrogenT"],
        },
        # Extraction — total + phase breakdown
        "extractionPotentialHa": round(p.get("extractionPotentialHa") or 0, 1),
        "extractionAchievedHa": round(p.get("totalExtractionEffortHa") or 0, 1),
        "extractionByPhase": {
            "established": plan_phases["established"]["extractionHa"],
            "approved": plan_phases["approved"]["extractionHa"],
            "preliminary": plan_phases["preliminary"]["extractionHa"],
        },
        # Afforestation
        "afforestationAchievedHa": round(p.get("totalAfforestationEffortHa") or 0, 1),
        "afforestationByPhase": {
            "established": plan_phases["established"]["afforestationHa"],
            "approved": plan_phases["approved"]["afforestationHa"],
            "preliminary": plan_phases["preliminary"]["afforestationHa"],
        },
        # Nature potential
        "naturePotentialAreaHa": round(p.get("totalNaturePotentialAreaHa") or 0, 1),
        "countNaturePotentials": p.get("countNaturePotentials") or 0,
        # Project counts by phase
        "projects": {
            "sketches": p.get("countSketchProjects") or 0,
            "assessed": p.get("countAssessedProjects") or 0,
            "approved": p.get("countApprovedProjects") or 0,
            "established": p.get("countEstablishedProjects") or 0,
            # Also include per-plan project-level breakdown
            "byStatus": {
                "preliminary": plan_phases["preliminary"]["count"],
                "approved": plan_phases["approved"]["count"],
                "established": plan_phases["established"]["count"],
            },
        },
        "status": p.get("status", ""),
        # Detailed project arrays for drill-down
        "projectDetails": [enrich_project(proj) for proj in plan_projects],
        "sketchProjects": [enrich_sketch(sp) for sp in p.get("sketchProjects", [])],
        "naturePotentials": [slim_nature_potential(np_item) for np_item in p.get("naturePotentials", [])],
    }
    dashboard_data["plans"].append(entry)


# Build slim catchment data (23 entries)
# Group projects by catchment (vandopland)
projects_by_vo = {}
for v in vos:
    geo_id = v.get("geoLocationId")
    # Catchment projects need to be matched through plans
    # Each plan has a parent VO (vandopland) — we use the plan's projects
    vo_project_list = []
    for pp in v.get("projects", []):
        # Each VO has nested project data — but our flat projects list
        # uses geoLocationId which maps to plans, not VOs.
        # We'll use the VO's aggregate counts instead.
        pass
    projects_by_vo[v["id"]] = vo_project_list

for v in vos:
    entry = {
        "id": v["id"],
        "name": v["name"],
        "geoLocationId": v.get("geoLocationId"),
        "nameNormalized": v["name"].replace("Å", "Aa").replace("å", "aa").replace("Ø", "Oe").replace("ø", "oe"),
        # Totals
        "nitrogenAchievedT": round(v.get("totalNitrogenReductionT") or 0, 1),
        "extractionAchievedHa": round(v.get("totalExtractionEffortHa") or 0, 1),
        "afforestationAchievedHa": round(v.get("totalAfforestationEffortHa") or 0, 1),
        "naturePotentialAreaHa": round(v.get("totalNaturePotentialAreaHa") or 0, 1),
        "countNaturePotentials": v.get("countNaturePotentials") or 0,
        # Project counts by phase
        "projects": {
            "sketches": v.get("countSketchProjects") or 0,
            "assessed": v.get("countAssessedProjects") or 0,
            "approved": v.get("countApprovedProjects") or 0,
            "established": v.get("countEstablishedProjects") or 0,
        },
    }
    dashboard_data["catchments"].append(entry)

# Sort by nitrogen goal descending (biggest challenges first)
dashboard_data["plans"].sort(key=lambda x: x["nitrogenGoalT"], reverse=True)
dashboard_data["catchments"].sort(key=lambda x: x["name"])

# Write it
outpath = f"{BASE}/data/dashboard-data.json"
with open(outpath, "w") as f:
    json.dump(dashboard_data, f, ensure_ascii=False, indent=2)

size = os.path.getsize(outpath)
print(f"Created {outpath}")
print(f"Size: {size // 1024} KB")
print(f"Plans: {len(dashboard_data['plans'])} entries")
print(f"Catchments: {len(dashboard_data['catchments'])} entries")
print(f"Mitigation measures: {len(dashboard_data['mitigationMeasures'])}")
print(f"Subsidy schemes: {len(dashboard_data['subsidySchemes'])}")
print(f"Project states: {len(dashboard_data['projectStates'])}")

# Phase breakdown headline
print()
print("=" * 60)
print("PHASE BREAKDOWN — National nitrogen reduction")
print("=" * 60)
np = dashboard_data["national"]["progress"]["nitrogen"]
print(f"  Goal:            {np['goalT']:,.1f} T")
print(f"  Total (all):     {np['totalT']:,.1f} T ({np['totalProgressPct']:.1f}%)")
print(f"  Established:     {np['byPhase']['established']['T']:,.1f} T  ← actually built")
print(f"  Approved:        {np['byPhase']['approved']['T']:,.1f} T  ← approved, not built")
print(f"  Preliminary:     {np['byPhase']['preliminary']['T']:,.1f} T  ← investigation only")
print()

# Also create the name-matching lookup for WFS ↔ MARS join
name_map = {}
for p in plans:
    wfs_name = p["name"].replace("Å", "Aa").replace("å", "aa")
    name_map[wfs_name] = p["name"]
    name_map[p["name"]] = p["name"]

for v in vos:
    wfs_name = v["name"].replace("Å", "Aa").replace("å", "aa")
    name_map[wfs_name] = v["name"]
    name_map[v["name"]] = v["name"]

# Special cases
name_map["Lister Dyb"] = "Vidå-Kruså"

lookup_path = f"{BASE}/data/name-lookup.json"
with open(lookup_path, "w") as f:
    json.dump(name_map, f, ensure_ascii=False, indent=2)

print(f"Created {lookup_path}")
print(f"Entries: {len(name_map)} name mappings")

# ========================================
# Build project changelog (recent activity)
# ========================================
# Identifies projects whose status changed within the last N days.
# Uses `lastStateChanged` on each project to detect recent activity.
# Produces data/project-changelog.json for the "recent news" UI component.

CHANGELOG_WINDOW_DAYS = 30
PHASE_LABELS_DA = {
    "preliminary": "Ny forundersøgelse",
    "approved": "Godkendt til anlæg",
    "established": "Nyligt anlagt",
}

now_utc = datetime.now(timezone.utc)
changelog_cutoff = now_utc - timedelta(days=CHANGELOG_WINDOW_DAYS)

# Build plan name lookup: plan_id -> plan_name
plan_name_by_id = {p["id"]: p["name"] for p in plans}
# Also map geoLocationId -> plan name for the nested projects
plan_name_by_geo = {p.get("geoLocationId"): p["name"] for p in plans}

changelog_entries = []
for p in plans:
    plan_name = p["name"]
    for proj in p.get("projects", []):
        last_changed_str = proj.get("lastStateChanged", "")
        if not last_changed_str:
            continue
        try:
            # Parse ISO timestamp (handles both 'Z' and '+00:00' suffixes)
            lc = last_changed_str.replace("Z", "+00:00")
            if "+" not in lc and "-" not in lc[10:]:
                lc += "+00:00"
            dt = datetime.fromisoformat(lc)
        except (ValueError, TypeError):
            continue

        if dt < changelog_cutoff:
            continue

        status = proj.get("projectStatus")
        phase = PHASE_MAP.get(status)
        if not phase:
            continue

        # Enrich with master data
        measure = measure_lookup.get(proj.get("mitigationMeasureId"), {})

        entry = {
            "date": dt.strftime("%Y-%m-%d"),
            "name": proj.get("projectName", "Unavngivet"),
            "projectId": proj.get("projectId", ""),
            "planName": plan_name,
            "phase": phase,
            "phaseLabelDa": PHASE_LABELS_DA.get(phase, phase),
            "measureName": measure.get("name", ""),
        }

        # Add numeric effects only if > 0
        n = proj.get("nitrogenReductionT", 0) or 0
        if n > 0:
            entry["nitrogenT"] = round(n, 3)
        e = proj.get("extractionEffortHa", 0) or 0
        if e > 0:
            entry["extractionHa"] = round(e, 2)
        a = proj.get("afforestationEffortHa", 0) or 0
        if a > 0:
            entry["afforestationHa"] = round(a, 2)
        area = proj.get("overlappingAreaHa", 0) or 0
        if area > 0:
            entry["areaHa"] = round(area, 2)

        changelog_entries.append(entry)

# Group by date (newest first)
entries_by_date = defaultdict(list)
for e in changelog_entries:
    entries_by_date[e["date"]].append(e)

by_date_sorted = []
for date_str in sorted(entries_by_date.keys(), reverse=True):
    entries = sorted(entries_by_date[date_str], key=lambda x: x["name"])
    by_date_sorted.append({"date": date_str, "entries": entries})

# Summary counts by phase
summary = {"preliminary": 0, "approved": 0, "established": 0}
for e in changelog_entries:
    summary[e["phase"]] += 1

changelog_data = {
    "builtAt": now_utc.isoformat(),
    "windowDays": CHANGELOG_WINDOW_DAYS,
    "totalChanges": len(changelog_entries),
    "summary": summary,
    "byDate": by_date_sorted,
}

changelog_path = f"{BASE}/data/project-changelog.json"
with open(changelog_path, "w") as f:
    json.dump(changelog_data, f, ensure_ascii=False, indent=2)

print()
print(f"Created {changelog_path}")
print(f"Changelog: {len(changelog_entries)} changes in last {CHANGELOG_WINDOW_DAYS} days")
print(f"  Preliminary: {summary['preliminary']}")
print(f"  Approved:    {summary['approved']}")
print(f"  Established: {summary['established']}")
print(f"  Date groups: {len(by_date_sorted)}")
