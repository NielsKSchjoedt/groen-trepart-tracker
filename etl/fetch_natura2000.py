#!/usr/bin/env python3
"""
ETL: Fetch Natura 2000 protected area boundaries from MiljøGIS WFS.

Fetches the `natur:natura_2000_omraader` layer (~250 features) which contains
all Danish Natura 2000 site boundaries. Each feature has `shape_area` in m²
which we use to compute total protected area and percentage of Danish land.

Also builds ``by_kommune.json`` (terrestrial Natura 2000 ha per municipality)
via centroid point-in-polygon assignment against DAWA municipality boundaries.

This data feeds the Nature pillar — "20% protected land" target and the
per-municipality naturePotentialHa figure.
"""

import json
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from urllib.parse import urlencode

from etl_log import log_etl_run
from spatial_utils import MunicipalityIndex, geometry_centroid

# Configuration
WFS_BASE = "https://wfs2-miljoegis.mim.dk/natur/ows"
LAYER = "natur:natura_2000_omraader"
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_DIR = REPO_ROOT / "data" / "natura2000"
KOMMUNER_GEOJSON = REPO_ROOT / "data" / "dawa" / "kommuner.geojson"

USER_AGENT = "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; open-source environmental monitor)"
TIMEOUT_SECONDS = 120

# Denmark's total land area in km² (from DST ARE207)
DENMARK_LAND_AREA_KM2 = 42_951


def wfs_get_feature(layer: str, max_features: int | None = None) -> bytes | None:
    """Fetch a WFS GetFeature request and return raw bytes."""
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": layer,
        "outputFormat": "application/json",
        "srsName": "EPSG:25832",
    }
    if max_features is not None:
        params["count"] = str(max_features)

    url = f"{WFS_BASE}?{urlencode(params)}"
    print(f"  Fetching {layer}: {url[:120]}...")

    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read()
            print(f"    ✓ {response.status} OK — {len(raw):,} bytes")
            return raw
    except HTTPError as e:
        print(f"    ✗ HTTP {e.code}: {e.reason}")
        return None
    except URLError as e:
        print(f"    ✗ Connection error: {e.reason}")
        return None


def build_by_kommune(features: list[dict], sites: list[dict]) -> dict[str, float]:
    """
    Assign each terrestrial Natura 2000 site to a municipality using centroid
    point-in-polygon against DAWA boundary polygons, then sum area per kode.

    Only non-marine sites are included (uses the same heuristic as the main
    fetch: name-based marine keyword check + area threshold).

    Results are saved to ``data/natura2000/by_kommune.json``.

    @param features - Raw GeoJSON feature list with 'geometry' and 'properties'
    @param sites    - Processed site dicts (includes 'likely_marine' and 'area_ha')
    @returns Dict mapping kommunekode → Natura 2000 terrestrial ha
    @example build_by_kommune(features, sites)  # → {'0101': 45.2, '0461': 320.1, ...}
    """
    if not KOMMUNER_GEOJSON.exists():
        print(f"  ⚠ {KOMMUNER_GEOJSON} not found — skipping by_kommune for Natura 2000")
        return {}

    print(f"  Building municipality spatial index...")
    idx = MunicipalityIndex.from_geojson(KOMMUNER_GEOJSON)
    print(f"    ✓ {len(idx)} municipalities indexed")

    # Build a lookup from n2000_nr → site info (area_ha, likely_marine)
    site_lookup = {str(s["n2000_nr"]): s for s in sites}

    kode_ha: dict[str, float] = defaultdict(float)
    assigned = 0
    skipped_marine = 0

    for feat in features:
        props = feat.get("properties", {})
        n2000_nr = str(props.get("n2000_nr", ""))
        area_m2 = props.get("shape_area", 0) or 0
        area_ha = area_m2 / 10_000

        site = site_lookup.get(n2000_nr, {})
        if site.get("likely_marine", False):
            skipped_marine += 1
            continue

        geo = feat.get("geometry")
        if not geo:
            continue
        centroid = geometry_centroid(geo)
        if centroid is None:
            continue

        x, y = centroid
        result = idx.find_kommune(x, y)
        if result:
            kode, _ = result
            kode_ha[kode] += area_ha
            assigned += 1

    result_dict = {kode: round(ha, 2) for kode, ha in sorted(kode_ha.items())}
    by_kommune_path = DATA_DIR / "by_kommune.json"
    with open(by_kommune_path, "w", encoding="utf-8") as f:
        json.dump(result_dict, f, ensure_ascii=False, indent=2)

    total_ha = sum(result_dict.values())
    print(f"  ✓ Natura 2000 by_kommune: {len(result_dict)} municipalities, {total_ha:,.0f} ha terrestrial")
    print(f"    ({assigned} sites assigned, {skipped_marine} marine sites skipped)")
    return result_dict


def main():
    start_time = time.time()
    print(f"Natura 2000 WFS ETL — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Output: {DATA_DIR}")
    print()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    errors = []

    # Fetch all Natura 2000 boundaries (~250 features, manageable size)
    raw = wfs_get_feature(LAYER)
    if not raw:
        errors.append("fetch_failed")
        log_etl_run(
            source="natura2000",
            endpoints=[f"wfs2-miljoegis.mim.dk (natur)"],
            records={},
            status="error",
            notes="Failed to fetch Natura 2000 boundaries",
            duration_seconds=time.time() - start_time,
        )
        return 1

    try:
        geojson = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"    ✗ JSON parse error: {e}")
        return 1

    features = geojson.get("features", [])
    print(f"    Parsed {len(features)} Natura 2000 sites")

    # Save full GeoJSON
    geojson_path = DATA_DIR / "natura_2000_omraader.geojson"
    with open(geojson_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    print(f"    Wrote {geojson_path.name}: {geojson_path.stat().st_size:,} bytes")

    # Compute area statistics
    # NOTE: Natura 2000 includes both marine and terrestrial sites.
    # Marine sites (Kattegat, Skagerrak, Vadehavet, etc.) are very large
    # and inflate the total far beyond Denmark's land area.
    # We use name-based heuristics to classify; precise marine/terrestrial
    # split would require spatial overlay with a coastline dataset.
    MARINE_KEYWORDS = [
        'kattegat', 'skagerrak', 'storebælt', 'lillebælt', 'bælt',
        'øresund', 'sund', 'havet', 'vadehav', 'banke', 'grund',
        'nordsøen', 'north sea',
    ]

    total_area_m2 = 0
    terrestrial_area_m2 = 0
    marine_area_m2 = 0
    sites = []
    for feat in features:
        props = feat.get("properties", {})
        area_m2 = props.get("shape_area", 0) or 0
        total_area_m2 += area_m2
        name = props.get("n2000_navn", "") or ""
        name_lower = name.lower()

        # Classify as marine if name matches marine keywords AND area > 10,000 ha
        is_likely_marine = (
            any(kw in name_lower for kw in MARINE_KEYWORDS)
            and area_m2 > 100_000_000  # > 10,000 ha
        )
        if is_likely_marine:
            marine_area_m2 += area_m2
        else:
            terrestrial_area_m2 += area_m2

        sites.append({
            "n2000_nr": props.get("n2000_nr", ""),
            "n2000_navn": name,
            "status": props.get("status", ""),
            "area_ha": round(area_m2 / 10_000, 1),
            "area_km2": round(area_m2 / 1_000_000, 2),
            "likely_marine": is_likely_marine,
        })

    total_area_ha = total_area_m2 / 10_000
    total_area_km2 = total_area_m2 / 1_000_000
    terrestrial_area_ha = terrestrial_area_m2 / 10_000
    terrestrial_area_km2 = terrestrial_area_m2 / 1_000_000
    terrestrial_pct = terrestrial_area_km2 / DENMARK_LAND_AREA_KM2 * 100

    # Sort by area descending
    sites.sort(key=lambda s: s["area_ha"], reverse=True)

    # Build summary
    summary = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "MiljøGIS WFS — natur:natura_2000_omraader",
        "wfs_base": WFS_BASE,
        "layer": LAYER,
        "coordinate_system": "EPSG:25832",
        "feature_count": len(features),
        "totals": {
            "total_area_m2": round(total_area_m2),
            "total_area_ha": round(total_area_ha, 1),
            "total_area_km2": round(total_area_km2, 1),
            "terrestrial_area_ha": round(terrestrial_area_ha, 1),
            "terrestrial_area_km2": round(terrestrial_area_km2, 1),
            "marine_area_ha": round(marine_area_m2 / 10_000, 1),
            "marine_area_km2": round(marine_area_m2 / 1_000_000, 1),
            "denmark_land_area_km2": DENMARK_LAND_AREA_KM2,
            "terrestrial_pct_of_land": round(terrestrial_pct, 2),
            "note": "Marine/terrestrial split is heuristic (name-based). "
                    "For precise split, spatial overlay with coastline would be needed.",
        },
        "sites": sites,
    }

    summary_path = DATA_DIR / "summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # Print headline
    print()
    print("=" * 60)
    print("NATURA 2000 — HEADLINE")
    print("=" * 60)
    print(f"  Sites:            {len(features)}")
    print(f"  Total area:       {total_area_ha:,.0f} ha ({total_area_km2:,.0f} km²)")
    print(f"  Terrestrial est.: {terrestrial_area_ha:,.0f} ha ({terrestrial_area_km2:,.0f} km²)")
    print(f"  Marine est.:      {marine_area_m2/10_000:,.0f} ha ({marine_area_m2/1_000_000:,.0f} km²)")
    print(f"  Terrestrial % of land: {terrestrial_pct:.1f}%")
    print(f"  Top 5 terrestrial sites:")
    terr_sites = [s for s in sites if not s["likely_marine"]]
    for s in terr_sites[:5]:
        print(f"    {s['n2000_nr']} {s['n2000_navn']}: {s['area_ha']:,.0f} ha")
    print()

    # Assign each terrestrial site to its municipality
    print("Assigning Natura 2000 sites to municipalities...")
    build_by_kommune(features, sites)

    duration = time.time() - start_time
    log_etl_run(
        source="natura2000",
        endpoints=[f"wfs2-miljoegis.mim.dk (natur)"],
        records={"natura_2000_sites": len(features)},
        status="ok" if not errors else "partial",
        notes=f"{len(features)} Natura 2000 sites, terrestrial est. {terrestrial_area_ha:,.0f} ha ({terrestrial_pct:.1f}% of land)",
        duration_seconds=duration,
    )

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
