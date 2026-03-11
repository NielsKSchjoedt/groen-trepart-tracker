#!/usr/bin/env python3
"""
ETL: Fetch environment statistics from Danmarks Statistik (Statistikbanken)

Uses the POST-based REST API at api.statbank.dk/v1 to fetch key tables
tracking land use, forest area, environmental fund grants, and agricultural
subsidies relevant to the Green Tripartite agreement targets.

Key tables:
  ARE207   → Land area by type (agriculture, forest, wetland, etc.)
  SKOV1    → Forest area by ownership and region
  FOND19   → Environment fund grants (Den Grønne Fond etc.)
  TILSKUD2 → Agricultural subsidies by scheme

The API is public, requires no authentication, and uses POST requests
with JSON body for data retrieval.
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
DST_BASE = "https://api.statbank.dk/v1"
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_DIR = REPO_ROOT / "data" / "dst"

USER_AGENT = "TrepartTracker/0.1 (https://github.com/trepart-tracker; open-source environmental monitor)"
TIMEOUT_SECONDS = 60

# Tables to fetch — variable codes discovered via /tableinfo endpoint
# Each table's variables must match EXACTLY what the API expects.
TABLES = {
    "ARE207": {
        "description": "Areal 1. januar — land area by region over time",
        "variables": [
            {"code": "OMRÅDE", "values": ["*"]},  # 105 regions
            {"code": "Tid", "values": ["*"]},     # 20 years
        ],
    },
    "SKOV1": {
        "description": "Skovarealet — forest area by region and tree type",
        "variables": [
            {"code": "OMRÅDE", "values": ["*"]},     # 293 regions
            {"code": "BEVOKSNING", "values": ["*"]},  # 17 tree types
            {"code": "Tid", "values": ["*"]},         # 2 years
        ],
    },
    "FOND19": {
        "description": "Bevilligede fondsmidler til natur-, klima- og miljøformål",
        "variables": [
            {"code": "FONDSTYPE", "values": ["*"]},  # 3 fund types
            {"code": "HOMR", "values": ["*"]},        # 7 main areas
            {"code": "Tid", "values": ["*"]},         # 3 years
        ],
    },
    "TILSKUD2": {
        "description": "Direkte tilskud til landbrugssektoren",
        "variables": [
            {"code": "TILSKUDSART", "values": ["*"]},  # 23 subsidy types
            {"code": "Tid", "values": ["*"]},           # 4 years
        ],
    },
}


def fetch_table_metadata(table_id: str) -> dict | None:
    """Fetch table metadata including variable definitions."""
    url = f"{DST_BASE}/tableinfo"
    body = json.dumps({"table": table_id, "format": "JSON"}).encode("utf-8")
    print(f"  Fetching metadata for {table_id}...")

    req = Request(url, data=body, headers={
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
        "Accept": "application/json",
    })
    try:
        with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read()
            data = json.loads(raw)
            print(f"    ✓ {response.status} OK — {len(raw):,} bytes")
            return data
    except (HTTPError, URLError, json.JSONDecodeError) as e:
        print(f"    ✗ Error: {e}")
        return None


def fetch_table_data(table_id: str, variables: list[dict]) -> tuple[str | None, int]:
    """Fetch actual data rows from a table as CSV.

    Returns (csv_text, row_count) or (None, 0) on failure.
    """
    url = f"{DST_BASE}/data"
    body = json.dumps({
        "table": table_id,
        "format": "CSV",
        "variables": variables,
    }).encode("utf-8")
    print(f"  Fetching data for {table_id}...")

    req = Request(url, data=body, headers={
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
    })
    try:
        with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            raw = response.read()
            text = raw.decode("utf-8")
            # Count rows (minus header)
            lines = [l for l in text.strip().split("\n") if l.strip()]
            row_count = max(0, len(lines) - 1)
            print(f"    ✓ {response.status} OK — {len(raw):,} bytes ({row_count} rows)")
            return text, row_count
    except HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else ""
        print(f"    ✗ HTTP {e.code}: {e.reason}")
        if error_body:
            print(f"    ✗ Detail: {error_body[:300]}")
        return None, 0
    except URLError as e:
        print(f"    ✗ Error: {e}")
        return None, 0


def main():
    print(f"Danmarks Statistik ETL — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Output: {DATA_DIR}")
    print()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    summary = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "api_base": DST_BASE,
        "tables": {},
    }
    errors = []

    for table_id, config in TABLES.items():
        print(f"\n{'=' * 60}")
        print(f"{table_id}: {config['description']}")
        print("=" * 60)

        # Fetch metadata
        metadata = fetch_table_metadata(table_id)
        if metadata:
            meta_path = DATA_DIR / f"{table_id.lower()}_meta.json"
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            print(f"    Wrote {meta_path.name}: {meta_path.stat().st_size:,} bytes")

        # Fetch data as CSV
        csv_text, row_count = fetch_table_data(table_id, config["variables"])
        if csv_text:
            data_path = DATA_DIR / f"{table_id.lower()}.csv"
            with open(data_path, "w", encoding="utf-8") as f:
                f.write(csv_text)
            size = data_path.stat().st_size
            print(f"    Wrote {data_path.name}: {size:,} bytes ({row_count} rows)")

            summary["tables"][table_id] = {
                "description": config["description"],
                "row_count": row_count,
                "file_size_bytes": size,
                "has_metadata": metadata is not None,
            }
        else:
            errors.append(table_id)
            summary["tables"][table_id] = {
                "description": config["description"],
                "error": True,
            }

    # Write summary
    summary["errors"] = errors
    summary_path = DATA_DIR / "summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # Headline
    print(f"\n{'=' * 60}")
    print("HEADLINE")
    print("=" * 60)
    for table_id, info in summary["tables"].items():
        if "error" in info:
            print(f"  {table_id}: ✗ FAILED")
        else:
            print(f"  {table_id}: {info['row_count']} rows — {info['description']}")
    if errors:
        print(f"\n  ⚠ Failed tables: {', '.join(errors)}")
    print()

    record_counts = {tid: info.get("row_count", 0) for tid, info in summary["tables"].items() if "error" not in info}
    log_etl_run(
        source="dst",
        endpoints=[f"{DST_BASE}/data"],
        records=record_counts,
        status="ok" if not errors else ("partial" if record_counts else "error"),
        notes=f"Tables: {', '.join(record_counts.keys())}" + (f"; errors: {', '.join(errors)}" if errors else ""),
    )

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
