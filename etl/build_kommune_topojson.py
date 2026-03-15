#!/usr/bin/env python3
"""
Build a lightweight WGS84 TopoJSON file for 98 Danish municipalities.

Reads `data/dawa/kommuner.geojson` (EPSG:25832, ~114 MB), reprojects to
WGS84, simplifies the geometry, and outputs `public/data/kommuner.topo.json`
(target: <500 KB) for use by the Leaflet choropleth map in KommuneMap.tsx.

Execution strategy (in priority order):
  1. mapshaper  — best quality; single command handles reproject + simplify + topojson
  2. ogr2ogr + geo2topo + toposimplify — fallback using GDAL + topojson-server pipeline
  3. Pure Python  — last resort; inline UTM→WGS84 math + geo2topo CLI only

Prerequisites (already handled by `mise run setup`):
  npm install -g mapshaper topojson-server topojson-simplify topojson-client

Run via:
  mise run build-kommune-map
  or directly: cd etl && python3 build_kommune_topojson.py
"""

import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

INPUT_GEOJSON = REPO_ROOT / "data" / "dawa" / "kommuner.geojson"
OUTPUT_TOPOJSON = REPO_ROOT / "public" / "data" / "kommuner.topo.json"
OUTPUT_SIZE_WARNING_KB = 600


# ---------------------------------------------------------------------------
# Pure-Python UTM32N → WGS84 conversion
# (same algorithm as fetch_naturstyrelsen_skov.py)
# ---------------------------------------------------------------------------

def utm32n_to_wgs84(easting: float, northing: float) -> tuple[float, float]:
    """
    Approximate conversion from EPSG:25832 (ETRS89 / UTM zone 32N) to WGS84.

    Accuracy: ~1 m for Denmark (sufficient for map display).

    @param easting - UTM easting in metres
    @param northing - UTM northing in metres
    @returns (longitude, latitude) in decimal degrees (WGS84)

    @example utm32n_to_wgs84(723996.4, 6181935.9)  # → (12.49, 55.70) approx
    """
    k0 = 0.9996
    a = 6378137.0
    f = 1 / 298.257223563
    e = math.sqrt(2 * f - f * f)
    e2 = e * e
    e_prime2 = e2 / (1 - e2)

    x = easting - 500000.0
    y = northing

    M = y / k0
    mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))

    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (mu
            + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
            + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
            + (151 * e1 ** 3 / 96) * math.sin(6 * mu))

    N1 = a / math.sqrt(1 - e2 * math.sin(phi1) ** 2)
    T1 = math.tan(phi1) ** 2
    C1 = e_prime2 * math.cos(phi1) ** 2
    R1 = a * (1 - e2) / (1 - e2 * math.sin(phi1) ** 2) ** 1.5
    D = x / (N1 * k0)

    lat = phi1 - (N1 * math.tan(phi1) / R1) * (
        D ** 2 / 2
        - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * e_prime2) * D ** 4 / 24
        + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2
           - 252 * e_prime2 - 3 * C1 ** 2) * D ** 6 / 720
    )

    lon_central = math.radians(9.0)
    lon = lon_central + (
        D
        - (1 + 2 * T1 + C1) * D ** 3 / 6
        + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2
           + 8 * e_prime2 + 24 * T1 ** 2) * D ** 5 / 120
    ) / math.cos(phi1)

    return (round(math.degrees(lon), 6), round(math.degrees(lat), 6))


def _reproject_ring(ring: list) -> list:
    """Reproject a coordinate ring from EPSG:25832 to WGS84."""
    return [list(utm32n_to_wgs84(c[0], c[1])) for c in ring]


def _reproject_geometry(geom: dict) -> dict:
    """Reproject a GeoJSON geometry from EPSG:25832 to WGS84."""
    gtype = geom.get("type")
    coords = geom.get("coordinates", [])
    if gtype == "Polygon":
        return {"type": "Polygon", "coordinates": [_reproject_ring(r) for r in coords]}
    if gtype == "MultiPolygon":
        return {
            "type": "MultiPolygon",
            "coordinates": [[_reproject_ring(r) for r in poly] for poly in coords],
        }
    return geom


def reproject_geojson_python(input_path: Path, output_path: Path) -> None:
    """
    Reproject all features in a GeoJSON file from EPSG:25832 to WGS84 using
    pure-Python UTM math. Writes a WGS84 GeoJSON to output_path.

    Note: Simplification is NOT applied here; this produces an intermediate
    full-resolution WGS84 GeoJSON. Call geo2topo afterwards for simplification.

    @param input_path - Path to EPSG:25832 GeoJSON file
    @param output_path - Path to write WGS84 GeoJSON file
    """
    print("  Reading GeoJSON (this may take a moment for 114 MB)...")
    with open(input_path, encoding="utf-8") as f:
        fc = json.load(f)

    total = len(fc.get("features", []))
    print(f"  Reprojecting {total} features from EPSG:25832 to WGS84...")

    out_features = []
    for i, feat in enumerate(fc.get("features", [])):
        geom = feat.get("geometry")
        reproj_geom = _reproject_geometry(geom) if geom else None
        out_features.append({**feat, "geometry": reproj_geom})
        if (i + 1) % 20 == 0:
            print(f"    {i + 1}/{total} features reprojected...")

    out_fc = {
        "type": "FeatureCollection",
        "features": out_features,
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(out_fc, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = output_path.stat().st_size // 1024
    print(f"  Written {size_kb} KB WGS84 GeoJSON to {output_path}")


# ---------------------------------------------------------------------------
# Strategy 1: ogr2ogr (reproject) + mapshaper (simplify + topojson)
# ---------------------------------------------------------------------------

def build_with_ogr2ogr_mapshaper(tmp_dir: str) -> bool:
    """
    Two-step pipeline: ogr2ogr reprojects EPSG:25832 → WGS84 (mapshaper
    cannot auto-detect the CRS embedded in the raw DAWA GeoJSON), then
    mapshaper simplifies and converts to TopoJSON.

    dp 2% keep-shapes is a good trade-off between file size and visual
    fidelity at zoom 7-12 for Denmark.

    @param tmp_dir - Temporary directory for intermediate files
    @returns True if both steps succeeded, False otherwise
    """
    ogr2ogr = shutil.which("ogr2ogr")
    mapshaper = shutil.which("mapshaper")

    if not ogr2ogr:
        print("  ogr2ogr not found — skipping strategy 1 (install GDAL: brew install gdal)")
        return False
    if not mapshaper:
        print("  mapshaper not found — skipping strategy 1 (install: npm install -g mapshaper)")
        return False

    wgs84_path = os.path.join(tmp_dir, "kommuner-wgs84.geojson")
    print(f"  ogr2ogr: reprojecting EPSG:25832 → WGS84...")
    r1 = subprocess.run(
        [ogr2ogr, "-f", "GeoJSON", "-s_srs", "EPSG:25832", "-t_srs", "EPSG:4326",
         wgs84_path, str(INPUT_GEOJSON)],
        capture_output=True, text=True,
    )
    if r1.returncode != 0:
        print(f"  ogr2ogr failed: {r1.stderr}")
        return False

    # 0.5% Visvalingam simplification (weighted-area algorithm, better for
    # coastal features than Douglas-Peucker) keeps ~80 vertices per feature on
    # average — enough to render accurate boundaries at zoom 7-12.
    # quantization=1e4 encodes coordinates as 4-digit integers, cutting the
    # arc payload roughly in half vs the default 1e6 (sufficient for zoom 7-12).
    # filter-fields strips DAWA metadata, keeping only kode+navn.
    print(f"  mapshaper: filter-fields, visvalingam 0.2%, quantization=1e4 → TopoJSON...")
    cmd = [
        mapshaper, wgs84_path,
        "-filter-fields", "kode,navn",
        "-simplify", "visvalingam", "0.2%", "keep-shapes",
        "-o", "format=topojson", f"quantization=10000", str(OUTPUT_TOPOJSON),
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


# ---------------------------------------------------------------------------
# Strategy 2: ogr2ogr + geo2topo + toposimplify
# ---------------------------------------------------------------------------

def build_with_ogr2ogr_geo2topo(tmp_dir: str) -> bool:
    """
    Fallback pipeline: ogr2ogr reprojects EPSG:25832 → WGS84, then geo2topo
    converts to TopoJSON, then toposimplify reduces geometry with a tolerance
    of 0.001° (~100 m, adequate for zoom 7-12), then topoquantize reduces
    coordinate precision for further size reduction.

    Target output: ~300-500 KB. The previous 0.00001° tolerance (~1 m) was
    far too tight and produced 1 MB output.

    @param tmp_dir - Temporary directory for intermediate files
    @returns True if the full pipeline succeeded, False otherwise
    """
    ogr2ogr = shutil.which("ogr2ogr")
    geo2topo = shutil.which("geo2topo")
    toposimplify = shutil.which("toposimplify")
    topoquantize = shutil.which("topoquantize")

    if not all([ogr2ogr, geo2topo, toposimplify, topoquantize]):
        missing = [n for n, p in [("ogr2ogr", ogr2ogr), ("geo2topo", geo2topo),
                                   ("toposimplify", toposimplify), ("topoquantize", topoquantize)] if not p]
        print(f"  Missing tools: {', '.join(missing)} — skipping strategy 2")
        return False

    wgs84_path = os.path.join(tmp_dir, "kommuner-wgs84.geojson")
    print(f"  ogr2ogr: reprojecting EPSG:25832 → WGS84...")
    r1 = subprocess.run(
        [ogr2ogr, "-f", "GeoJSON", "-s_srs", "EPSG:25832", "-t_srs", "EPSG:4326",
         wgs84_path, str(INPUT_GEOJSON)],
        capture_output=True, text=True,
    )
    if r1.returncode != 0:
        print(f"  ogr2ogr failed: {r1.stderr}")
        return False

    # Tolerance 0.001° ≈ 100 m — good enough for a choropleth at zoom 7-12.
    # (The previous 0.00001° was ~1 m, producing no meaningful simplification.)
    print("  geo2topo + toposimplify (0.001°) + topoquantize pipeline...")
    with open(OUTPUT_TOPOJSON, "w") as f_out:
        p1 = subprocess.Popen([geo2topo, f"kommuner={wgs84_path}"], stdout=subprocess.PIPE)
        p2 = subprocess.Popen([toposimplify, "-p", "0.001", "-f"], stdin=p1.stdout, stdout=subprocess.PIPE)
        assert p1.stdout is not None
        p1.stdout.close()
        p3 = subprocess.Popen([topoquantize, "1e5"], stdin=p2.stdout, stdout=f_out)
        assert p2.stdout is not None
        p2.stdout.close()
        p3.wait()
        p2.wait()
        p1.wait()

    if p3.returncode != 0:
        print("  topojson pipeline failed")
        return False
    return True


# ---------------------------------------------------------------------------
# Strategy 3: Pure Python reproject + geo2topo
# ---------------------------------------------------------------------------

def build_with_python_geo2topo(tmp_dir: str) -> bool:
    """
    Last-resort pipeline: Python UTM math handles reprojection, then geo2topo
    converts to TopoJSON. Does NOT simplify — the output will be larger.

    @param tmp_dir - Temporary directory for intermediate files
    @returns True if successful, False otherwise
    """
    geo2topo = shutil.which("geo2topo")
    toposimplify = shutil.which("toposimplify")
    topoquantize = shutil.which("topoquantize")

    if not geo2topo:
        print("  geo2topo not found — cannot build TopoJSON without CLI tools")
        print("  Install via: npm install -g topojson-server topojson-simplify topojson-client")
        return False

    wgs84_path = Path(tmp_dir) / "kommuner-wgs84.geojson"
    reproject_geojson_python(INPUT_GEOJSON, wgs84_path)

    print("  geo2topo converting to TopoJSON...")
    with open(OUTPUT_TOPOJSON, "w") as f_out:
        if toposimplify and topoquantize:
            p1 = subprocess.Popen([geo2topo, f"kommuner={wgs84_path}"], stdout=subprocess.PIPE)
            p2 = subprocess.Popen([toposimplify, "-p", "0.001", "-f"], stdin=p1.stdout, stdout=subprocess.PIPE)
            assert p1.stdout is not None
            p1.stdout.close()
            p3 = subprocess.Popen([topoquantize, "1e5"], stdin=p2.stdout, stdout=f_out)
            assert p2.stdout is not None
            p2.stdout.close()
            p3.wait(); p2.wait(); p1.wait()
        else:
            r = subprocess.run([geo2topo, f"kommuner={wgs84_path}"], stdout=f_out)
            if r.returncode != 0:
                return False
    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if not INPUT_GEOJSON.exists():
        print(f"ERROR: {INPUT_GEOJSON} not found.")
        print("Run etl/fetch_dawa.py first to download the municipality boundaries.")
        sys.exit(1)

    OUTPUT_TOPOJSON.parent.mkdir(parents=True, exist_ok=True)

    size_mb = INPUT_GEOJSON.stat().st_size // 1_000_000
    print(f"Input: {INPUT_GEOJSON} ({size_mb} MB, EPSG:25832)")
    print(f"Output: {OUTPUT_TOPOJSON}")
    print()

    with tempfile.TemporaryDirectory() as tmp_dir:
        success = False

        print("Strategy 1: ogr2ogr (reproject) + mapshaper (simplify + topojson)")
        success = build_with_ogr2ogr_mapshaper(tmp_dir)

        if not success:
            print()
            print("Strategy 2: ogr2ogr + geo2topo + toposimplify (0.001°)")
            success = build_with_ogr2ogr_geo2topo(tmp_dir)

        if not success:
            print()
            print("Strategy 3: Pure Python reproject + geo2topo")
            success = build_with_python_geo2topo(tmp_dir)

        if not success:
            print()
            print("ERROR: All strategies failed.")
            print("Install mapshaper: npm install -g mapshaper")
            sys.exit(1)

    size_kb = OUTPUT_TOPOJSON.stat().st_size // 1024
    print()
    print(f"Output: {OUTPUT_TOPOJSON} ({size_kb} KB)")

    if size_kb > OUTPUT_SIZE_WARNING_KB:
        print(f"WARNING: File is {size_kb} KB (>{OUTPUT_SIZE_WARNING_KB} KB target).")
        print("Consider installing mapshaper for better simplification: npm install -g mapshaper")
    else:
        print(f"File size: {size_kb} KB (within {OUTPUT_SIZE_WARNING_KB} KB target)")


if __name__ == "__main__":
    main()
