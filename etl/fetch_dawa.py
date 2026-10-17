#!/usr/bin/env python3
"""
ETL: Kommune boundaries and metadata (static — DAWA is shut down).

Dataforsyningen shut down DAWA in 2026: every api.dataforsyningen.dk DAWA endpoint
(/kommuner, /kommuner/reverse, /regioner) now answers HTTP 410 Gone. From October
2026 that failure stopped the whole daily data job.

Kommune boundaries change very rarely, so they are now a committed, static input:

  data/dawa/kommuner.json          — metadata (kode, navn, region), tracked in git
  data/dawa/regioner.json          — region metadata, tracked in git
  data/dawa/kommuner.geojson.xz    — full EPSG:25832 boundaries (last DAWA fetch,
                                     2026-09-11), xz-compressed and tracked in git
  data/dawa/kommuner.geojson       — decompressed working copy (gitignored, ~110 MB)

This script no longer calls the network. It restores the working copy from the
archive when missing and validates both files. To refresh boundaries after a real
kommune change, replace the archive from DAGI (Datafordeleren / Dataforsyningen).
"""

import json
import lzma
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from etl_log import log_etl_run

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_DIR = REPO_ROOT / "data" / "dawa"

META_PATH = DATA_DIR / "kommuner.json"
REGION_PATH = DATA_DIR / "regioner.json"
GEO_PATH = DATA_DIR / "kommuner.geojson"
GEO_ARCHIVE = DATA_DIR / "kommuner.geojson.xz"

EXPECTED_KOMMUNER = 99  # 98 kommuner + Christiansø (0411), as DAWA returned them


def restore_geojson() -> bool:
    """Decompress the committed archive into the working copy. Returns True on success."""
    if GEO_PATH.exists():
        return True
    if not GEO_ARCHIVE.exists():
        print(f"  ✗ Neither {GEO_PATH.name} nor {GEO_ARCHIVE.name} exists")
        return False
    t0 = time.monotonic()
    with lzma.open(GEO_ARCHIVE, "rb") as src, open(GEO_PATH, "wb") as dst:
        while chunk := src.read(1 << 20):
            dst.write(chunk)
    print(f"  Restored {GEO_PATH.name} from {GEO_ARCHIVE.name} ({time.monotonic() - t0:.1f}s)")
    return True


def main() -> int:
    t0 = time.monotonic()
    print(f"Kommune boundaries (static) — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("  DAWA is shut down (HTTP 410); using committed boundaries — no network call.")

    municipalities = json.loads(META_PATH.read_text(encoding="utf-8")) if META_PATH.exists() else []
    geo_ok = restore_geojson()
    feature_count = 0
    if geo_ok:
        with open(GEO_PATH, encoding="utf-8") as f:
            feature_count = len(json.load(f).get("features", []))

    ok = len(municipalities) == EXPECTED_KOMMUNER and feature_count == EXPECTED_KOMMUNER
    print(f"  kommuner.json: {len(municipalities)} kommuner | kommuner.geojson: {feature_count} features")
    if not ok:
        print(f"  ✗ Expected {EXPECTED_KOMMUNER} of each — boundary inputs are incomplete")

    summary = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "static (DAWA shut down 2026; last live fetch 2026-09-11)",
        "municipalities": len(municipalities),
        "geojson_features": feature_count,
        "coordinate_system": "EPSG:25832",
    }
    (DATA_DIR / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    log_etl_run(
        source="dawa",
        endpoints=[],
        records={"municipalities": len(municipalities), "geojson_features": feature_count},
        status="ok" if ok else "error",
        notes="Static boundaries (DAWA shut down — HTTP 410)",
        duration_seconds=time.monotonic() - t0,
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
