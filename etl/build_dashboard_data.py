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
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import urlopen, Request

from mars_pipeline_s2 import (
    CANCELLED_STATES,
    build_by_owner_org,
    build_by_pipeline_phase,
    dedupe_sketches_by_id,
    legacy3_merged_from_by_pipeline,
    legacy_enrich_phase,
    pipeline_phase_name,
    project_type_from_measure_name,
)

SCRIPT_DIR = Path(__file__).resolve().parent
BASE = str(SCRIPT_DIR.parent)

DAWA_REVERSE_URL = "https://api.dataforsyningen.dk/kommuner/reverse"
DAWA_TIMEOUT_SECONDS = 10
USER_AGENT = "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; open-source environmental monitor)"

# Load core MARS/DAWA sources
with open(f"{BASE}/data/mars/plans.json") as f:
    plans = json.load(f)
deduped_sketches = dedupe_sketches_by_id(plans)
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

# Per-municipality nature area breakdowns (kommunekode → ha)
section3_by_kommune: dict[str, float] = {}
try:
    with open(f"{BASE}/data/section3/by_kommune.json") as f:
        section3_by_kommune = json.load(f)
except FileNotFoundError:
    print("⚠ §3 by_kommune.json not found — run fetch_section3.py first")

natura2000_by_kommune: dict[str, float] = {}
try:
    with open(f"{BASE}/data/natura2000/by_kommune.json") as f:
        natura2000_by_kommune = json.load(f)
except FileNotFoundError:
    print("⚠ Natura 2000 by_kommune.json not found — run fetch_natura2000.py first")

# Per-municipality CO₂ data from Klimaregnskabet (latest year total per capita)
# Key: kommuneKode ("0101") → total CO₂e in ton (latest year)
co2_by_kommune: dict[str, float] = {}
try:
    with open(f"{BASE}/data/klimaregnskab/by_kommune.json") as f:
        kr_data = json.load(f)
    years = kr_data.get("years", [])
    latest_idx = len(years) - 1 if years else -1
    if latest_idx >= 0:
        for km in kr_data.get("kommuner", []):
            kode = km.get("kommuneKode")
            series = km.get("samletUdledning", [])
            if kode and latest_idx < len(series):
                co2_by_kommune[kode] = series[latest_idx]
    print(f"  Klimaregnskab CO₂ data loaded: {len(co2_by_kommune)} kommuner (year {years[latest_idx] if years else '?'})")
except FileNotFoundError:
    print("⚠ Klimaregnskab data not found — run fetch_klimaregnskab.py + build_klimaregnskab_data.py")

try:
    with open(f"{BASE}/data/forest/summary.json") as f:
        forest_summary = json.load(f)
except FileNotFoundError:
    print("⚠ Forest data not found — run fetch_fredskov.py first")

klimaskovfonden_summary = None
klimaskovfonden_projects = None
try:
    with open(f"{BASE}/data/klimaskovfonden/summary.json") as f:
        klimaskovfonden_summary = json.load(f)
    with open(f"{BASE}/data/klimaskovfonden/projects.json") as f:
        klimaskovfonden_projects = json.load(f)
except FileNotFoundError:
    print("⚠ Klimaskovfonden data not found — run fetch_klimaskovfonden.py first")

nst_skov_summary = None
nst_skov_projects = None
try:
    with open(f"{BASE}/data/naturstyrelsen-skov/summary.json") as f:
        nst_skov_summary = json.load(f)
    with open(f"{BASE}/data/naturstyrelsen-skov/projects.json") as f:
        nst_skov_projects = json.load(f)
except FileNotFoundError:
    print("⚠ Naturstyrelsen skov data not found — run fetch_naturstyrelsen_skov.py first")

# Project geometries: geoId → list of [lon, lat] polygon vertices (WGS84)
project_geometries: dict[str, list[list[float]]] = {}
try:
    with open(f"{BASE}/public/data/project-geometries.json") as f:
        project_geometries = json.load(f)
    print(f"Loaded {len(project_geometries)} project geometries")
except FileNotFoundError:
    print("⚠ project-geometries.json not found — MARS projects will have no kommuneKode")


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


def _owner_org_from_scheme_id(sid: str) -> str:
    org = (scheme_lookup.get(sid) or {}).get("organization", "").strip().upper()
    if org in ("NST", "SGAV", "LBST"):
        return org
    if "NST" in org or "NATURSTYRELSEN" in org:
        return "NST"
    if "SGAV" in org:
        return "SGAV"
    if "LBST" in org:
        return "LBST"
    return "unknown"


scheme_id_to_owner: dict[str, str] = {s["id"]: _owner_org_from_scheme_id(s["id"]) for s in master.get("subsidySchemes", [])}

# ========================================
# NST Skovrejsning MARS scheme monitoring
# ========================================
# The MARS database has an "NST Skovrejsning" subsidy scheme defined
# (ID: 5551b8e5-cc17-4e86-89a0-6e763f5594f0) but it currently has 0 projects.
# This monitoring block checks every ETL run whether data has appeared.
NST_SKOV_SCHEME_ID = "5551b8e5-cc17-4e86-89a0-6e763f5594f0"
nst_mars_project_count = 0
nst_mars_scheme_exists = NST_SKOV_SCHEME_ID in scheme_lookup

if nst_mars_scheme_exists:
    # Count projects across all plans that reference this scheme
    for p in projects:
        if p.get("subsidySchemeId") == NST_SKOV_SCHEME_ID:
            nst_mars_project_count += 1

    if nst_mars_project_count > 0:
        print(f"🎉 NST SKOVREJSNING DATA DETECTED IN MARS! {nst_mars_project_count} projects found under scheme '{scheme_lookup[NST_SKOV_SCHEME_ID].get('name', 'NST Skovrejsning')}'.")
        print(f"   → This is new! The NST scheme was previously empty. Review and integrate this data.")
    else:
        print(f"ℹ NST Skovrejsning scheme exists in MARS but still has 0 projects (monitored)")
else:
    print("⚠ NST Skovrejsning scheme not found in MARS master data — ID may have changed")

def _compute_polygon_centroid(coords: list[list[float]]) -> tuple[float, float] | None:
    """
    Compute the average centroid of a polygon ring (list of [lon, lat] points).

    This is a simple mean-of-vertices centroid adequate for map display.
    Returns (lon, lat) in WGS84, or None for empty/invalid inputs.

    @param coords - List of [lon, lat] coordinate pairs
    @returns (lon, lat) tuple or None

    @example _compute_polygon_centroid([[10.0, 56.0], [11.0, 56.0], [11.0, 57.0]])
    """
    if not coords:
        return None
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return (sum(lons) / len(lons), sum(lats) / len(lats))


def _reverse_geocode_kommune(lon: float, lat: float) -> dict[str, str] | None:
    """
    Resolve a WGS84 point to a Danish municipality via DAWA reverse geocoding.

    Returns a dict with 'kode' and 'navn', or None on failure.

    @param lon - Longitude in WGS84
    @param lat - Latitude in WGS84
    @returns {'kode': '0461', 'navn': 'Odense'} or None

    @example _reverse_geocode_kommune(10.388, 55.396)  # → {'kode': '0461', 'navn': 'Odense'}
    """
    url = f"{DAWA_REVERSE_URL}?x={lon}&y={lat}&srid=4326"
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=DAWA_TIMEOUT_SECONDS) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data and data.get("kode") and data.get("navn"):
                return {"kode": data["kode"], "navn": data["navn"]}
            return None
    except Exception:
        return None


GEO_KOMMUNE_CACHE_PATH = f"{BASE}/data/geo-kommune-cache.json"


def build_geo_id_kommune_lookup() -> dict[str, dict[str, str]]:
    """
    Build a mapping from MARS geoId to municipality (kode + navn) by computing
    each polygon's centroid and reverse-geocoding via DAWA.

    Results are persisted to ``data/geo-kommune-cache.json`` so that subsequent
    runs only geocode geoIds that are new or missing from the cache.
    Additionally deduplicates by rounded centroid coordinates to avoid calling
    DAWA twice for nearly-identical points.

    @returns Dict mapping geoId → {'kode': '0461', 'navn': 'Odense'}

    @example
        lookup = build_geo_id_kommune_lookup()
        lookup.get('abc-123')  # → {'kode': '0461', 'navn': 'Odense'} or None
    """
    if not project_geometries:
        return {}

    # Load persistent cache from previous runs
    disk_cache: dict[str, dict[str, str]] = {}
    try:
        with open(GEO_KOMMUNE_CACHE_PATH) as f:
            disk_cache = json.load(f)
        print(f"  Loaded {len(disk_cache)} cached geoId→kommune mappings from disk")
    except FileNotFoundError:
        pass

    new_ids = [geo_id for geo_id in project_geometries if geo_id not in disk_cache]

    if not new_ids:
        print(f"  All {len(project_geometries)} geoIds already cached — skipping DAWA calls")
        return {geo_id: disk_cache[geo_id] for geo_id in project_geometries if geo_id in disk_cache}

    print(f"  Reverse-geocoding {len(new_ids)} new geoIds via DAWA (~{len(new_ids) // 20}s)...")
    coord_cache: dict[str, dict[str, str] | None] = {}

    for i, geo_id in enumerate(new_ids):
        coords = project_geometries[geo_id]
        centroid = _compute_polygon_centroid(coords)
        if centroid is None:
            continue

        lon, lat = centroid
        cache_key = f"{lon:.2f},{lat:.2f}"

        if cache_key not in coord_cache:
            coord_cache[cache_key] = _reverse_geocode_kommune(lon, lat)
            time.sleep(0.05)

        result = coord_cache[cache_key]
        if result:
            disk_cache[geo_id] = result

        if (i + 1) % 100 == 0:
            print(f"    geocoded {i + 1}/{len(new_ids)} new geoIds...")

    # Persist updated cache to disk for next run
    with open(GEO_KOMMUNE_CACHE_PATH, "w") as f:
        json.dump(disk_cache, f, ensure_ascii=False)

    geo_lookup = {geo_id: disk_cache[geo_id] for geo_id in project_geometries if geo_id in disk_cache}
    hits = len(geo_lookup)
    print(f"  Done: {hits}/{len(project_geometries)} geoIds resolved to a kommune")
    return geo_lookup


# Populated once before enriching projects — maps geoId → {kode, navn}
GEO_ID_KOMMUNE: dict[str, dict[str, str]] = {}


def compute_project_phase_breakdown(project_list, sketch_list=None):
    """Break down project metrics by legacy 3 bucket (incl. skitser når givet)."""
    return legacy3_merged_from_by_pipeline(
        build_by_pipeline_phase(project_list, sketch_list or [])["byPipelinePhase"]
    )


def enrich_project(p):
    """Enrich a single MARS project with human-readable names from master data."""
    status = p.get("projectStatus")
    phase = legacy_enrich_phase(status)
    p_pipe = pipeline_phase_name(status)
    state = state_lookup.get(status, {})

    measure_id = p.get("mitigationMeasureId")
    measure = measure_lookup.get(measure_id, {})

    scheme_id = p.get("subsidySchemeId")
    scheme = scheme_lookup.get(scheme_id, {})

    geo_id = p.get("geoLocationId", "")
    kommune_data = GEO_ID_KOMMUNE.get(geo_id)

    project_type = project_type_from_measure_name(measure.get("name", ""))
    return {
        "id": p.get("projectId", ""),
        "name": p.get("projectName", "Unavngivet projekt"),
        "geoId": geo_id,
        "phase": phase,
        "pipelinePhase": p_pipe,
        "isCancelled": bool(status in CANCELLED_STATES),
        "projectType": project_type,
        "forvaltningsplanStatus": "unknown" if project_type == "natur" else None,
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
        "kommuneKode": kommune_data["kode"] if kommune_data else None,
        "kommuneNavn": kommune_data["navn"] if kommune_data else None,
    }


def enrich_sketch(s):
    """Enrich a sketch project with human-readable names."""
    measure_id = s.get("mitigationMeasureId")
    measure = measure_lookup.get(measure_id, {})

    scheme_id = s.get("subsidySchemeId")
    scheme = scheme_lookup.get(scheme_id, {})

    project_type = project_type_from_measure_name(measure.get("name", ""))
    return {
        "id": s.get("sketchProjectId", ""),
        "name": s.get("sketchProjectName", "Unavngivet skitse"),
        "geoId": s.get("geoLocationId", ""),
        "phase": "sketch",
        "pipelinePhase": "sketch",
        "sketchSubState": "kladde",
        "measureName": measure.get("name", ""),
        "projectType": project_type,
        "forvaltningsplanStatus": "unknown" if project_type == "natur" else None,
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
# Build geoId → kommune lookup (DAWA reverse geocoding)
# ========================================
# Populates the module-level GEO_ID_KOMMUNE dict used by enrich_project().
# Only runs if project_geometries was loaded successfully.
GEO_ID_KOMMUNE.update(build_geo_id_kommune_lookup())

# ========================================
# Compute national phase breakdown (5-fase bygning + 3-fase brød til UI)
# ========================================
_mars_national = build_by_pipeline_phase(projects, deduped_sketches)
national_phases = legacy3_merged_from_by_pipeline(_mars_national["byPipelinePhase"])
national_by_pipeline_phase = _mars_national["byPipelinePhase"]
national_cancelled = _mars_national["cancelled"]
national_by_owner_org = build_by_owner_org(projects, deduped_sketches, scheme_id_to_owner)
del _mars_national

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
            "disclaimer": "MARS tracks afforestation only within its water quality project system. Klimaskovfonden data is now fetched live from their WFS endpoint. The true national afforestation rate also includes state and private planting tracked by Naturstyrelsen and SGAV.",
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
            "name": "Klimaskovfonden (Den Danske Klimaskovfond)",
            "url": "https://klimaskovfonden.dk",
            "wfs_base": "https://test.admin.gc2.io/ows/klimaskovfonden/public/",
            "layer": "klimaskovfonden:public.klimaskovfondens_projekter",
            "registry_url": "https://klimaskovfonden.dk/vores-standard/register",
            "description": "Voluntary afforestation and lowland projects tracked by the Danish Climate Forest Fund. Polygon geometries fetched via WFS; area computed from geometry.",
            "coordinateSystem": "EPSG:4326",
            "disclaimer": "Area is computed from WFS polygon geometry (Shoelace formula). May differ slightly from Klimaskovfonden's own registry figures. The WFS layer may lag behind the Power BI registry.",
            "fetchedAt": klimaskovfonden_summary.get("fetched_at") if klimaskovfonden_summary else None,
        },
        "naturstyrelsenSkov": {
            "name": "Naturstyrelsen statslig skovrejsning",
            "url": "https://naturstyrelsen.dk/ny-natur/skovrejsning/skovrejsningsprojekter/",
            "wfs_base": "https://wfs2-miljoegis.mim.dk/skovdrift/ows",
            "layer": "skovdrift:Naturstyrelsens arealoversigt",
            "description": "State afforestation projects managed by Naturstyrelsen. Project list from their website, cross-referenced against MiljøGIS WFS geodata for precise area measurements.",
            "coordinateSystem": "EPSG:25832 (UTM32N) → converted to WGS84",
            "disclaimer": "MARS has an 'NST Skovrejsning' subsidy scheme defined but with 0 projects registered. This data bridges that gap via WFS. Not all website-listed projects appear in the WFS yet.",
            "marsSchemeNote": "MARS scheme 'NST Skovrejsning' (5551b8e5-cc17-4e86-89a0-6e763f5594f0) exists but is empty. The ETL monitors it for future data.",
            "fetchedAt": nst_skov_summary.get("fetchedAt") if nst_skov_summary else None,
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
                "supplementary": {
                    "klimaskovfondenLavbundHa": round(klimaskovfonden_summary["totals"]["lowland_ha"], 1) if klimaskovfonden_summary else 0,
                    "klimaskovfondenLavbundCount": klimaskovfonden_summary["totals"]["lowland_count"] if klimaskovfonden_summary else 0,
                    "klimaskovfondenSource": "klimaskovfonden",
                    "disclaimer": "Klimaskovfonden tracks 3 voluntary lowland projects (~30 ha) via WFS. These contribute to the 140,000 ha lowland extraction target, not the 250,000 ha afforestation target.",
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
                    "klimaskovfondenHa": round(klimaskovfonden_summary["totals"]["afforestation_ha"], 1) if klimaskovfonden_summary else 0,
                    "klimaskovfondenProjectCount": klimaskovfonden_summary["totals"]["afforestation_count"] if klimaskovfonden_summary else 0,
                    "klimaskovfondenSource": "klimaskovfonden",
                    "klimaskovfondenByYear": klimaskovfonden_summary.get("by_year") if klimaskovfonden_summary else None,
                    "nstSkovHa": nst_skov_summary["totals"]["totalAreaHa"] if nst_skov_summary else 0,
                    "nstSkovOngoingHa": nst_skov_summary["totals"]["ongoingAreaHa"] if nst_skov_summary else 0,
                    "nstSkovCompletedHa": nst_skov_summary["totals"]["completedAreaHa"] if nst_skov_summary else 0,
                    "nstSkovMatchedCount": nst_skov_summary["totals"]["matchedInWfs"] if nst_skov_summary else 0,
                    "nstSkovTotalKnown": nst_skov_summary["totals"]["totalKnownProjects"] if nst_skov_summary else 0,
                    "nstSkovSource": "naturstyrelsenSkov",
                    "nstMarsSchemeEmpty": nst_mars_project_count == 0,  # NST Skovrejsning scheme monitored by ETL
                    "nstMarsProjectCount": nst_mars_project_count,
                    "disclaimer": "Klimaskovfonden tracks voluntary planting (WFS). Naturstyrelsen tracks state afforestation (MiljøGIS WFS). MARS 'NST Skovrejsning' scheme exists but is empty — monitored by ETL.",
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
                # Combined protected nature estimate.
                # Source: OECD Environmental Performance Reviews: Denmark 2024,
                # Table 1.1 — "Protected areas as % of terrestrial area": 15.3%.
                # https://doi.org/10.1787/1b480e3a-en
                #
                # Natura 2000 (~18%) and §3 (~9.5%) overlap substantially (~30%).
                # A proper spatial GIS overlay (geopandas.unary_union) is needed
                # for a precise combined figure — until then we use the OECD value.
                "combinedEstimatePct": 15.3,
                "combinedEstimateSource": "OECD Environmental Performance Reviews: Denmark 2024 (Table 1.1)",
                "combinedEstimateSourceUrl": "https://doi.org/10.1787/1b480e3a-en",
                "combinedEstimateDisclaimer": "Natura 2000 (~18%) and §3 (~9.5%) overlap significantly (~30%). The combined 15.3% is an OECD reference estimate. A spatial GIS overlay of actual designation boundaries is needed for the exact figure.",
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
        "byPipelinePhase": national_by_pipeline_phase,
        "cancelled": national_cancelled,
        "byOwnerOrg": national_by_owner_org,
    },

    # MARS project states reference — for the frontend to use
    "projectStates": [
        {
            "stateNr": s["stateNr"],
            "name": s["name"],
            "type": s["type"],
            "description": s.get("description", ""),
            "dashboardPhase": legacy_enrich_phase(s["stateNr"]),
            "pipelinePhase": pipeline_phase_name(s["stateNr"]),
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

    "driftFinansiering": {
        "afsat": False,
        "status": "ikke_afsat",
        "label": "Drift-finansiering er ikke afsat",
        "sources": ["MGTP-baggrundsnotat 2025", "DN feedback april 2026"],
    },
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
    plan_phases = compute_project_phase_breakdown(plan_projects, p.get("sketchProjects", []))

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
for v in vos:
    vo_projects = v.get("projects", [])
    vo_phases = compute_project_phase_breakdown(vo_projects, [])

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
        # Detailed project arrays for drill-down (same format as plans)
        "projectDetails": [enrich_project(proj) for proj in vo_projects],
        "sketchProjects": [enrich_sketch(sp) for sp in v.get("sketchProjects", [])],
        "naturePotentials": [slim_nature_potential(np_item) for np_item in v.get("naturePotentials", [])],
    }
    dashboard_data["catchments"].append(entry)

# Sort by nitrogen goal descending (biggest challenges first)
dashboard_data["plans"].sort(key=lambda x: x["nitrogenGoalT"], reverse=True)
dashboard_data["catchments"].sort(key=lambda x: x["name"])


# ========================================
# Sprint 1 — by-initiator breakdown (MARS plans only)
# ========================================

def classify_initiator(scheme_org: str, scheme_name: str) -> str:
    if scheme_org == "NST":
        return "state"
    if scheme_org == "LBST" or scheme_name == "Minivådområder":
        return "private"
    return "municipal"


def _empty_ha_cell():
    return {"ha": 0.0, "projectCount": 0}


def _empty_nitro_cell():
    # For nitrogen, `ha` key holds ton N (same keys as other pillars for a uniform JSON shape).
    return {"ha": 0.0, "projectCount": 0}


def _empty_ha_breakdown():
    return {"state": _empty_ha_cell(), "municipal": _empty_ha_cell(), "private": _empty_ha_cell()}


def _empty_nitro_breakdown():
    return {"state": _empty_nitro_cell(), "municipal": _empty_nitro_cell(), "private": _empty_nitro_cell()}


def _acc_ha(bd, init: str, ha: float):
    c = bd[init]
    c["ha"] = round(c["ha"] + ha, 2)
    c["projectCount"] += 1


def _acc_nitro(bd, init: str, t: float):
    c = bd[init]
    c["ha"] = round(c["ha"] + t, 3)
    c["projectCount"] += 1


def compute_by_initiator_ha(plan_entries: list) -> dict:
    phases = ("sketch", "preliminary", "approved", "established")
    by_phase: dict = {}
    for ph in phases:
        by_phase[ph] = {
            "extraction": _empty_ha_breakdown(),
            "afforestation": _empty_ha_breakdown(),
            "nitrogen": _empty_nitro_breakdown(),
        }

    for plan in plan_entries:
        for proj in plan.get("projectDetails", []):
            phase = proj.get("phase", "")
            if phase not in ("preliminary", "approved", "established"):
                continue
            init = classify_initiator(proj.get("schemeOrg", ""), proj.get("schemeName", ""))
            n = proj.get("nitrogenT", 0) or 0
            e = proj.get("extractionHa", 0) or 0
            a = proj.get("afforestationHa", 0) or 0
            if n > 0:
                _acc_nitro(by_phase[phase]["nitrogen"], init, n)
            if e > 0:
                _acc_ha(by_phase[phase]["extraction"], init, e)
            if a > 0:
                _acc_ha(by_phase[phase]["afforestation"], init, a)
        for sk in plan.get("sketchProjects", []):
            init = classify_initiator(sk.get("schemeOrg", ""), sk.get("schemeName", ""))
            n = sk.get("nitrogenT", 0) or 0
            e = sk.get("extractionHa", 0) or 0
            a = sk.get("afforestationHa", 0) or 0
            if n > 0:
                _acc_nitro(by_phase["sketch"]["nitrogen"], init, n)
            if e > 0:
                _acc_ha(by_phase["sketch"]["extraction"], init, e)
            if a > 0:
                _acc_ha(by_phase["sketch"]["afforestation"], init, a)

    def _merge_ha_bds(*bds):
        out = _empty_ha_breakdown()
        for bd in bds:
            for k in ("state", "municipal", "private"):
                out[k]["ha"] = round(out[k]["ha"] + bd[k]["ha"], 2)
                out[k]["projectCount"] += bd[k]["projectCount"]
        return out

    def _merge_nitro_bds(*bds):
        out = _empty_nitro_breakdown()
        for bd in bds:
            for k in ("state", "municipal", "private"):
                out[k]["ha"] = round(out[k]["ha"] + bd[k]["ha"], 3)
                out[k]["projectCount"] += bd[k]["projectCount"]
        return out

    p_nop_sketch = ("preliminary", "approved", "established")
    return {
        "extraction": _merge_ha_bds(*(by_phase[p]["extraction"] for p in p_nop_sketch)),
        "afforestation": _merge_ha_bds(*(by_phase[p]["afforestation"] for p in p_nop_sketch)),
        "nitrogen": _merge_nitro_bds(*(by_phase[p]["nitrogen"] for p in p_nop_sketch)),
        "byPhase": by_phase,
    }


dashboard_data["national"]["byInitiatorHa"] = compute_by_initiator_ha(dashboard_data["plans"])


# Klimarådet + budget (Sprint 1) — pass-through with optional ETL fields
try:
    with open(f"{BASE}/data/klimaraadet/statusrapport-2026.json", encoding="utf-8") as f:
        _klim = json.load(f)
    # Expose a stable public shape (keep _meta for cache timestamps)
    dashboard_data["national"]["klimaraadet"] = {
        "rapportTitle": _klim.get("rapportTitle", ""),
        "publiceret": _klim.get("publiceret", ""),
        "url": _klim.get("url", ""),
        "vurderinger": _klim.get("vurderinger", {}),
        "_meta": _klim.get("_meta"),
    }
except FileNotFoundError:
    print("⚠ data/klimaraadet/statusrapport-2026.json not found — skipping national.klimaraadet")

try:
    with open(f"{BASE}/data/finansiering/aftaler.json", encoding="utf-8") as f:
        _bud = json.load(f)
    _prog = dashboard_data["national"]["progress"]
    _ext_e = _prog["extraction"]["byPhase"]["established"]["ha"]
    _ksf_lb = _prog["extraction"].get("supplementary", {}).get("klimaskovfondenLavbundHa", 0) or 0
    _aff_e = _prog["afforestation"]["marsTotal"]["byPhase"]["established"]["ha"]
    _ksf_s = _prog["afforestation"].get("supplementary", {}).get("klimaskovfondenHa", 0) or 0
    _nst_s = _prog["afforestation"].get("supplementary", {}).get("nstSkovHa", 0) or 0
    _n_est = _prog["nitrogen"]["byPhase"]["established"]["T"]
    for _cat in _bud.get("kategorier", []):
        if _cat.get("id") == "lavbund-udtagning":
            _cat["realiseringHa"] = round(float(_ext_e) + float(_ksf_lb), 1)
        elif _cat.get("id") == "skov":
            _cat["realiseringHa"] = round(float(_aff_e) + float(_ksf_s) + float(_nst_s), 1)
        elif _cat.get("id") == "kvaelstof":
            _cat["realiseringTonN"] = round(float(_n_est), 1)
    dashboard_data["national"]["budgetData"] = _bud
except FileNotFoundError:
    print("⚠ data/finansiering/aftaler.json not found — skipping national.budgetData")

# ========================================
# Build byKommune aggregation
# ========================================
# Groups all MARS ProjectDetails by kommuneKode, sums metrics, and merges
# KSF + NST per-kommune totals. All 98 municipalities appear — zeroed if no projects.

# --- Collect all MARS project details across plans ---
by_kode: dict[str, dict] = {}

_ZERO_PHASE_METRICS = lambda: {"nitrogenT": 0.0, "extractionHa": 0.0, "afforestationHa": 0.0, "count": 0}


def _ensure_kode_entry(by_kode: dict, kode: str, navn: str) -> dict:
    """Initialise a byKommune accumulator for kode if it does not yet exist."""
    if kode not in by_kode:
        by_kode[kode] = {
            "nitrogenT": 0.0,
            "extractionHa": 0.0,
            "afforestationMarsHa": 0.0,
            "projectCount": 0,
            "phases": {"sketches": 0, "assessed": 0, "approved": 0, "established": 0},
            "byPhase": {
                "sketch":       _ZERO_PHASE_METRICS(),
                "preliminary":  _ZERO_PHASE_METRICS(),
                "approved":     _ZERO_PHASE_METRICS(),
                "established":  _ZERO_PHASE_METRICS(),
            },
            "kommuneNavn": navn,
        }
    return by_kode[kode]


for plan_entry in dashboard_data["plans"]:
    # --- Formal project details (Forundersøgelse / Godkendt / Anlagt) ---
    for proj in plan_entry.get("projectDetails", []):
        kode = proj.get("kommuneKode")
        if not kode:
            continue
        r = _ensure_kode_entry(by_kode, kode, proj.get("kommuneNavn", ""))
        n = proj.get("nitrogenT", 0) or 0
        e = proj.get("extractionHa", 0) or 0
        a = proj.get("afforestationHa", 0) or 0
        r["nitrogenT"] += n
        r["extractionHa"] += e
        r["afforestationMarsHa"] += a
        r["projectCount"] += 1
        phase = proj.get("phase", "")
        if phase == "established":
            r["phases"]["established"] += 1
            bp = r["byPhase"]["established"]
        elif phase == "approved":
            r["phases"]["approved"] += 1
            bp = r["byPhase"]["approved"]
        else:
            r["phases"]["assessed"] += 1  # preliminary maps to assessed in the counts
            bp = r["byPhase"]["preliminary"]
        bp["nitrogenT"] += n
        bp["extractionHa"] += e
        bp["afforestationHa"] += a
        bp["count"] += 1

    # --- Sketch projects (Skitse) — earliest funnel stage ---
    # Sketches don't go through enrich_project so they lack kommuneKode.
    # Look up the geoId in the same GEO_ID_KOMMUNE cache used for projectDetails.
    for sketch in plan_entry.get("sketchProjects", []):
        geo_id = sketch.get("geoId", "")
        if not geo_id:
            continue
        kommune_data = GEO_ID_KOMMUNE.get(geo_id)
        if not kommune_data:
            continue
        kode = kommune_data["kode"]
        r = _ensure_kode_entry(by_kode, kode, kommune_data["navn"])
        n = sketch.get("nitrogenT", 0) or 0
        e = sketch.get("extractionHa", 0) or 0
        a = sketch.get("afforestationHa", 0) or 0
        r["phases"]["sketches"] += 1
        bp = r["byPhase"]["sketch"]
        bp["nitrogenT"] += n
        bp["extractionHa"] += e
        bp["afforestationHa"] += a
        bp["count"] += 1

# --- KSF per-kommune sums ---
ksf_by_kommune: dict[str, dict[str, float]] = defaultdict(lambda: {"afforestationHa": 0.0, "lavbundHa": 0.0})
if klimaskovfonden_projects:
    for kp in klimaskovfonden_projects:
        navn = kp.get("kommune")
        if not navn:
            continue
        if kp.get("projekttyp") == "Skovrejsning":
            ksf_by_kommune[navn]["afforestationHa"] += kp.get("areaHa", 0) or 0
        elif kp.get("projekttyp") == "Lavbund":
            ksf_by_kommune[navn]["lavbundHa"] += kp.get("areaHa", 0) or 0

# --- NST per-kommune sums ---
# The fetcher saves a `kommune` field via DAWA reverse geocoding.
# If the saved file predates that feature, fall back to inline geocoding
# using the centroid coordinates already stored in each project.
def _dawa_reverse_kommune_navn(lon: float, lat: float) -> str | None:
    """DAWA reverse geocode — returns municipality name or None."""
    import urllib.request as _ureq
    url = f"https://api.dataforsyningen.dk/kommuner/reverse?x={lon}&y={lat}&srid=4326"
    try:
        req = _ureq.Request(url, headers={"User-Agent": "TrepartTracker/0.1"})
        with _ureq.urlopen(req, timeout=8) as resp:
            return json.loads(resp.read()).get("navn")
    except Exception:
        return None

nst_by_kommune: dict[str, float] = defaultdict(float)
if nst_skov_projects:
    needs_geocode = [p for p in nst_skov_projects if not p.get("kommune") and p.get("centroid") and p.get("areaHa")]
    if needs_geocode:
        print(f"  ℹ NST projects missing kommune field — inline geocoding {len(needs_geocode)} projects via DAWA...")
        _cache: dict[str, str | None] = {}
        for p in needs_geocode:
            lon, lat = p["centroid"]
            key = f"{lon:.2f},{lat:.2f}"
            if key not in _cache:
                _cache[key] = _dawa_reverse_kommune_navn(lon, lat)
                import time as _time; _time.sleep(0.05)
            p["kommune"] = _cache[key]

    for np_proj in nst_skov_projects:
        navn = np_proj.get("kommune")
        area = np_proj.get("areaHa") or 0
        if navn and area:
            nst_by_kommune[navn] += area

# Christiansø (kode 0411) is a tiny autonomous community (~100 residents) returned
# by DAWA but is NOT one of Denmark's 98 municipalities. Exclude it.
EXCLUDED_KODER = {"0411"}

# --- Build final byKommune list using DAWA kommuner.json as the authoritative list ---
by_kommune_list = []
for km in kommuner:
    if km.get("kode") in EXCLUDED_KODER:
        continue
    kode = km.get("kode", "")
    navn = km.get("navn", "")
    region_navn = km.get("region", {}).get("navn", "") if isinstance(km.get("region"), dict) else ""

    mars_data = by_kode.get(kode, {})
    ksf_navn_data = ksf_by_kommune.get(navn, {})
    nst_ha = nst_by_kommune.get(navn, 0.0)

    afforestation_mars = mars_data.get("afforestationMarsHa", 0.0)
    afforestation_ksf = ksf_navn_data.get("afforestationHa", 0.0)
    afforestation_nst = nst_ha

    section3_ha = section3_by_kommune.get(kode, 0.0)
    natura2000_ha = natura2000_by_kommune.get(kode, 0.0)
    nature_total_ha = round(section3_ha + natura2000_ha, 1)

    _empty_phase = {"nitrogenT": 0.0, "extractionHa": 0.0, "afforestationHa": 0.0, "count": 0}
    by_phase = mars_data.get("byPhase", {
        "sketch":       dict(_empty_phase),
        "preliminary":  dict(_empty_phase),
        "approved":     dict(_empty_phase),
        "established":  dict(_empty_phase),
    })
    # Round phase metric values
    for phase_key in ("sketch", "preliminary", "approved", "established"):
        pm = by_phase.get(phase_key, _empty_phase)
        by_phase[phase_key] = {
            "nitrogenT":       round(pm.get("nitrogenT", 0.0), 1),
            "extractionHa":    round(pm.get("extractionHa", 0.0), 1),
            "afforestationHa": round(pm.get("afforestationHa", 0.0), 1),
            "count":           pm.get("count", 0),
        }

    by_kommune_list.append({
        "kode": kode,
        "navn": navn,
        "region": region_navn,
        "nitrogenT": round(mars_data.get("nitrogenT", 0.0), 1),
        "extractionHa": round(mars_data.get("extractionHa", 0.0), 1),
        "afforestationMarsHa": round(afforestation_mars, 1),
        "afforestationKsfHa": round(afforestation_ksf, 1),
        "afforestationNstHa": round(afforestation_nst, 1),
        "afforestationTotalHa": round(afforestation_mars + afforestation_ksf + afforestation_nst, 1),
        "section3Ha": round(section3_ha, 1),
        "natura2000Ha": round(natura2000_ha, 1),
        "naturePotentialHa": nature_total_ha,
        "co2EstimatedT": round(co2_by_kommune.get(kode, 0.0), 1),
        "projectCount": sum(by_phase.get(ph, {}).get("count", 0) for ph in ("sketch", "preliminary", "approved", "established")),
        "projectsByPhase": mars_data.get("phases", {"sketches": 0, "assessed": 0, "approved": 0, "established": 0}),
        "byPhase": by_phase,
    })

# Sort alphabetically by name
by_kommune_list.sort(key=lambda x: x["navn"])
dashboard_data["national"]["byKommune"] = by_kommune_list

print(f"byKommune: {len(by_kommune_list)} kommuner built")
print(f"  With MARS projects:       {sum(1 for k in by_kommune_list if k['projectCount'] > 0)}")
print(f"  With KSF afforestation:   {sum(1 for k in by_kommune_list if k['afforestationKsfHa'] > 0)}")
print(f"  With NST afforestation:   {sum(1 for k in by_kommune_list if k['afforestationNstHa'] > 0)}")
print(f"  With §3 nature data:      {sum(1 for k in by_kommune_list if k['section3Ha'] > 0)}")
print(f"  With Natura 2000 data:    {sum(1 for k in by_kommune_list if k['natura2000Ha'] > 0)}")
print(f"  With naturePotentialHa:   {sum(1 for k in by_kommune_list if k['naturePotentialHa'] > 0)}")
print(f"  With co2EstimatedT:       {sum(1 for k in by_kommune_list if k.get('co2EstimatedT', 0) != 0)}")

# Write to both data/ (ETL reference) and public/data/ (frontend serving path).
# The Vite dev server serves static assets from public/ — if we only write to
# data/, the frontend will read a stale copy.
outpath = f"{BASE}/data/dashboard-data.json"
public_outpath = f"{BASE}/public/data/dashboard-data.json"
for p in (outpath, public_outpath):
    with open(p, "w") as f:
        json.dump(dashboard_data, f, ensure_ascii=False, indent=2)

size = os.path.getsize(outpath)
print(f"Created {outpath}")
print(f"  → also copied to {public_outpath}")
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
public_lookup_path = f"{BASE}/public/data/name-lookup.json"
for p in (lookup_path, public_lookup_path):
    with open(p, "w") as f:
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
        if status in CANCELLED_STATES:
            continue
        phase = legacy_enrich_phase(status)
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
public_changelog_path = f"{BASE}/public/data/project-changelog.json"
for p in (changelog_path, public_changelog_path):
    with open(p, "w") as f:
        json.dump(changelog_data, f, ensure_ascii=False, indent=2)

print()
print(f"Created {changelog_path}")
print(f"Changelog: {len(changelog_entries)} changes in last {CHANGELOG_WINDOW_DAYS} days")
print(f"  Preliminary: {summary['preliminary']}")
print(f"  Approved:    {summary['approved']}")
print(f"  Established: {summary['established']}")
print(f"  Date groups: {len(by_date_sorted)}")
