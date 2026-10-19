#!/usr/bin/env python3
"""
Build a lightweight WGS84 GeoJSON for national §3 protected nature overlay.

Reads per-kommune chunks from ``data/section3/by-kommune/*.geojson`` (~327k
features total), merges them, filters to polygons >= 50 ha (national map cannot
render 300k+ micro-parcels), simplifies geometry, and outputs
``public/data/section3-simplified.geojson`` for the Leaflet map overlay.

Overlap ETL (build_project_nature_overlap.py) uses the full per-kommune dataset;
this file is visualization-only.

Run via:
  mise run build-section3-map
  or: cd etl && python3 build_section3_map.py
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

INPUT_DIR = REPO_ROOT / "data" / "section3" / "by-kommune"
OUTPUT_GEOJSON = REPO_ROOT / "public" / "data" / "section3-simplified.geojson"
OUTPUT_SIZE_WARNING_MB = 2.0
MIN_HECTARES = 50
SIMPLIFY_PCT = "10%"


def merge_kommune_files(output_path: Path) -> int:
    """Merge all per-kommune GeoJSON files into one FeatureCollection."""
    if not INPUT_DIR.is_dir():
        print(f"✗ Missing {INPUT_DIR} — run fetch_section3_by_kommune.py first")
        return 0

    kommune_files = sorted(INPUT_DIR.glob("*.geojson"))
    if not kommune_files:
        print(f"✗ No GeoJSON files in {INPUT_DIR}")
        return 0

    features: list[dict] = []
    for path in kommune_files:
        with open(path, encoding="utf-8") as f:
            fc = json.load(f)
        for feat in fc.get("features", []):
            geom = feat.get("geometry")
            if not geom:
                continue
            props = feat.get("properties") or {}
            features.append(
                {
                    "type": "Feature",
                    "geometry": geom,
                    "properties": {
                        "sourceId": props.get("sourceId"),
                        "a_type": props.get("a_type"),
                        "hectares": props.get("hectares"),
                    },
                }
            )

    out = {"type": "FeatureCollection", "features": features}
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    print(f"  Merged {len(features)} features from {len(kommune_files)} kommuner")
    return len(features)


def simplify_with_mapshaper(input_path: Path) -> bool:
    """Filter, simplify merged WGS84 GeoJSON with mapshaper."""
    mapshaper = shutil.which("mapshaper")
    if not mapshaper:
        print("  mapshaper not found — install: npm install -g mapshaper")
        return False

    print(
        f"  mapshaper: filter >= {MIN_HECTARES} ha, "
        f"simplify visvalingam {SIMPLIFY_PCT} → GeoJSON..."
    )
    cmd = [
        mapshaper,
        str(input_path),
        "-filter",
        f"hectares >= {MIN_HECTARES}",
        "-filter-fields",
        "sourceId,a_type,hectares",
        "-simplify",
        "visvalingam",
        SIMPLIFY_PCT,
        "keep-shapes",
        "-o",
        "format=geojson",
        "precision=0.001",
        str(OUTPUT_GEOJSON),
        "force",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  mapshaper failed:\n{result.stderr}")
        return False
    for line in result.stdout.splitlines():
        if line.strip():
            print(f"    {line}")
    return True


def add_metadata() -> None:
    """Attach map-layer caveat metadata to the output FeatureCollection."""
    with open(OUTPUT_GEOJSON, encoding="utf-8") as f:
        fc = json.load(f)

    fc["metadata"] = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "minHectares": MIN_HECTARES,
        "featureCount": len(fc.get("features", [])),
        "note": (
            f"National map overlay only: §3 polygons >= {MIN_HECTARES} ha. "
            "Full-resolution §3 data is used in overlap calculations."
        ),
        "source": "MiljøGIS WFS natur:ais_par3 (per-kommune fetch)",
    }

    with open(OUTPUT_GEOJSON, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))


def main() -> int:
    OUTPUT_GEOJSON.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        merged_path = Path(tmp) / "section3-merged.geojson"
        count = merge_kommune_files(merged_path)
        if count == 0:
            return 1

        merged_mb = merged_path.stat().st_size / (1024 * 1024)
        print(f"  Merged file: {merged_mb:.1f} MB")

        if not simplify_with_mapshaper(merged_path):
            return 1

    add_metadata()

    size_mb = OUTPUT_GEOJSON.stat().st_size / (1024 * 1024)
    with open(OUTPUT_GEOJSON, encoding="utf-8") as f:
        kept = len(json.load(f).get("features", []))
    print(f"✓ Wrote {OUTPUT_GEOJSON.relative_to(REPO_ROOT)} ({size_mb:.2f} MB, {kept} features)")
    if size_mb > OUTPUT_SIZE_WARNING_MB:
        print(
            f"  ⚠ File exceeds {OUTPUT_SIZE_WARNING_MB} MB target — "
            "consider tighter filter or simplification"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
