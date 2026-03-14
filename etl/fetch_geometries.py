#!/usr/bin/env python3
"""
ETL: Fetch project geometries from MARS API and convert to GeoJSON.

Reads geoLocationIds from the plans data (projects + sketches),
fetches WKT geometry from /api/geometries/{id}, converts from
ETRS89/UTM32N (EPSG:25832) to WGS84 (EPSG:4326), simplifies
using adaptive Douglas-Peucker tolerance, and outputs a single
JSON lookup file.

Two-stage pipeline:
  1. Fetch raw WKT from MARS → cache in data/mars/geometries-wkt.json
  2. Process cached WKT (simplify + reproject) → public/data/project-geometries.json

Use --reprocess to re-simplify from cached WKT without re-fetching.

Output: public/data/project-geometries.json
Format: { "<geoLocationId>": [[lng,lat], [lng,lat], ...], ... }
  - Stores only the exterior ring of the first polygon (sufficient for mini-maps)
  - Coordinates rounded to 5 decimal places (~1.1m precision)
"""

import argparse
import json
import math
import re
import sys
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_DIR = REPO_ROOT / "data" / "mars"
WKT_CACHE_PATH = DATA_DIR / "geometries-wkt.json"
OUTPUT_PATH = REPO_ROOT / "public" / "data" / "project-geometries.json"

MARS_BASE = "https://mars.sgav.dk/api"
USER_AGENT = "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; open-source environmental monitor)"
TIMEOUT_SECONDS = 15

REQUEST_DELAY = 0.05  # 50ms between requests — polite rate limiting


# --------------- UTM32N → WGS84 conversion ---------------

def utm32n_to_wgs84(easting: float, northing: float) -> tuple[float, float]:
    """Convert ETRS89/UTM zone 32N (EPSG:25832) to WGS84 (EPSG:4326).

    Returns (longitude, latitude) in degrees.
    Uses the Karney-style reverse UTM formulae with GRS80 ellipsoid.

    Args:
        easting: UTM easting coordinate (meters)
        northing: UTM northing coordinate (meters)

    Returns:
        Tuple of (longitude, latitude) in decimal degrees

    Example:
        >>> utm32n_to_wgs84(574370, 6220600)
        (10.0, 56.1...)
    """
    a = 6378137.0
    f = 1 / 298.257222101
    e2 = 2 * f - f * f
    e = math.sqrt(e2)

    k0 = 0.9996
    lon0 = math.radians(9.0)  # Central meridian for zone 32

    x = easting - 500000.0
    y = northing

    M = y / k0
    mu = M / (a * (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256))

    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))

    phi1 = mu + (3*e1/2 - 27*e1**3/32) * math.sin(2*mu)
    phi1 += (21*e1**2/16 - 55*e1**4/32) * math.sin(4*mu)
    phi1 += (151*e1**3/96) * math.sin(6*mu)
    phi1 += (1097*e1**4/512) * math.sin(8*mu)

    sin_phi1 = math.sin(phi1)
    cos_phi1 = math.cos(phi1)
    tan_phi1 = math.tan(phi1)

    N1 = a / math.sqrt(1 - e2 * sin_phi1**2)
    T1 = tan_phi1**2
    C1 = (e2 / (1 - e2)) * cos_phi1**2
    R1 = a * (1 - e2) / (1 - e2 * sin_phi1**2)**1.5
    D = x / (N1 * k0)

    lat = phi1 - (N1 * tan_phi1 / R1) * (
        D**2/2
        - (5 + 3*T1 + 10*C1 - 4*C1**2 - 9*(e2/(1-e2))) * D**4/24
        + (61 + 90*T1 + 298*C1 + 45*T1**2 - 252*(e2/(1-e2)) - 3*C1**2) * D**6/720
    )

    lon = lon0 + (1/cos_phi1) * (
        D
        - (1 + 2*T1 + C1) * D**3/6
        + (5 - 2*C1 + 28*T1 - 3*C1**2 + 8*(e2/(1-e2)) + 24*T1**2) * D**5/120
    )

    return (round(math.degrees(lon), 5), round(math.degrees(lat), 5))


# --------------- WKT parsing ---------------

def parse_wkt_multipolygon(wkt: str) -> list[list[tuple[float, float]]]:
    """Parse WKT MULTIPOLYGON and return list of exterior rings as coordinate lists.

    Extracts only the first exterior ring of the first polygon — sufficient
    for mini-map display.

    Args:
        wkt: WKT MULTIPOLYGON string from MARS API

    Returns:
        List of coordinate rings, each as [(easting, northing), ...]
    """
    rings = []
    pattern = r'\(\(([^)]+)\)'
    matches = re.findall(pattern, wkt)

    for match in matches:
        coords = []
        pairs = match.split(',')
        for pair in pairs:
            parts = pair.strip().split()
            if len(parts) >= 2:
                try:
                    coords.append((float(parts[0]), float(parts[1])))
                except ValueError:
                    continue
        if coords:
            rings.append(coords)
        break

    return rings


# --------------- Simplification ---------------

def polygon_area_m2(coords: list[tuple[float, float]]) -> float:
    """Compute polygon area in m² using the shoelace formula on UTM coordinates.

    Args:
        coords: Ring of (easting, northing) tuples in UTM meters

    Returns:
        Absolute area in square meters

    Example:
        >>> polygon_area_m2([(0,0), (100,0), (100,100), (0,100), (0,0)])
        10000.0
    """
    n = len(coords)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += coords[i][0] * coords[j][1]
        area -= coords[j][0] * coords[i][1]
    return abs(area) / 2.0


def adaptive_tolerance(area_m2: float) -> float:
    """Compute Douglas-Peucker tolerance in meters based on polygon area.

    Smaller polygons get gentler simplification to preserve their shape,
    while large polygons can tolerate more aggressive simplification.

    Thresholds:
      - < 5 ha (50,000 m²):   5m tolerance  (small parcels — preserve shape)
      - 5–50 ha:              10m tolerance  (medium plots)
      - 50–500 ha:            20m tolerance  (large projects)
      - > 500 ha:             35m tolerance  (very large areas)

    Args:
        area_m2: Polygon area in square meters

    Returns:
        Simplification tolerance in meters

    Example:
        >>> adaptive_tolerance(20_000)   # 2 ha → 5m
        5.0
        >>> adaptive_tolerance(200_000)  # 20 ha → 10m
        10.0
        >>> adaptive_tolerance(2_000_000) # 200 ha → 20m
        20.0
    """
    THRESHOLD_5HA = 50_000
    THRESHOLD_50HA = 500_000
    THRESHOLD_500HA = 5_000_000

    if area_m2 < THRESHOLD_5HA:
        return 5.0
    elif area_m2 < THRESHOLD_50HA:
        return 10.0
    elif area_m2 < THRESHOLD_500HA:
        return 20.0
    else:
        return 35.0


def simplify_ring(coords: list[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
    """Douglas-Peucker simplification on UTM coordinates (before reprojection).

    Args:
        coords: Ring of (easting, northing) tuples
        tolerance: Maximum perpendicular distance in meters for point removal

    Returns:
        Simplified ring as list of (easting, northing) tuples
    """
    if len(coords) <= 4:
        return coords

    def perpendicular_distance(point, line_start, line_end):
        dx = line_end[0] - line_start[0]
        dy = line_end[1] - line_start[1]
        if dx == 0 and dy == 0:
            return math.sqrt((point[0] - line_start[0])**2 + (point[1] - line_start[1])**2)
        t = max(0, min(1, ((point[0] - line_start[0]) * dx + (point[1] - line_start[1]) * dy) / (dx*dx + dy*dy)))
        proj_x = line_start[0] + t * dx
        proj_y = line_start[1] + t * dy
        return math.sqrt((point[0] - proj_x)**2 + (point[1] - proj_y)**2)

    def dp(points, start, end, tol):
        max_dist = 0
        max_idx = start
        for i in range(start + 1, end):
            d = perpendicular_distance(points[i], points[start], points[end])
            if d > max_dist:
                max_dist = d
                max_idx = i

        if max_dist > tol:
            left = dp(points, start, max_idx, tol)
            right = dp(points, max_idx, end, tol)
            return left[:-1] + right
        else:
            return [points[start], points[end]]

    result = dp(coords, 0, len(coords) - 1, tolerance)
    if result[0] != result[-1]:
        result.append(result[0])
    return result


# --------------- Geometry processing ---------------

def fetch_geometry(geo_id: str) -> str | None:
    """Fetch WKT geometry for a geoLocationId from MARS API.

    Args:
        geo_id: MARS geoLocationId

    Returns:
        WKT string or None on failure
    """
    url = f"{MARS_BASE}/geometries/{geo_id}"
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})

    try:
        with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            data = json.loads(response.read())
            return data.get("geometryWkt")
    except (HTTPError, URLError, json.JSONDecodeError):
        return None


def process_geometry(wkt: str) -> list[list[float]] | None:
    """Parse WKT, simplify with adaptive tolerance, reproject to WGS84.

    The tolerance is chosen based on polygon area: small parcels (< 5 ha)
    get 5m tolerance to preserve shape, while large areas (> 500 ha) get
    35m tolerance for file size efficiency.

    Args:
        wkt: WKT MULTIPOLYGON string

    Returns:
        Coordinate ring as [[lng, lat], ...] or None on failure
    """
    rings = parse_wkt_multipolygon(wkt)
    if not rings:
        return None

    utm_ring = rings[0]

    area = polygon_area_m2(utm_ring)
    tol = adaptive_tolerance(area)
    simplified = simplify_ring(utm_ring, tolerance=tol)

    wgs84_ring = []
    for easting, northing in simplified:
        try:
            lng, lat = utm32n_to_wgs84(easting, northing)
            wgs84_ring.append([lng, lat])
        except (ValueError, ZeroDivisionError):
            continue

    if len(wgs84_ring) < 3:
        return None

    return wgs84_ring


# --------------- Main ---------------

def main():
    parser = argparse.ArgumentParser(description="Fetch project geometries from MARS API")
    parser.add_argument("--force", action="store_true", help="Re-fetch all geometries from MARS, ignoring WKT cache")
    parser.add_argument("--reprocess", action="store_true",
                        help="Re-simplify from cached WKT without re-fetching from MARS")
    args = parser.parse_args()

    t0 = time.monotonic()
    print("Geometry ETL — Fetching project polygons from MARS API")

    # Load plans to get all geoLocationIds
    plans_path = DATA_DIR / "plans.json"
    if not plans_path.exists():
        print("✗ No plans.json found. Run fetch_mars.py first.")
        sys.exit(1)

    with open(plans_path) as f:
        plans = json.load(f)

    geo_ids = set()
    project_geo_map = {}

    for plan in plans:
        for proj in plan.get("projects", []):
            gid = proj.get("geoLocationId")
            pid = proj.get("projectId")
            if gid and pid:
                geo_ids.add(gid)
                project_geo_map[pid] = gid

        for sketch in plan.get("sketchProjects", []):
            gid = sketch.get("geoLocationId")
            sid = sketch.get("sketchProjectId")
            if gid and sid:
                geo_ids.add(gid)
                project_geo_map[sid] = gid

    print(f"  Found {len(geo_ids)} unique geoLocationIds across {len(project_geo_map)} projects/sketches")

    # Load WKT cache
    wkt_cache: dict[str, str] = {}
    if WKT_CACHE_PATH.exists():
        try:
            with open(WKT_CACHE_PATH) as f:
                wkt_cache = json.load(f)
            print(f"  Loaded {len(wkt_cache)} cached WKT geometries")
        except (json.JSONDecodeError, IOError):
            pass

    if args.reprocess:
        print("  --reprocess: re-simplifying from cached WKT (no API calls)")
        if not wkt_cache:
            print("  ✗ No WKT cache found. Run without --reprocess first to fetch from MARS.")
            sys.exit(1)
    else:
        # Fetch missing WKT from MARS API
        to_fetch = geo_ids - set(wkt_cache.keys()) if not args.force else geo_ids
        if args.force:
            wkt_cache = {}
            print(f"  --force: re-fetching all {len(to_fetch)} geometries from MARS")
        else:
            print(f"  Need to fetch {len(to_fetch)} new geometries from MARS")

        fetched = 0
        errors = 0
        SAVE_INTERVAL = 50

        def save_wkt_cache():
            WKT_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
            tmp = WKT_CACHE_PATH.with_suffix('.tmp')
            with open(tmp, "w") as f:
                json.dump(wkt_cache, f, separators=(",", ":"))
            tmp.replace(WKT_CACHE_PATH)

        for i, geo_id in enumerate(sorted(to_fetch)):
            if i > 0 and i % 100 == 0:
                print(f"  ... {i}/{len(to_fetch)} fetched ({errors} errors)")

            wkt = fetch_geometry(geo_id)
            if wkt:
                wkt_cache[geo_id] = wkt
                fetched += 1
            else:
                errors += 1

            if fetched > 0 and fetched % SAVE_INTERVAL == 0:
                save_wkt_cache()
                print(f"    💾 WKT checkpoint saved ({len(wkt_cache)} geometries)")

            time.sleep(REQUEST_DELAY)

        save_wkt_cache()
        wkt_size_kb = WKT_CACHE_PATH.stat().st_size / 1024
        print(f"  ✓ WKT cache: {len(wkt_cache)} geometries ({wkt_size_kb:.0f} KB)")
        print(f"    Fetched {fetched} new, {errors} errors")

    # Process all cached WKT → simplified GeoJSON
    print("  Processing geometries (adaptive simplification + reprojection)...")
    results: dict[str, list[list[float]]] = {}
    tolerance_stats: dict[float, int] = {}

    for geo_id in sorted(geo_ids):
        wkt = wkt_cache.get(geo_id)
        if not wkt:
            continue
        ring = process_geometry(wkt)
        if ring:
            results[geo_id] = ring

            # Track which tolerance was used (for stats)
            rings = parse_wkt_multipolygon(wkt)
            if rings:
                area = polygon_area_m2(rings[0])
                tol = adaptive_tolerance(area)
                tolerance_stats[tol] = tolerance_stats.get(tol, 0) + 1

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUTPUT_PATH.with_suffix('.tmp')
    with open(tmp, "w") as f:
        json.dump(results, f, separators=(",", ":"))
    tmp.replace(OUTPUT_PATH)

    size_kb = OUTPUT_PATH.stat().st_size / 1024
    elapsed = time.monotonic() - t0

    # Summary stats
    point_counts = [len(v) for v in results.values()]
    avg_points = sum(point_counts) / len(point_counts) if point_counts else 0

    print(f"\n  ✓ Wrote {len(results)} geometries to {OUTPUT_PATH.name} ({size_kb:.0f} KB)")
    print(f"  Avg points/polygon: {avg_points:.1f}")
    print(f"  Adaptive tolerance distribution:")
    for tol in sorted(tolerance_stats):
        count = tolerance_stats[tol]
        print(f"    {tol:>5.0f}m: {count:>5} polygons ({100*count/len(results):.0f}%)")
    print(f"  Duration: {elapsed:.1f}s")


if __name__ == "__main__":
    main()
