#!/usr/bin/env python3
"""
ETL: Fetch data from MARS REST API (mars.sgav.dk)

Fetches all public status endpoints and stores raw JSON responses
in data/mars/ with timestamps. Designed to run on schedule via
GitHub Actions or manually.

Endpoints:
  /api/master-data       → Subsidy schemes, project states, national goals
  /api/status/plans      → 37 kystvandgrupper with N-reduction targets + nested projects
  /api/status/projects   → Individual projects (1,164+) with status and metrics
  /api/status/vos        → 23 vandopland (main catchments) aggregations
  /api/status/metadata   → National goals + plan definitions

All endpoints are public and require no authentication.
"""

import json
import sys
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

from etl_log import log_etl_run

# Configuration
MARS_BASE = "https://mars.sgav.dk/api"
ENDPOINTS = {
    "master-data": "/master-data",
    "plans": "/status/plans",
    "projects": "/status/projects",
    "vos": "/status/vos",
    "metadata": "/status/metadata",
}

# Output directory (relative to repo root)
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_DIR = REPO_ROOT / "data" / "mars"

# HTTP settings
USER_AGENT = "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; open-source environmental monitor)"
TIMEOUT_SECONDS = 30


def fetch_endpoint(name: str, path: str) -> dict | list | None:
    """Fetch a single MARS API endpoint and return parsed JSON."""
    url = f"{MARS_BASE}{path}"
    print(f"  Fetching {name}: {url}")

    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})

    try:
        with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            status = response.status
            content_type = response.headers.get("Content-Type", "")
            raw = response.read()
            data = json.loads(raw)
            print(f"    ✓ {status} OK — {len(raw):,} bytes")
            return data
    except HTTPError as e:
        print(f"    ✗ HTTP {e.code}: {e.reason}")
        return None
    except URLError as e:
        print(f"    ✗ Connection error: {e.reason}")
        return None
    except json.JSONDecodeError as e:
        print(f"    ✗ Invalid JSON: {e}")
        return None


def compute_summary(data: dict) -> dict:
    """Compute a human-readable summary from the fetched data."""
    summary = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "endpoints": {},
    }

    # Master data summary
    if "master-data" in data and data["master-data"]:
        md = data["master-data"]
        summary["endpoints"]["master-data"] = {
            "subsidy_schemes": len(md.get("subsidySchemes", [])),
            "project_states": len(md.get("projectStates", [])),
            "mitigation_measures": len(md.get("mitigationMeasures", [])),
            "national_goals": {
                "nitrogen_reduction_T": md.get("nitrogenReductionGoalT"),
                "extraction_effort_ha": md.get("extractionEffectGoalHa"),
                "afforestation_effort_ha": md.get("afforestationEffortGoalHa"),
            },
        }

    # Projects summary
    if "projects" in data and data["projects"]:
        projects = data["projects"]
        status_counts = {}
        total_n = 0.0
        total_ha = 0.0
        for p in projects:
            s = p.get("projectStatus", "unknown")
            status_counts[s] = status_counts.get(s, 0) + 1
            total_n += p.get("nitrogenReductionT", 0) or 0
            total_ha += p.get("extractionEffortHa", 0) or 0
        summary["endpoints"]["projects"] = {
            "total_count": len(projects),
            "by_status": dict(sorted(status_counts.items())),
            "total_nitrogen_reduction_T": round(total_n, 3),
            "total_extraction_effort_ha": round(total_ha, 3),
        }

    # Plans summary
    if "plans" in data and data["plans"]:
        plans = data["plans"]
        total_goal = sum(p.get("nitrogenReductionGoalT", 0) or 0 for p in plans)
        total_achieved = sum(p.get("totalNitrogenReductionT", 0) or 0 for p in plans)
        total_established = sum(p.get("countEstablishedProjects", 0) or 0 for p in plans)
        total_approved = sum(p.get("countApprovedProjects", 0) or 0 for p in plans)
        total_assessed = sum(p.get("countAssessedProjects", 0) or 0 for p in plans)
        total_sketch = sum(p.get("countSketchProjects", 0) or 0 for p in plans)
        progress_pct = round(total_achieved / total_goal * 100, 1) if total_goal > 0 else 0
        summary["endpoints"]["plans"] = {
            "total_plans": len(plans),
            "nitrogen_goal_T": round(total_goal, 3),
            "nitrogen_achieved_T": round(total_achieved, 3),
            "nitrogen_progress_pct": progress_pct,
            "established_projects": total_established,
            "approved_projects": total_approved,
            "assessed_projects": total_assessed,
            "sketch_projects": total_sketch,
        }

    # VOS summary
    if "vos" in data and data["vos"]:
        vos = data["vos"]
        summary["endpoints"]["vos"] = {
            "total_catchments": len(vos),
        }

    # Metadata summary
    if "metadata" in data and data["metadata"]:
        meta = data["metadata"]
        summary["endpoints"]["metadata"] = {
            "has_national_goals": "nationalGoals" in meta,
            "plan_count": len(meta.get("plans", [])),
        }

    return summary


def main():
    t0 = time.monotonic()
    print(f"MARS ETL — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Output: {DATA_DIR}")
    print()

    # Ensure output directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Fetch all endpoints
    fetched = {}
    errors = []
    for name, path in ENDPOINTS.items():
        result = fetch_endpoint(name, path)
        if result is not None:
            fetched[name] = result
        else:
            errors.append(name)

    if not fetched:
        print("\n✗ All endpoints failed. Aborting.")
        sys.exit(1)

    # Write raw JSON files
    print(f"\nWriting {len(fetched)} data files...")
    for name, data in fetched.items():
        filepath = DATA_DIR / f"{name}.json"
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        size = filepath.stat().st_size
        print(f"  {filepath.name}: {size:,} bytes")

    # Write summary
    summary = compute_summary(fetched)
    summary["errors"] = errors
    summary_path = DATA_DIR / "summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"  summary.json: {summary_path.stat().st_size:,} bytes")

    # Print headline numbers
    print("\n" + "=" * 60)
    print("HEADLINE NUMBERS")
    print("=" * 60)
    if "plans" in summary["endpoints"]:
        p = summary["endpoints"]["plans"]
        print(f"  Nitrogen reduction: {p['nitrogen_achieved_T']:,.1f} T of {p['nitrogen_goal_T']:,.1f} T ({p['nitrogen_progress_pct']}%)")
        print(f"  Projects: {p['established_projects']} completed, {p['approved_projects']} approved, {p['assessed_projects']} assessed, {p['sketch_projects']} sketch")
    if "projects" in summary["endpoints"]:
        print(f"  Individual projects tracked: {summary['endpoints']['projects']['total_count']}")
    if errors:
        print(f"\n  ⚠ Failed endpoints: {', '.join(errors)}")
    print()

    # Log the ETL run for transparency
    record_counts = {}
    for name, d in fetched.items():
        record_counts[name] = len(d) if isinstance(d, list) else 1
    log_etl_run(
        source="mars",
        endpoints=[f"{MARS_BASE}{path}" for path in ENDPOINTS.values()],
        records=record_counts,
        status="ok" if not errors else ("partial" if fetched else "error"),
        notes=f"Errors: {', '.join(errors)}" if errors else "All endpoints OK",
        duration_seconds=time.monotonic() - t0,
    )

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
