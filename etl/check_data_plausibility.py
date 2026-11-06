#!/usr/bin/env python3
"""
Plausibility gate for the daily data job.

The daily job auto-approves, auto-merges and deploys its data PR, so nobody
looks at the numbers before they go live. An upstream outage or format change
(e.g. MARS answering with an empty list) would otherwise put "0 %" on the site
the next morning. This compares the freshly built dashboard-summary.json with
the committed one and fails the job — before any PR is made — when a headline
figure collapses.

Thresholds are deliberately loose: real data moves a few percent a day, so a
failure here means a human should look. A legitimate large change can be
pushed through by running the workflow manually with skip_plausibility.

Run: cd etl && python3 check_data_plausibility.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parent.parent
SUMMARY_REL = "public/data/dashboard-summary.json"

EXPECTED_KOMMUNER = 98
# Max allowed relative drop per headline figure (0.15 = 15 %).
MAX_DROP = {
    "projekter i pipeline": 0.10,
    "anlagte projekter": 0.10,
    "kvælstof i pipeline (t)": 0.20,
    "lavbund i pipeline (ha)": 0.20,
    "skov i MARS (ha)": 0.20,
}


def _get(d: dict[str, Any], *path: str) -> float | None:
    for key in path:
        if not isinstance(d, dict) or key not in d:
            return None
        d = d[key]
    return float(d) if isinstance(d, (int, float)) else None


def headline(summary: dict[str, Any]) -> dict[str, float | None]:
    """The figures the front page and rankings are built on."""
    nat = summary.get("national", {})
    return {
        "projekter i pipeline": _get(nat, "projectPipeline", "total"),
        "anlagte projekter": _get(nat, "projectPipeline", "phases", "established", "count"),
        "kvælstof i pipeline (t)": _get(nat, "progress", "nitrogen", "totalT"),
        "lavbund i pipeline (ha)": _get(nat, "progress", "extraction", "totalHa"),
        "skov i MARS (ha)": _get(nat, "progress", "afforestation", "marsTotal", "ha"),
    }


def compare(old: dict[str, Any], new: dict[str, Any]) -> list[str]:
    """Return human-readable problems; empty when the new data looks plausible."""
    problems: list[str] = []

    kommuner = len(new.get("national", {}).get("byKommune", []))
    if kommuner != EXPECTED_KOMMUNER:
        problems.append(f"{kommuner} kommuner i stedet for {EXPECTED_KOMMUNER}")

    old_plans, new_plans = len(old.get("plans", [])), len(new.get("plans", []))
    if old_plans and new_plans < old_plans:
        problems.append(f"{new_plans} vandplaner i stedet for {old_plans}")

    before, after = headline(old), headline(new)
    for name, max_drop in MAX_DROP.items():
        b, a = before[name], after[name]
        if a is None:
            problems.append(f"{name} mangler i de nye data")
            continue
        if b is None or b <= 0:
            continue
        if a <= 0:
            problems.append(f"{name} er faldet fra {b:,.0f} til 0")
        elif (b - a) / b > max_drop:
            problems.append(
                f"{name} er faldet {100 * (b - a) / b:.0f} % ({b:,.0f} → {a:,.0f}); grænsen er {100 * max_drop:.0f} %"
            )
    return problems


def committed_summary() -> dict[str, Any] | None:
    """dashboard-summary.json as committed on the checked-out branch (main)."""
    try:
        raw = subprocess.run(
            ["git", "show", f"HEAD:{SUMMARY_REL}"],
            cwd=REPO, check=True, capture_output=True, text=True,
        ).stdout
    except subprocess.CalledProcessError:
        return None
    return json.loads(raw)


def main() -> int:
    if os.environ.get("SKIP_PLAUSIBILITY", "").lower() in ("1", "true"):
        print("⚠ Plausibilitetstjek sprunget over (skip_plausibility)")
        return 0
    old = committed_summary()
    if old is None:
        print("ℹ Ingen committet dashboard-summary.json at sammenligne med — springer over")
        return 0
    new = json.loads((REPO / SUMMARY_REL).read_text(encoding="utf-8"))
    problems = compare(old, new)
    if problems:
        for p in problems:
            print(f"::error title=Data ser forkerte ud::{p}")
        print(
            "Dataene merges ikke automatisk. Tjek kilderne; er ændringen ægte, så kør "
            "workflowet manuelt med skip_plausibility."
        )
        return 1
    for name, value in headline(new).items():
        print(f"  ✓ {name}: {value:,.0f}" if value is not None else f"  ? {name}: —")
    print("✓ Data ser plausible ud")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
