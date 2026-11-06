#!/usr/bin/env python3
"""
ETL: Fetch data from MARS (mars.sgav.dk) — official WFS + REST API

Stores raw JSON responses in data/mars/. Designed to run on schedule via
GitHub Actions or manually.

Flat project list (data/mars/projects.json) — official WFS (mars.sgav.dk/geo/wfs):
  mars:projekter_samlet                     → every project in a formal phase, with
                                              effects, status and phase dates
  mars:projekter_tilskudsordning_skovrejsning → forest sub-polygons (supplementaryGeometries)
  Mapped into the REST /api/status/projects row shape (see mars_wfs.py). Rows that
  changed after the nightly WFS refresh are taken from REST /api/status/projects.

REST endpoints (no official alternative for these aggregations):
  /api/master-data       → Subsidy schemes, project states, national goals
  /api/status/plans      → 37 kystvandgrupper with N-reduction targets + nested projects
  /api/status/vos        → 23 vandopland (main catchments) aggregations
  /api/status/metadata   → National goals + plan definitions
  /api/status/municipality, /permanent-ekstensivering, /projects/history

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
import mars_wfs

# Configuration
MARS_BASE = "https://mars.sgav.dk/api"
_THIS_YEAR = datetime.now(timezone.utc).year

ENDPOINTS = {
    "master-data": "/master-data",
    "plans": "/status/plans",
    "vos": "/status/vos",
    "metadata": "/status/metadata",
    # Per-kommune aggregates with area-clipped project rows — MARS's own kommune view.
    # Source of truth for every kommune figure (replaces our DAWA reverse geocoding).
    "municipality": "/status/municipality",
    # Permanent ekstensivering is reported separately from /status/projects;
    # MARS's national N headline = Σ projects + Σ this endpoint.
    "permanent-ekstensivering": "/status/permanent-ekstensivering",
    # Quarterly phase counts as they actually were (MARS keeps history from 2025-Q3).
    "projects-history": f"/status/projects/history?fromYear=2024&fromQuarter=1&toYear={_THIS_YEAR}&toQuarter=4",
}

# REST flat project list — only fetched as a fallback for rows the nightly WFS
# snapshot does not have yet (see build_projects()).
PROJECTS_REST_PATH = "/status/projects"

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


def build_projects(plans: list, master: dict) -> tuple[list | None, dict]:
    """Flat project list from the official WFS, reconciled against the live REST plans.

    Returns (rows in REST /status/projects shape, provenance info). Falls back to the
    REST list entirely if the WFS is unreachable.
    """
    info: dict = {"source": "wfs", "wfsLayer": mars_wfs.LAYER_PROJECTS, "wfsUrl": mars_wfs.MARS_WFS}
    try:
        feats = mars_wfs.fetch_layer(mars_wfs.LAYER_PROJECTS)
        forest = mars_wfs.fetch_layer(mars_wfs.LAYER_FOREST)
    except Exception as e:  # noqa: BLE001 — any WFS failure → REST as before
        print(f"    ✗ WFS failed ({e}) — falling back to REST {PROJECTS_REST_PATH}")
        rest = fetch_endpoint("projects (REST fallback)", PROJECTS_REST_PATH)
        info.update(source="rest", error=str(e))
        return rest, info
    print(f"  WFS {mars_wfs.LAYER_PROJECTS}: {len(feats)} projects; {mars_wfs.LAYER_FOREST}: {len(forest)} rows")

    lookups = mars_wfs.build_lookups(master or {})
    plan_rows = mars_wfs.plan_rows_by_project(plans or [])
    forest_by_id: dict[str, list] = {}
    for f in forest:
        forest_by_id.setdefault((f.get("properties") or {}).get("mars_id"), []).append(f)
    wfs_rows = {}
    for f in feats:
        props = f.get("properties") or {}
        pid = props.get("mars_id")
        wfs_rows[pid] = mars_wfs.wfs_project_row(props, lookups, plan_rows.get(pid), forest_by_id.get(pid))

    stale = mars_wfs.stale_project_ids(wfs_rows, plan_rows) if plans else set()
    rest = None
    if stale:
        print(f"    {len(stale)} project(s) changed since the nightly WFS refresh — "
              f"taking them from REST {PROJECTS_REST_PATH}")
        rest = fetch_endpoint("projects (REST fallback)", PROJECTS_REST_PATH)
        if rest is None:
            info["fallbackError"] = "REST fallback failed; stale WFS rows kept"
    rows = mars_wfs.merge_with_rest_fallback(wfs_rows, stale, rest)
    info.update(
        wfsCount=len(feats),
        count=len(rows),
        restFallbackCount=sum(1 for r in rows if r.get("source") == "rest-fallback"),
        restFallbackIds=sorted(stale)[:50],
        wfsUpdated=max((r.get("wfsUpdated") or "" for r in wfs_rows.values()), default=None),
    )
    print(f"    ✓ {len(rows)} projects ({info['restFallbackCount']} from REST fallback)")
    return rows, info


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
        # MARS names these counts counter-intuitively (verified on all 37 plans and
        # against /status/projects/history): countAssessedProjects = status 10
        # (etableringstilsagn), countApprovedProjects = status 6 (forundersøgelsestilsagn).
        # Map to their meaning here so nothing downstream inherits the inversion.
        # NB: plan-level counts double-count projects that span several plans.
        total_established = sum(p.get("countEstablishedProjects", 0) or 0 for p in plans)
        total_establishment_grant = sum(p.get("countAssessedProjects", 0) or 0 for p in plans)
        total_preliminary_grant = sum(p.get("countApprovedProjects", 0) or 0 for p in plans)
        total_sketch = sum(p.get("countSketchProjects", 0) or 0 for p in plans)
        progress_pct = round(total_achieved / total_goal * 100, 1) if total_goal > 0 else 0
        summary["endpoints"]["plans"] = {
            "total_plans": len(plans),
            "nitrogen_goal_T": round(total_goal, 3),
            "nitrogen_achieved_T": round(total_achieved, 3),
            "nitrogen_progress_pct": progress_pct,
            "established_projects": total_established,
            "establishment_grant_projects": total_establishment_grant,
            "preliminary_grant_projects": total_preliminary_grant,
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

    # Flat project list: official WFS, reconciled against the live REST plans.
    print("  Fetching projects: official WFS (mars:projekter_samlet)")
    projects, projects_info = build_projects(fetched.get("plans"), fetched.get("master-data"))
    if projects is not None:
        fetched["projects"] = projects
    else:
        errors.append("projects")

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
    summary["projectsSource"] = projects_info
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
        print(f"  Plan rows: {p['established_projects']} anlagt, {p['establishment_grant_projects']} etableringstilsagn, {p['preliminary_grant_projects']} forundersøgelse, {p['sketch_projects']} skitser")
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
        endpoints=[mars_wfs.wfs_url(mars_wfs.LAYER_PROJECTS), mars_wfs.wfs_url(mars_wfs.LAYER_FOREST)]
        + [f"{MARS_BASE}{path}" for path in ENDPOINTS.values()],
        records=record_counts,
        status="ok" if not errors else ("partial" if fetched else "error"),
        notes=(f"Errors: {', '.join(errors)}" if errors else "All endpoints OK")
        + f"; projects from {projects_info.get('source')}"
        + (f" ({projects_info.get('restFallbackCount')} REST fallback rows)" if projects_info.get("restFallbackCount") else ""),
        duration_seconds=time.monotonic() - t0,
    )

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
