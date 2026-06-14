#!/usr/bin/env python3
"""
Build a lightweight WGS84 GeoJSON for Natura 2000 terrestrial habitatområder.

Reads ``data/natura2000/natura_2000_omraader.geojson`` (~34 MB, EPSG:25832),
filters out likely-marine sites, reprojects to WGS84, simplifies geometry, and
outputs ``public/data/natura2000-simplified.geojson`` for the Leaflet map overlay.

Run via:
  mise run build-natura2000-map
  or: cd etl && python3 build_natura2000_map.py
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

INPUT_GEOJSON = REPO_ROOT / "data" / "natura2000" / "natura_2000_omraader.geojson"
OUTPUT_GEOJSON = REPO_ROOT / "public" / "data" / "natura2000-simplified.geojson"
OUTPUT_SIZE_WARNING_MB = 2.0

MARINE_KEYWORDS = [
    "kattegat",
    "skagerrak",
    "storebælt",
    "lillebælt",
    "bælt",
    "øresund",
    "sund",
    "havet",
    "vadehav",
    "banke",
    "grund",
    "nordsøen",
    "north sea",
]


def is_likely_marine(props: dict) -> bool:
    """Match marine heuristic from fetch_natura2000.py / build_kommune_benchmark.py."""
    name = str(props.get("n2000_navn") or "").lower()
    area_m2 = float(props.get("shape_area") or 0)
    return any(kw in name for kw in MARINE_KEYWORDS) and area_m2 > 100_000_000


def filter_terrestrial(input_path: Path, output_path: Path) -> int:
    """Write terrestrial-only features to a temporary GeoJSON; return feature count."""
    print(f"  Reading {input_path.name}...")
    with open(input_path, encoding="utf-8") as f:
        fc = json.load(f)

    terrestrial = []
    for feat in fc.get("features", []):
        props = feat.get("properties") or {}
        if is_likely_marine(props):
            continue
        terrestrial.append(feat)

    out = {"type": "FeatureCollection", "features": terrestrial}
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    print(f"  Kept {len(terrestrial)} terrestrial features (of {len(fc.get('features', []))})")
    return len(terrestrial)


def build_with_mapshaper_only(wgs84_path: Path) -> bool:
    """Simplify WGS84 GeoJSON with mapshaper."""
    mapshaper = shutil.which("mapshaper")
    if not mapshaper:
        print("  mapshaper not found — install: npm install -g mapshaper")
        return False

    print("  mapshaper: simplify visvalingam 1% → GeoJSON...")
    cmd = [
        mapshaper,
        str(wgs84_path),
        "-filter-fields",
        "n2000_nr,n2000_navn,status",
        "-simplify",
        "visvalingam",
        "1%",
        "keep-shapes",
        "-o",
        "format=geojson",
        "precision=0.0001",
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


def build_with_ogr2ogr_mapshaper(terrestrial_path: Path) -> bool:
    """Reproject EPSG:25832 → WGS84 and simplify with mapshaper."""
    ogr2ogr = shutil.which("ogr2ogr")
    if not ogr2ogr:
        print("  ogr2ogr not found — will try Python reprojection")
        return False

    with tempfile.TemporaryDirectory() as tmp:
        wgs84_path = Path(tmp) / "n2000-wgs84.geojson"
        print("  ogr2ogr: reprojecting EPSG:25832 → WGS84...")
        r1 = subprocess.run(
            [
                ogr2ogr,
                "-f",
                "GeoJSON",
                "-s_srs",
                "EPSG:25832",
                "-t_srs",
                "EPSG:4326",
                str(wgs84_path),
                str(terrestrial_path),
            ],
            capture_output=True,
            text=True,
        )
        if r1.returncode != 0:
            print(f"  ogr2ogr failed: {r1.stderr}")
            return False

        return build_with_mapshaper_only(wgs84_path)


def build_with_python_mapshaper(terrestrial_path: Path) -> bool:
    """Pure-Python reproject + mapshaper simplify."""
    # Reuse UTM math from build_kommune_topojson
    sys.path.insert(0, str(SCRIPT_DIR))
    from build_kommune_topojson import reproject_geojson_python  # noqa: PLC0415

    with tempfile.TemporaryDirectory() as tmp:
        wgs84_path = Path(tmp) / "n2000-wgs84.geojson"
        print("  Python: reprojecting EPSG:25832 → WGS84...")
        reproject_geojson_python(terrestrial_path, wgs84_path)
        return build_with_mapshaper_only(wgs84_path)


def main() -> int:
    if not INPUT_GEOJSON.exists():
        print(f"✗ Missing {INPUT_GEOJSON} — run fetch_natura2000.py first")
        return 1

    OUTPUT_GEOJSON.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        terrestrial_path = Path(tmp) / "n2000-terrestrial.geojson"
        count = filter_terrestrial(INPUT_GEOJSON, terrestrial_path)
        if count == 0:
            print("✗ No terrestrial features found")
            return 1

        success = build_with_ogr2ogr_mapshaper(terrestrial_path)
        if not success:
            print("  Falling back to Python reprojection...")
            success = build_with_python_mapshaper(terrestrial_path)
        if not success:
            return 1

    size_mb = OUTPUT_GEOJSON.stat().st_size / (1024 * 1024)
    print(f"✓ Wrote {OUTPUT_GEOJSON.relative_to(REPO_ROOT)} ({size_mb:.2f} MB)")
    if size_mb > OUTPUT_SIZE_WARNING_MB:
        print(f"  ⚠ File exceeds {OUTPUT_SIZE_WARNING_MB} MB target — consider tighter simplification")

    return 0


if __name__ == "__main__":
    sys.exit(main())
