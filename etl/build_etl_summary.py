#!/usr/bin/env python3
"""
Build a compact ETL run summary from the raw etl-log.json.

Groups individual source-level log entries by calendar date and produces
a compact per-day summary (last 30 days) for the frontend health widget on
the "Data og metode" page.

Input:  data/etl-log.json
Output: data/etl-run-summary.json       (committed to git, audit trail)
        public/data/etl-run-summary.json (served to the frontend)

Run as part of the GitHub Actions workflow after all fetchers complete.
"""

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BASE = SCRIPT_DIR.parent
LOG_FILE = BASE / "data" / "etl-log.json"
OUT_DATA = BASE / "data" / "etl-run-summary.json"
OUT_PUBLIC = BASE / "public" / "data" / "etl-run-summary.json"

# Sources that run in the daily GitHub Actions workflow (used for overall status).
DAILY_SOURCES = {"mars", "dawa", "miljoegis", "dst", "vanda", "klimaregnskab"}

KEEP_DAYS = 30


def _key_records(source: str, records: dict) -> dict:
    """Extract the most meaningful record counts to surface per source."""
    if source == "mars":
        return {k: records[k] for k in ("projects", "plans") if k in records}
    if source == "dawa":
        return {"municipalities": records["municipalities"]} if "municipalities" in records else {}
    if source == "vanda":
        return {"stations": records["stations"]} if "stations" in records else {}
    if source == "klimaregnskab":
        return {"municipalities": records["municipalities"]} if "municipalities" in records else {}
    return {}


def build_summary() -> None:
    if not LOG_FILE.exists():
        print("⚠ etl-log.json not found — nothing to summarise")
        return

    log = json.loads(LOG_FILE.read_text())
    runs = log.get("runs", [])

    # Group entries by date, then by source.
    # Later entries overwrite earlier ones for the same (date, source) pair
    # so that reruns within a day reflect the most recent outcome.
    by_date: dict[str, dict[str, dict]] = defaultdict(dict)
    for entry in runs:
        ts = entry.get("timestamp", "")
        if not ts:
            continue
        date = ts[:10]  # YYYY-MM-DD
        source = entry.get("source", "unknown")
        by_date[date][source] = entry

    sorted_dates = sorted(by_date.keys(), reverse=True)[:KEEP_DAYS]

    recent_runs = []
    for date in sorted_dates:
        sources_for_day = by_date[date]

        # Build per-source summary dict
        sources_out: dict[str, dict] = {}
        for source, entry in sources_for_day.items():
            status = entry.get("status", "error")
            rec = entry.get("records", {})
            src_entry: dict = {"status": status}
            src_entry.update(_key_records(source, rec))
            if entry.get("notes"):
                src_entry["notes"] = entry["notes"]
            sources_out[source] = src_entry

        # Overall status considers only daily CI sources for the day.
        # "ok"      — all daily sources succeeded
        # "partial" — at least one succeeded, at least one failed
        # "error"   — no daily source succeeded (or none ran)
        daily_statuses = [
            sources_for_day[s].get("status", "error")
            for s in DAILY_SOURCES
            if s in sources_for_day
        ]
        if not daily_statuses:
            overall = "error"
        elif all(s == "ok" for s in daily_statuses):
            overall = "ok"
        elif any(s == "ok" for s in daily_statuses):
            overall = "partial"
        else:
            overall = "error"

        # runAt = latest timestamp seen across all sources on this day
        latest_ts = max(
            (e.get("timestamp", "") for e in sources_for_day.values()),
            default=date + "T00:00:00Z",
        )

        recent_runs.append({
            "date": date,
            "runAt": latest_ts,
            "status": overall,
            "sources": sources_out,
        })

    summary = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "recentRuns": recent_runs,
    }

    for out in (OUT_DATA, OUT_PUBLIC):
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n")
        print(f"  Written {out}")

    if recent_runs:
        latest = recent_runs[0]
        src_count = len(latest["sources"])
        print(f"ETL run summary: {len(recent_runs)} days — latest {latest['date']} ({latest['status']}, {src_count} sources)")
    else:
        print("ETL run summary: no runs found in log")


if __name__ == "__main__":
    build_summary()
