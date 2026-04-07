#!/usr/bin/env python3
"""
ETL: Fetch municipality data from DAWA API (dataforsyningen.dk)

Fetches all 98 Danish municipalities with their boundaries as GeoJSON.
This is mostly a one-time fetch — municipality boundaries rarely change.

Endpoints:
  /kommuner              → Municipality metadata (codes, names, regions)
  /kommuner?format=geojson → Full boundaries as GeoJSON FeatureCollection
"""

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

from etl_log import log_etl_run

DAWA_BASE = "https://api.dataforsyningen.dk"
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_DIR = REPO_ROOT / "data" / "dawa"

USER_AGENT = "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; open-source environmental monitor)"
TIMEOUT_SECONDS = 60  # GeoJSON response can be large


def fetch_url(url: str, description: str) -> bytes | None:
    """Fetch a URL and return raw bytes."""
    print(f"  Fetching {description}: {url}")
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read()
            print(f"    ✓ {response.status} OK — {len(raw):,} bytes")
            return raw
    except (HTTPError, URLError) as e:
        print(f"    ✗ Error: {e}")
        return None


STALENESS_DAYS = 30


def _files_are_fresh() -> bool:
    """
    Check whether all three DAWA output files exist and are less than
    STALENESS_DAYS old. Municipality boundaries almost never change,
    so 30 days is a safe refresh interval.

    @returns True if all files exist and are fresh enough to skip re-fetching
    """
    expected = [DATA_DIR / "kommuner.json", DATA_DIR / "kommuner.geojson", DATA_DIR / "regioner.json"]
    for p in expected:
        if not p.exists():
            return False
        age_days = (time.time() - p.stat().st_mtime) / 86_400
        if age_days >= STALENESS_DAYS:
            return False
    return True


def main():
    t0 = time.monotonic()
    print(f"DAWA ETL — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Output: {DATA_DIR}")
    print()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    force = sys.argv[1:] == ["--force"]

    if _files_are_fresh() and not force:
        ages = {}
        for p in [DATA_DIR / "kommuner.json", DATA_DIR / "kommuner.geojson", DATA_DIR / "regioner.json"]:
            ages[p.name] = f"{(time.time() - p.stat().st_mtime) / 86_400:.1f}d"
        print(f"  All files fresh (< {STALENESS_DAYS}d): {ages}")
        print(f"  Skipping DAWA fetch ({time.monotonic() - t0:.1f}s). Use --force to re-fetch.")

        meta_path = DATA_DIR / "kommuner.json"
        with open(meta_path) as f:
            municipalities = json.load(f)

        log_etl_run(
            source="dawa",
            endpoints=[],
            records={"municipalities": len(municipalities)},
            status="ok",
            notes=f"Skipped — files fresh (< {STALENESS_DAYS} days old)",
            duration_seconds=time.monotonic() - t0,
        )
        return 0

    # 1. Fetch municipality metadata (lightweight JSON)
    raw_meta = fetch_url(f"{DAWA_BASE}/kommuner", "municipality metadata")
    if raw_meta:
        municipalities = json.loads(raw_meta)
        meta_path = DATA_DIR / "kommuner.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(municipalities, f, ensure_ascii=False, indent=2)
        print(f"  kommuner.json: {meta_path.stat().st_size:,} bytes ({len(municipalities)} municipalities)")
    else:
        print("  ✗ Failed to fetch municipality metadata")
        municipalities = []

    # 2. Fetch full GeoJSON boundaries
    raw_geo = fetch_url(f"{DAWA_BASE}/kommuner?format=geojson&srid=25832", "municipality GeoJSON (EPSG:25832)")
    if raw_geo:
        geo_path = DATA_DIR / "kommuner.geojson"
        with open(geo_path, "wb") as f:
            f.write(raw_geo)
        geojson = json.loads(raw_geo)
        feature_count = len(geojson.get("features", []))
        print(f"  kommuner.geojson: {geo_path.stat().st_size:,} bytes ({feature_count} features)")
    else:
        print("  ✗ Failed to fetch GeoJSON boundaries")
        feature_count = 0

    # 3. Fetch region data
    raw_regions = fetch_url(f"{DAWA_BASE}/regioner", "region metadata")
    if raw_regions:
        regions = json.loads(raw_regions)
        region_path = DATA_DIR / "regioner.json"
        with open(region_path, "w", encoding="utf-8") as f:
            json.dump(regions, f, ensure_ascii=False, indent=2)
        print(f"  regioner.json: {region_path.stat().st_size:,} bytes ({len(regions)} regions)")

    summary = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "municipalities": len(municipalities),
        "geojson_features": feature_count,
        "coordinate_system": "EPSG:25832",
    }
    summary_path = DATA_DIR / "summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 60}")
    print(f"  {len(municipalities)} municipalities fetched")
    print(f"  {feature_count} GeoJSON features with EPSG:25832 boundaries")
    print()

    log_etl_run(
        source="dawa",
        endpoints=[f"{DAWA_BASE}/kommuner", f"{DAWA_BASE}/kommuner?format=geojson"],
        records={"municipalities": len(municipalities), "geojson_features": feature_count},
        status="ok" if municipalities and feature_count > 0 else "error",
        notes=f"{len(municipalities)} municipalities, {feature_count} features",
        duration_seconds=time.monotonic() - t0,
    )

    return 0 if municipalities and feature_count > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
