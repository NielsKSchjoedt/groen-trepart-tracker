#!/usr/bin/env python3
"""
ETL: Fetch §3 protected nature type areas from MiljøGIS WFS.

Fetches the `natur:ais_par3` layer (~186,628 features) which contains all
Danish §3-protected nature areas (Naturbeskyttelseslovens §3: heaths, bogs,
meadows, salt marshes, etc.).

The layer is too large to fetch in one request, so we paginate through it
and aggregate statistics without storing all geometries. We save:
  - A summary with total area by nature type
  - A sample GeoJSON for verification
  - by_kommune.json: total §3 ha per municipality (centroid point-in-polygon
    against DAWA municipality boundaries — no kommunekode on WFS features)

This data feeds the Nature pillar — combined with Natura 2000 data to
compute the "20% protected land" target metric and the per-municipality
naturePotentialHa figure.

NOTE: Natura 2000 and §3 areas overlap significantly. The overlap deduction
is handled in build_dashboard_data.py, not here. This fetcher just reports
the raw §3 totals.
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
LAYER = "natur:ais_par3"
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_DIR = REPO_ROOT / "data" / "section3"
KOMMUNER_GEOJSON = REPO_ROOT / "data" / "dawa" / "kommuner.geojson"

USER_AGENT = "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; open-source environmental monitor)"
TIMEOUT_SECONDS = 180  # Large layer, needs more time

# How many features to fetch per page when aggregating
PAGE_SIZE = 10_000
# Max pages to fetch (safety limit: 20 pages × 10K = 200K features)
MAX_PAGES = 25

# Denmark's total land area in km² (from DST ARE207)
DENMARK_LAND_AREA_KM2 = 42_951


def wfs_get_feature(layer: str, max_features: int | None = None, start_index: int = 0,
                     property_names: list[str] | None = None) -> bytes | None:
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
    if start_index > 0:
        params["startIndex"] = str(start_index)
    if property_names:
        params["propertyName"] = ",".join(property_names)

    url = f"{WFS_BASE}?{urlencode(params)}"

    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read()
            return raw
    except HTTPError as e:
        print(f"    ✗ HTTP {e.code}: {e.reason}")
        return None
    except URLError as e:
        print(f"    ✗ Connection error: {e.reason}")
        return None


def wfs_hit_count(layer: str) -> int | None:
    """Get the total feature count for a layer."""
    import re
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": layer,
        "resultType": "hits",
    }
    url = f"{WFS_BASE}?{urlencode(params)}"
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read().decode("utf-8")
            match = re.search(r'numberMatched="(\d+)"', raw)
            if match:
                return int(match.group(1))
            match = re.search(r'numberReturned="(\d+)"', raw)
            if match:
                return int(match.group(1))
            return None
    except (HTTPError, URLError):
        return None


def aggregate_by_kommune(total_count: int) -> dict[str, float]:
    """
    Paginate through all §3 features WITH geometry, compute each feature's
    centroid, and assign it to a municipality using a point-in-polygon index
    built from the DAWA kommuner.geojson boundaries (EPSG:25832).

    Results are saved to ``data/section3/by_kommune.json`` and returned as a
    dict mapping kommunekode → total §3 ha.

    The §3 WFS layer has no kommunekode attribute, so spatial assignment is the
    only viable approach. Features that cannot be assigned (e.g. near borders,
    missing geometry) are silently skipped — they represent a small fraction.

    @param total_count - Expected total feature count from the WFS hits request
    @returns Dict mapping 4-digit kode → ha, e.g. {'0461': 1823.4, ...}
    @example aggregate_by_kommune(186628)  # → {'0101': 234.5, '0147': 12.3, ...}
    """
    by_kommune_path = DATA_DIR / "by_kommune.json"
    if by_kommune_path.exists():
        print(f"  §3 by_kommune.json already exists — skipping spatial aggregation (delete to re-run)")
        with open(by_kommune_path) as f:
            return json.load(f)

    if not KOMMUNER_GEOJSON.exists():
        print(f"  ⚠ {KOMMUNER_GEOJSON} not found — run fetch_dawa.py first, skipping by_kommune")
        return {}

    print(f"  Building municipality spatial index from {KOMMUNER_GEOJSON.name}...")
    idx = MunicipalityIndex.from_geojson(KOMMUNER_GEOJSON)
    print(f"    ✓ {len(idx)} municipalities indexed")

    kode_ha: dict[str, float] = defaultdict(float)
    total_features_fetched = 0
    assigned = 0
    page = 0

    print(f"  Aggregating §3 ha by municipality (fetching geometry, {PAGE_SIZE:,}/page)...")
    while page < MAX_PAGES:
        start_idx = page * PAGE_SIZE
        if total_count > 0 and start_idx >= total_count:
            break

        # Fetch WITH geometry (no property_names filter) — includes polygon coords
        raw = wfs_get_feature(LAYER, max_features=PAGE_SIZE, start_index=start_idx)
        if not raw:
            break

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            break

        features = data.get("features", [])
        if not features:
            break

        for feat in features:
            props = feat.get("properties", {})
            hectares = props.get("hectares", 0) or 0
            if hectares <= 0:
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
                kode_ha[kode] += hectares
                assigned += 1

        total_features_fetched += len(features)
        page += 1

        pct = (total_features_fetched / total_count * 100) if total_count > 0 else 0
        print(f"    Page {page}: {total_features_fetched:,}/{total_count:,} ({pct:.0f}%) — {assigned:,} assigned")

        if len(features) < PAGE_SIZE:
            break

    result_dict = {kode: round(ha, 2) for kode, ha in sorted(kode_ha.items())}
    with open(by_kommune_path, "w", encoding="utf-8") as f:
        json.dump(result_dict, f, ensure_ascii=False, indent=2)

    total_ha = sum(result_dict.values())
    print(f"  ✓ §3 by_kommune: {len(result_dict)} municipalities, {total_ha:,.0f} ha total")
    print(f"    ({assigned:,}/{total_features_fetched:,} features assigned)")
    return result_dict


def main():
    start_time = time.time()
    print(f"§3 Protected Nature ETL — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Output: {DATA_DIR}")
    print()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    errors = []

    # Get total count first
    print("  Counting §3 features...")
    total_count = wfs_hit_count(LAYER)
    if total_count is not None:
        print(f"    ✓ {total_count:,} total features")
    else:
        print("    ⚠ Could not get count, proceeding with pagination anyway")
        total_count = 0

    # Save a small sample with full geometry for verification
    print("  Fetching sample (100 features with geometry)...")
    raw_sample = wfs_get_feature(LAYER, max_features=100)
    if raw_sample:
        sample_geojson = json.loads(raw_sample)
        sample_path = DATA_DIR / "ais_par3_sample.geojson"
        with open(sample_path, "w", encoding="utf-8") as f:
            json.dump(sample_geojson, f, ensure_ascii=False, indent=2)
        print(f"    Wrote sample: {sample_path.stat().st_size:,} bytes")

    # Paginate through all features to aggregate statistics
    # We only need: a_type, hectares, area (no geometry needed for stats)
    print()
    print(f"  Aggregating §3 area statistics (pages of {PAGE_SIZE:,})...")

    type_totals = {}  # a_type → {"count": N, "area_ha": X}
    total_features_fetched = 0
    page = 0

    while page < MAX_PAGES:
        start_idx = page * PAGE_SIZE
        if total_count > 0 and start_idx >= total_count:
            break

        raw = wfs_get_feature(
            LAYER,
            max_features=PAGE_SIZE,
            start_index=start_idx,
            property_names=["a_type", "hectares", "area"],
        )
        if not raw:
            errors.append(f"page_{page}")
            break

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            errors.append(f"parse_page_{page}")
            break

        features = data.get("features", [])
        if not features:
            break

        for feat in features:
            props = feat.get("properties", {})
            a_type = str(props.get("a_type", "unknown") or "unknown")
            hectares = props.get("hectares", 0) or 0

            if a_type not in type_totals:
                type_totals[a_type] = {"count": 0, "area_ha": 0}
            type_totals[a_type]["count"] += 1
            type_totals[a_type]["area_ha"] += hectares

        total_features_fetched += len(features)
        page += 1

        # Progress
        pct = (total_features_fetched / total_count * 100) if total_count > 0 else 0
        print(f"    Page {page}: {total_features_fetched:,} / {total_count:,} features ({pct:.0f}%)")

        if len(features) < PAGE_SIZE:
            break  # Last page

    # Compute totals
    total_area_ha = sum(t["area_ha"] for t in type_totals.values())
    total_area_km2 = total_area_ha / 100
    pct_of_land = total_area_km2 / DENMARK_LAND_AREA_KM2 * 100

    # Nature type mapping — §3 uses numeric codes
    # These are Naturbeskyttelseslovens §3 type codes
    type_names = {
        # Freshwater
        "3110": "Sø (lake) — oligotrophic",
        "3130": "Sø (lake) — nutrient-poor",
        "3140": "Sø (lake) — calcareous",
        "3150": "Sø (lake) — eutrophic",
        "3160": "Sø (lake) — dystrophic",
        "3210": "Vandløb (stream/river)",
        "3220": "Vandløb (stream) — alpine",
        "3260": "Vandløb — lowland to montane",
        # Heaths and scrub
        "4010": "Hede (wet heath)",
        "4030": "Hede (dry heath)",
        "4110": "Hede (heath) — common",
        "4120": "Mose (bog/fen)",
        "4210": "Overdrev (dry grassland)",
        # Grasslands
        "5120": "Eng/Strandeng (meadow/salt marsh)",
        "6230": "Overdrev — species-rich Nardus",
        "6410": "Eng — Molinia meadow",
        # Bogs
        "7110": "Højmose (active raised bog)",
        "7120": "Mose (degraded raised bog)",
        "7140": "Mose (transition mire)",
        "7150": "Mose — Rhynchosporion",
        "7210": "Mose — calcareous fen",
        "7220": "Mose — petrifying springs",
        "7230": "Mose — alkaline fen",
    }

    # Build type breakdown sorted by area
    type_breakdown = []
    for a_type, stats in sorted(type_totals.items(), key=lambda x: x[1]["area_ha"], reverse=True):
        type_breakdown.append({
            "type": a_type,
            "name": type_names.get(a_type, a_type),
            "count": stats["count"],
            "area_ha": round(stats["area_ha"], 1),
            "area_km2": round(stats["area_ha"] / 100, 2),
        })

    # Build summary
    summary = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "MiljøGIS WFS — natur:ais_par3",
        "wfs_base": WFS_BASE,
        "layer": LAYER,
        "coordinate_system": "EPSG:25832",
        "total_feature_count": total_count,
        "features_aggregated": total_features_fetched,
        "totals": {
            "total_area_ha": round(total_area_ha, 1),
            "total_area_km2": round(total_area_km2, 1),
            "denmark_land_area_km2": DENMARK_LAND_AREA_KM2,
            "pct_of_land": round(pct_of_land, 2),
            "note": "Raw §3 total — overlaps with Natura 2000 must be deducted for combined protected area calculation",
        },
        "by_type": type_breakdown,
    }

    summary_path = DATA_DIR / "summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # Print headline
    print()
    print("=" * 60)
    print("§3 PROTECTED NATURE — HEADLINE")
    print("=" * 60)
    print(f"  Features:   {total_features_fetched:,}")
    print(f"  Total area: {total_area_ha:,.0f} ha ({total_area_km2:,.0f} km²)")
    print(f"  % of land:  {pct_of_land:.1f}% (raw, before Natura 2000 overlap deduction)")
    print(f"  By type:")
    for t in type_breakdown:
        print(f"    {str(t['type']):12s} {t['count']:>7,} features  {t['area_ha']:>10,.0f} ha")
    print()

    # Aggregate §3 ha per municipality via spatial join
    print("Aggregating §3 area per municipality (spatial join)...")
    by_kommune = aggregate_by_kommune(total_count)
    if by_kommune:
        top5 = sorted(by_kommune.items(), key=lambda x: x[1], reverse=True)[:5]
        print(f"  Top 5 §3 municipalities: {', '.join(f'{k}={v:.0f}ha' for k, v in top5)}")

    duration = time.time() - start_time
    log_etl_run(
        source="section3",
        endpoints=[f"wfs2-miljoegis.mim.dk (natur)"],
        records={"section3_areas": total_features_fetched, "nature_types": len(type_totals),
                 "section3_municipalities": len(by_kommune)},
        status="ok" if not errors else "partial",
        notes=f"{total_features_fetched:,} §3 areas, {total_area_ha:,.0f} ha total ({pct_of_land:.1f}% of land)",
        duration_seconds=duration,
    )

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
