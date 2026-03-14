#!/usr/bin/env python3
"""
ETL: Fetch project geometry data from MiljøGIS WFS (wfs2-miljoegis.mim.dk)

Fetches OGC WFS 2.0.0 layers containing project boundaries, biodiversity
prioritization, nitrogen retention, and wetland potential data as GeoJSON.

Layers (vandprojekter workspace):
  kla_projektforslag       → 97 project proposals with geometries
  kla_projektomraader      → 3 project areas
  helhedsprojekter_tilsagn2020 → 2 comprehensive project grants (2020)
  kla_e23_bioprio          → 408,524 biodiversity prioritization polygons (large!)
  kvaelstofretention       → 4,239,419 nitrogen retention polygons (very large!)
  vaadomraadepotentiale    → 94,182 wetland potential polygons (large!)

Strategy: Fetch small actionable layers in full. For massive raster-like layers,
fetch only a bounded sample or metadata to avoid multi-GB downloads.
"""

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from urllib.parse import urlencode

from etl_log import log_etl_run

# Configuration
WFS_BASE = "https://wfs2-miljoegis.mim.dk/vandprojekter/ows"
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_DIR = REPO_ROOT / "data" / "miljoegis"

USER_AGENT = "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; open-source environmental monitor)"
TIMEOUT_SECONDS = 120  # WFS responses can be slow

# Layers to fetch in full (small enough for git)
FULL_LAYERS = [
    "kla_projektforslag",         # ~97 features — project proposals
    "kla_projektomraader",        # ~3 features — project areas
    "helhedsprojekter_tilsagn2020",  # ~2 features — 2020 grants
]

# Large layers — fetch only feature count + small sample
LARGE_LAYERS = [
    "kla_e23_bioprio",            # ~408K features — biodiversity
    "kvaelstofretention",         # ~4.2M features — nitrogen retention
    "vaadomraadepotentiale",      # ~94K features — wetland potential
]

# Sample size for large layers
SAMPLE_SIZE = 100


def wfs_get_feature(layer: str, max_features: int | None = None, start_index: int = 0) -> bytes | None:
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


def wfs_hit_count(layer: str) -> int | None:
    """Get the total feature count for a layer using resultType=hits."""
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": layer,
        "resultType": "hits",
    }
    url = f"{WFS_BASE}?{urlencode(params)}"
    print(f"  Counting {layer}...")

    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read().decode("utf-8")
            # Parse numberMatched from XML response
            import re
            match = re.search(r'numberMatched="(\d+)"', raw)
            if match:
                count = int(match.group(1))
                print(f"    ✓ {count:,} features")
                return count
            # Try numberReturned as fallback
            match = re.search(r'numberReturned="(\d+)"', raw)
            if match:
                count = int(match.group(1))
                print(f"    ✓ ~{count:,} features (from numberReturned)")
                return count
            print(f"    ⚠ Could not parse feature count from response")
            return None
    except (HTTPError, URLError) as e:
        print(f"    ✗ Error: {e}")
        return None


def main():
    print(f"MiljøGIS WFS ETL — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Output: {DATA_DIR}")
    print()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    summary = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "wfs_base": WFS_BASE,
        "coordinate_system": "EPSG:25832",
        "layers": {},
    }
    errors = []

    # 1. Fetch small layers in full
    print("=" * 60)
    print("FULL LAYERS (small — fetching all features)")
    print("=" * 60)
    for layer in FULL_LAYERS:
        raw = wfs_get_feature(layer)
        if raw:
            try:
                geojson = json.loads(raw)
                features = geojson.get("features", [])
                feature_count = len(features)

                filepath = DATA_DIR / f"{layer}.geojson"
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(geojson, f, ensure_ascii=False, indent=2)

                size = filepath.stat().st_size
                print(f"    Wrote {filepath.name}: {size:,} bytes ({feature_count} features)")

                # Extract property names from first feature
                props = list(features[0]["properties"].keys()) if features else []

                summary["layers"][layer] = {
                    "status": "full",
                    "feature_count": feature_count,
                    "file_size_bytes": size,
                    "properties": props,
                }
            except (json.JSONDecodeError, KeyError) as e:
                print(f"    ✗ Parse error: {e}")
                errors.append(layer)
        else:
            errors.append(layer)
        print()

    # 2. Fetch large layers — count + sample
    print("=" * 60)
    print("LARGE LAYERS (fetching count + sample)")
    print("=" * 60)
    for layer in LARGE_LAYERS:
        layer_info = {"status": "sampled"}

        # Get total count
        count = wfs_hit_count(layer)
        if count is not None:
            layer_info["total_feature_count"] = count

        # Fetch a sample
        raw = wfs_get_feature(layer, max_features=SAMPLE_SIZE)
        if raw:
            try:
                geojson = json.loads(raw)
                features = geojson.get("features", [])

                filepath = DATA_DIR / f"{layer}_sample.geojson"
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(geojson, f, ensure_ascii=False, indent=2)

                size = filepath.stat().st_size
                print(f"    Wrote {filepath.name}: {size:,} bytes ({len(features)} sample features)")

                props = list(features[0]["properties"].keys()) if features else []
                layer_info["sample_count"] = len(features)
                layer_info["sample_file_size_bytes"] = size
                layer_info["properties"] = props
            except (json.JSONDecodeError, KeyError) as e:
                print(f"    ✗ Parse error: {e}")
                errors.append(layer)
        else:
            errors.append(layer)

        summary["layers"][layer] = layer_info
        print()

    # Write summary
    summary["errors"] = errors
    summary_path = DATA_DIR / "summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # Print headline
    print("=" * 60)
    print("HEADLINE")
    print("=" * 60)
    for layer, info in summary["layers"].items():
        if info["status"] == "full":
            print(f"  {layer}: {info['feature_count']} features (full)")
        else:
            total = info.get("total_feature_count", "?")
            sample = info.get("sample_count", 0)
            print(f"  {layer}: {total} total ({sample} sampled)")
    if errors:
        print(f"\n  ⚠ Errors: {', '.join(errors)}")
    print()

    record_counts = {
        layer: info.get("feature_count", info.get("sample_count", 0))
        for layer, info in summary.get("layers", {}).items()
    }
    log_etl_run(
        source="miljoegis",
        endpoints=[f"wfs2-miljoegis.mim.dk (vandprojekter)"],
        records=record_counts,
        status="ok" if not errors else ("partial" if record_counts else "error"),
        notes=f"{len(record_counts)} layers fetched" + (f"; errors: {', '.join(errors)}" if errors else ""),
    )

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
