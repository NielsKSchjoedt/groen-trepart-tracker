#!/usr/bin/env python3
"""
ETL: Fetch water monitoring station data from VanDa API (Danmarks Miljøportal)

Fetches surface water monitoring stations with their locations, owners,
and measurement point metadata. These stations track water quality and
flow — key indicators for the nitrogen reduction and watercourse
restoration targets in the Green Tripartite agreement.

Endpoints (public, no auth required for station metadata):
  /api/stations → 2,748 monitoring stations with EPSG:25832 coordinates

Note: Measurement data endpoints (/api/water-levels, /api/measurements)
require OAuth2 registration and specific query parameters. This fetcher
covers the publicly accessible station metadata only.
"""

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

from etl_log import log_etl_run

# Configuration
VANDA_BASE = "https://vandah.miljoeportal.dk/api"
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_DIR = REPO_ROOT / "data" / "vanda"

USER_AGENT = "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; open-source environmental monitor)"
TIMEOUT_SECONDS = 120  # Station list is ~4MB, can be slow


def fetch_url(url: str, description: str) -> bytes | None:
    """Fetch a URL and return raw bytes."""
    print(f"  Fetching {description}: {url}")
    req = Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    })
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


def stations_to_geojson(stations: list) -> dict:
    """Convert VanDa station list to GeoJSON FeatureCollection.

    Station locations use EPSG:25832 (ETRS89 / UTM zone 32N).
    """
    features = []
    for s in stations:
        loc = s.get("location", {})
        x = loc.get("x")
        y = loc.get("y")
        if x is None or y is None:
            continue

        # Extract key properties
        props = {
            "stationUid": s.get("stationUid"),
            "stationId": s.get("stationId"),
            "name": s.get("name"),
            "locationType": s.get("locationType"),
            "stationOwnerName": s.get("stationOwnerName"),
            "operatorName": s.get("operatorName"),
            "description": s.get("description"),
            "measurementPointCount": len(s.get("measurementPoints", [])),
        }

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [x, y],
            },
            "properties": props,
        })

    return {
        "type": "FeatureCollection",
        "crs": {
            "type": "name",
            "properties": {"name": "EPSG:25832"},
        },
        "features": features,
    }


def compute_summary(stations: list) -> dict:
    """Compute summary statistics from station data."""
    station_types = {}
    with_location = 0
    total_measurement_points = 0

    for s in stations:
        st = s.get("locationType", "unknown")
        station_types[st] = station_types.get(st, 0) + 1

        loc = s.get("location", {})
        if loc.get("x") is not None and loc.get("y") is not None:
            with_location += 1

        total_measurement_points += len(s.get("measurementPoints", []))

    return {
        "total_stations": len(stations),
        "with_location": with_location,
        "total_measurement_points": total_measurement_points,
        "by_station_type": dict(sorted(station_types.items())),
    }


def main():
    print(f"VanDa ETL — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Output: {DATA_DIR}")
    print()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    errors = []

    # Fetch all stations
    raw = fetch_url(f"{VANDA_BASE}/stations", "monitoring stations")
    if not raw:
        print("\n✗ Failed to fetch stations. Aborting.")
        sys.exit(1)

    try:
        stations = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"\n✗ Invalid JSON: {e}")
        sys.exit(1)

    # Write raw station data
    raw_path = DATA_DIR / "stations.json"
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(stations, f, ensure_ascii=False, indent=2)
    print(f"  stations.json: {raw_path.stat().st_size:,} bytes ({len(stations)} stations)")

    # Convert to GeoJSON
    geojson = stations_to_geojson(stations)
    geo_path = DATA_DIR / "stations.geojson"
    with open(geo_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    feature_count = len(geojson["features"])
    print(f"  stations.geojson: {geo_path.stat().st_size:,} bytes ({feature_count} features)")

    # Compute and write summary
    stats = compute_summary(stations)
    summary = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "api_base": VANDA_BASE,
        "coordinate_system": "EPSG:25832",
        **stats,
        "errors": errors,
    }
    summary_path = DATA_DIR / "summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # Headline
    print(f"\n{'=' * 60}")
    print("HEADLINE")
    print("=" * 60)
    print(f"  Stations: {stats['total_stations']} total, {stats['with_location']} with coordinates")
    print(f"  Measurement points: {stats['total_measurement_points']}")
    print(f"  Location types: {', '.join(f'{k}: {v}' for k, v in stats['by_station_type'].items())}")
    if errors:
        print(f"\n  ⚠ Errors: {', '.join(errors)}")
    print()

    log_etl_run(
        source="vanda",
        endpoints=[f"{VANDA_BASE}/stations"],
        records={"stations": stats.get("total_stations", 0)},
        status="ok" if not errors else "partial",
        notes=f"{stats.get('total_stations', 0)} stations, {stats.get('with_location', 0)} with coordinates",
    )

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
