#!/usr/bin/env python3
"""
ETL: Fetch project geometries from MARS API and convert to GeoJSON.

Reads geoLocationIds from the plans data (projects + sketches),
fetches WKT geometry from /api/geometries/{id}, converts from
ETRS89/UTM32N (EPSG:25832) to WGS84 (EPSG:4326), simplifies
to reduce file size, and outputs a single JSON lookup file.

Output: public/data/project-geometries.json
Format: { "<geoLocationId>": [[lng,lat], [lng,lat], ...], ... }
  - Stores only the exterior ring of the first polygon (sufficient for mini-maps)
  - Coordinates simplified to 4 decimal places (~11m precision)
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
OUTPUT_PATH = REPO_ROOT / "public" / "data" / "project-geometries.json"

MARS_BASE = "https://mars.sgav.dk/api"
USER_AGENT = "TrepartTracker/0.1 (https://github.com/trepart-tracker; open-source environmental monitor)"
TIMEOUT_SECONDS = 15

# Rate limiting: be polite to the MARS API
REQUEST_DELAY = 0.05  # 50ms between requests


# --------------- UTM32N → WGS84 conversion ---------------
# Pure-Python implementation (no pyproj dependency needed)

def utm32n_to_wgs84(easting: float, northing: float) -> tuple[float, float]:
    """Convert ETRS89/UTM zone 32N (EPSG:25832) to WGS84 (EPSG:4326).

    Returns (longitude, latitude) in degrees.
    Uses the Karney-style reverse UTM formulae.
    """
    # GRS80 ellipsoid parameters (used by ETRS89)
    a = 6378137.0
    f = 1 / 298.257222101
    e2 = 2 * f - f * f
    e = math.sqrt(e2)

    # UTM parameters
    k0 = 0.9996
    lon0 = math.radians(9.0)  # Central meridian for zone 32

    x = easting - 500000.0  # Remove false easting
    y = northing  # No false northing in northern hemisphere

    # Footprint latitude
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
    """Parse WKT MULTIPOLYGON and return list of exterior rings as coordinate lists."""
    # Extract coordinate groups
    # MULTIPOLYGON(((x y, x y, ...)), ((x y, x y, ...)))
    # We want just the first ring of each polygon (exterior)
    rings = []

    # Find all polygon groups
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
        # Only take the first ring (exterior) of first polygon for mini-map
        break

    return rings


def simplify_ring(coords: list[tuple[float, float]], tolerance: float = 50.0) -> list[tuple[float, float]]:
    """Douglas-Peucker simplification on UTM coordinates (before reprojection).

    tolerance is in meters (UTM units).
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
    # Ensure ring is closed
    if result[0] != result[-1]:
        result.append(result[0])
    return result


def fetch_geometry(geo_id: str) -> str | None:
    """Fetch WKT geometry for a geoLocationId from MARS API."""
    url = f"{MARS_BASE}/geometries/{geo_id}"
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})

    try:
        with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            data = json.loads(response.read())
            return data.get("geometryWkt")
    except (HTTPError, URLError, json.JSONDecodeError):
        return None


def process_geometry(wkt: str) -> list[list[float]] | None:
    """Parse WKT, simplify, reproject to WGS84, and return coordinate ring."""
    rings = parse_wkt_multipolygon(wkt)
    if not rings:
        return None

    # Take first exterior ring
    utm_ring = rings[0]

    # Simplify in UTM space (50m tolerance — good for mini-maps)
    simplified = simplify_ring(utm_ring, tolerance=50.0)

    # Reproject to WGS84
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


def main():
    parser = argparse.ArgumentParser(description="Fetch project geometries from MARS API")
    parser.add_argument("--force", action="store_true", help="Re-fetch all geometries, ignoring cache")
    args = parser.parse_args()

    t0 = time.monotonic()
    print(f"Geometry ETL — Fetching project polygons from MARS API")

    # Load plans to get all geoLocationIds
    plans_path = DATA_DIR / "plans.json"
    if not plans_path.exists():
        print("✗ No plans.json found. Run fetch_mars.py first.")
        sys.exit(1)

    with open(plans_path) as f:
        plans = json.load(f)

    # Collect all unique geoLocationIds from projects and sketches
    geo_ids = set()
    project_geo_map = {}  # projectId/sketchId -> geoLocationId

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

    # Check if we already have a cached version
    existing = {}
    if not args.force and OUTPUT_PATH.exists():
        try:
            with open(OUTPUT_PATH) as f:
                existing = json.load(f)
            print(f"  Loaded {len(existing)} cached geometries")
        except (json.JSONDecodeError, IOError):
            pass
    elif args.force:
        print("  --force: ignoring cached geometries")

    # Fetch missing geometries
    to_fetch = geo_ids - set(existing.keys())
    print(f"  Need to fetch {len(to_fetch)} new geometries")

    results = dict(existing)
    fetched = 0
    errors = 0

    # Incremental save interval — persist progress every N geometries
    # so a crash after 29 minutes doesn't lose everything
    SAVE_INTERVAL = 25
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    def save_progress():
        """Write current results to disk (atomic via temp file)."""
        tmp = OUTPUT_PATH.with_suffix('.tmp')
        with open(tmp, "w") as f:
            json.dump(results, f, separators=(",", ":"))
        tmp.replace(OUTPUT_PATH)

    for i, geo_id in enumerate(sorted(to_fetch)):
        if i > 0 and i % 100 == 0:
            print(f"  ... {i}/{len(to_fetch)} fetched ({errors} errors)")

        wkt = fetch_geometry(geo_id)
        if wkt:
            ring = process_geometry(wkt)
            if ring:
                results[geo_id] = ring
                fetched += 1
            else:
                errors += 1
        else:
            errors += 1

        # Save progress incrementally — every SAVE_INTERVAL successful fetches
        if fetched > 0 and fetched % SAVE_INTERVAL == 0:
            save_progress()
            print(f"    💾 Checkpoint saved ({len(results)} geometries)")

        time.sleep(REQUEST_DELAY)

    # Final write
    save_progress()

    size_kb = OUTPUT_PATH.stat().st_size / 1024
    elapsed = time.monotonic() - t0

    print(f"\n  ✓ Wrote {len(results)} geometries to {OUTPUT_PATH.name} ({size_kb:.0f} KB)")
    print(f"  Fetched {fetched} new, {errors} errors, {len(existing)} cached")
    print(f"  Duration: {elapsed:.1f}s")


if __name__ == "__main__":
    main()
# Note: --force flag support added below

