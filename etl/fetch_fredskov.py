#!/usr/bin/env python3
"""
ETL: Fetch protected forest (fredskov) and forest map data from MiljøGIS WFS.

Fetches two layers for the Afforestation pillar:

1. `np3basis2020:np3b2020_fredskov` (~59,822 features) — legally protected
   forests (fredede skove). Each feature has `areal` in m². This is a cadastral
   dataset tracking parcels with forest protection status.

2. `skovdrift:digitalt_skovkort_2022` (~61,588 features) — digital forest map
   showing current forest cover. Minimal properties but has polygon geometries.

These complement MARS's afforestation projects (which only tracks projects
in MARS catchments) and Klimaskovfonden's ~2,300 ha (voluntary projects,
fetched live via fetch_klimaskovfonden.py).

For the 250,000 ha afforestation target, the key metric is *new* forest since
the tripartite baseline. The fredskov dataset provides the legal baseline;
future digital forest maps can be compared against it to measure new planting.
"""

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from urllib.parse import urlencode

from etl_log import log_etl_run

# Configuration
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_DIR = REPO_ROOT / "data" / "forest"

USER_AGENT = "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; open-source environmental monitor)"
TIMEOUT_SECONDS = 180

# Layers to fetch
LAYERS = {
    "fredskov": {
        "wfs_base": "https://wfs2-miljoegis.mim.dk/np3basis2020/ows",
        "layer": "np3basis2020:np3b2020_fredskov",
        "description": "Protected forests (cadastral parcels with fredskov status)",
        "area_field": "areal",  # area in m²
        "page_size": 10_000,
        "max_pages": 10,
    },
    "skovkort": {
        "wfs_base": "https://wfs2-miljoegis.mim.dk/skovdrift/ows",
        "layer": "skovdrift:digitalt_skovkort_2022",
        "description": "Digital forest map 2022 (current forest cover polygons)",
        "area_field": None,  # no area property — geometry only
        "page_size": 5_000,
        "max_pages": 2,  # Just count + sample — geometry-only layer
    },
}


def wfs_get_feature(wfs_base: str, layer: str, max_features: int | None = None,
                     start_index: int = 0, property_names: list[str] | None = None) -> bytes | None:
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

    url = f"{wfs_base}?{urlencode(params)}"
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            return response.read()
    except (HTTPError, URLError) as e:
        print(f"    ✗ Error: {e}")
        return None


def wfs_hit_count(wfs_base: str, layer: str) -> int | None:
    """Get the total feature count for a layer."""
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": layer,
        "resultType": "hits",
    }
    url = f"{wfs_base}?{urlencode(params)}"
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read().decode("utf-8")
            match = re.search(r'numberMatched="(\d+)"', raw)
            if match:
                return int(match.group(1))
            return None
    except (HTTPError, URLError):
        return None


def fetch_fredskov(config: dict) -> dict:
    """Fetch and aggregate fredskov (protected forest) data."""
    wfs_base = config["wfs_base"]
    layer = config["layer"]

    print(f"  Counting {layer}...")
    total_count = wfs_hit_count(wfs_base, layer)
    if total_count:
        print(f"    ✓ {total_count:,} features")

    # Save sample with geometry
    print(f"  Fetching sample (100 features)...")
    raw = wfs_get_feature(wfs_base, layer, max_features=100)
    if raw:
        sample = json.loads(raw)
        sample_path = DATA_DIR / "fredskov_sample.geojson"
        with open(sample_path, "w", encoding="utf-8") as f:
            json.dump(sample, f, ensure_ascii=False, indent=2)
        print(f"    Wrote sample: {sample_path.stat().st_size:,} bytes")

    # Paginate to aggregate area by municipality
    print(f"  Aggregating area statistics...")
    total_area_m2 = 0
    total_features = 0
    municipality_areas = {}
    page = 0

    while page < config["max_pages"]:
        start_idx = page * config["page_size"]
        if total_count and start_idx >= total_count:
            break

        raw = wfs_get_feature(
            wfs_base, layer,
            max_features=config["page_size"],
            start_index=start_idx,
            property_names=["areal", "elavsnavn"],
        )
        if not raw:
            break

        data = json.loads(raw)
        features = data.get("features", [])
        if not features:
            break

        for feat in features:
            props = feat.get("properties", {})
            area = props.get("areal", 0) or 0
            total_area_m2 += area
            # Group by ejerlav (cadastral district) for rough geographic breakdown
            elav = props.get("elavsnavn", "unknown") or "unknown"
            municipality_areas[elav] = municipality_areas.get(elav, 0) + area

        total_features += len(features)
        page += 1
        pct = (total_features / total_count * 100) if total_count else 0
        print(f"    Page {page}: {total_features:,} / {total_count or '?':,} ({pct:.0f}%)")

        if len(features) < config["page_size"]:
            break

    total_area_ha = total_area_m2 / 10_000
    total_area_km2 = total_area_m2 / 1_000_000

    return {
        "total_count": total_count or total_features,
        "features_aggregated": total_features,
        "total_area_m2": round(total_area_m2),
        "total_area_ha": round(total_area_ha, 1),
        "total_area_km2": round(total_area_km2, 1),
        "cadastral_districts": len(municipality_areas),
    }


def fetch_skovkort(config: dict) -> dict:
    """Fetch forest map metadata (count only — no area property)."""
    wfs_base = config["wfs_base"]
    layer = config["layer"]

    print(f"  Counting {layer}...")
    total_count = wfs_hit_count(wfs_base, layer)
    if total_count:
        print(f"    ✓ {total_count:,} forest polygons")

    # Save small sample
    print(f"  Fetching sample (10 features)...")
    raw = wfs_get_feature(wfs_base, layer, max_features=10)
    if raw:
        sample = json.loads(raw)
        sample_path = DATA_DIR / "skovkort_2022_sample.geojson"
        with open(sample_path, "w", encoding="utf-8") as f:
            json.dump(sample, f, ensure_ascii=False, indent=2)
        print(f"    Wrote sample: {sample_path.stat().st_size:,} bytes")

    return {
        "total_count": total_count or 0,
        "note": "Geometry-only layer — no area property. Feature count indicates forest cover extent.",
    }


def main():
    start_time = time.time()
    print(f"Forest Data WFS ETL — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Output: {DATA_DIR}")
    print()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    errors = []
    results = {}

    # Fetch fredskov
    print("=" * 60)
    print("FREDSKOV (Protected Forest)")
    print("=" * 60)
    try:
        results["fredskov"] = fetch_fredskov(LAYERS["fredskov"])
    except Exception as e:
        print(f"    ✗ Error: {e}")
        errors.append("fredskov")
        results["fredskov"] = {"error": str(e)}
    print()

    # Fetch skovkort
    print("=" * 60)
    print("DIGITAL SKOVKORT 2022 (Forest Map)")
    print("=" * 60)
    try:
        results["skovkort_2022"] = fetch_skovkort(LAYERS["skovkort"])
    except Exception as e:
        print(f"    ✗ Error: {e}")
        errors.append("skovkort")
        results["skovkort_2022"] = {"error": str(e)}
    print()

    # Build summary
    summary = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "sources": {
            "fredskov": {
                "description": LAYERS["fredskov"]["description"],
                "wfs_base": LAYERS["fredskov"]["wfs_base"],
                "layer": LAYERS["fredskov"]["layer"],
                **results.get("fredskov", {}),
            },
            "skovkort_2022": {
                "description": LAYERS["skovkort"]["description"],
                "wfs_base": LAYERS["skovkort"]["wfs_base"],
                "layer": LAYERS["skovkort"]["layer"],
                **results.get("skovkort_2022", {}),
            },
        },
        "context": {
            "mars_afforestation_ha": 49,
            "klimaskovfonden_ha": "see data/klimaskovfonden/summary.json (fetched live)",
            "national_target_ha": 250000,
            "note": "Fredskov represents the legally protected forest baseline. "
                    "The afforestation target (250,000 ha new forest by 2045) should be measured "
                    "as new forest area above this baseline.",
        },
    }

    summary_path = DATA_DIR / "summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # Print headline
    print("=" * 60)
    print("FOREST DATA — HEADLINE")
    print("=" * 60)
    fs = results.get("fredskov", {})
    print(f"  Fredskov:  {fs.get('total_count', '?'):,} parcels, {fs.get('total_area_ha', '?'):,} ha")
    sk = results.get("skovkort_2022", {})
    print(f"  Skovkort:  {sk.get('total_count', '?'):,} forest polygons")
    print(f"  Context:   Klimaskovfonden data now fetched separately (fetch_klimaskovfonden.py)")
    print(f"  Target:    250,000 ha new forest by 2045")
    print()

    duration = time.time() - start_time
    records = {}
    if "fredskov" in results and "error" not in results["fredskov"]:
        records["fredskov_parcels"] = results["fredskov"].get("features_aggregated", 0)
    if "skovkort_2022" in results and "error" not in results["skovkort_2022"]:
        records["skovkort_polygons"] = results["skovkort_2022"].get("total_count", 0)

    log_etl_run(
        source="forest",
        endpoints=["wfs2-miljoegis.mim.dk (np3basis2020, skovdrift)"],
        records=records,
        status="ok" if not errors else "partial",
        notes=f"Fredskov: {fs.get('total_area_ha', '?')} ha; Skovkort: {sk.get('total_count', '?')} polygons",
        duration_seconds=duration,
    )

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
