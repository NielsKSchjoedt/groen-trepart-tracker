"""
Shared ETL logging utility.

Appends a structured log entry to data/etl-log.json after each ETL run.
The log is git-committed alongside the data, providing a transparent audit
trail of when data was fetched, from which endpoints, and what was returned.

Usage in ETL scripts:
    from etl_log import log_etl_run

    log_etl_run(
        source="mars",
        endpoints=["https://mars.sgav.dk/api/status/plans", ...],
        records={"plans": 37, "projects": 1164, "vos": 23},
        status="ok",       # or "partial" or "error"
        notes="All endpoints returned 200"
    )
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path


LOG_FILE = Path(__file__).parent.parent / "data" / "etl-log.json"


def log_etl_run(
    source: str,
    endpoints: list[str],
    records: dict[str, int],
    status: str = "ok",
    notes: str = "",
    duration_seconds: float | None = None,
) -> None:
    """Append one log entry to the ETL log file."""
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "status": status,
        "endpoints": endpoints,
        "records": records,
        "notes": notes,
    }
    if duration_seconds is not None:
        entry["duration_seconds"] = round(duration_seconds, 1)

    # Read existing log or start fresh
    if LOG_FILE.exists():
        try:
            log = json.loads(LOG_FILE.read_text())
            if not isinstance(log, dict) or "runs" not in log:
                log = {"runs": []}
        except (json.JSONDecodeError, ValueError):
            log = {"runs": []}
    else:
        log = {"runs": []}

    log["runs"].append(entry)

    # Keep last 365 entries to avoid unbounded growth (one per source per day ≈ ~6 sources × 365 days)
    if len(log["runs"]) > 2190:
        log["runs"] = log["runs"][-2190:]

    LOG_FILE.write_text(json.dumps(log, indent=2, ensure_ascii=False) + "\n")
