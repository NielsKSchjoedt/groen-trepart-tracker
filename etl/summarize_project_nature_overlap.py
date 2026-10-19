#!/usr/bin/env python3
"""Recompute nationalSummary on project-nature-overlap.json without GIS deps."""
from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from nature_projects import (  # noqa: E402
    NATURE_OVERLAP_THRESHOLD_HA,
    NATURE_PIPELINE_MEASURES,
    is_nature_pipeline_measure,
)

REPO = SCRIPT_DIR.parent
PATHS = (
    REPO / "data" / "project-nature-overlap.json",
    REPO / "public" / "data" / "project-nature-overlap.json",
)


def national_overlap_summary(by_project: dict, *, threshold_ha: float = NATURE_OVERLAP_THRESHOLD_HA) -> dict:
    pipeline = [p for p in by_project.values() if is_nature_pipeline_measure(p.get("measure"))]
    unthresholded = [p for p in pipeline if (p.get("biodiversitetHa") or 0) > 0]
    with_overlap = [p for p in pipeline if (p.get("biodiversitetHa") or 0) > threshold_ha]

    def bucket(measure: str) -> dict:
        rows = [p for p in pipeline if p.get("measure") == measure]
        hit = [p for p in rows if (p.get("biodiversitetHa") or 0) > threshold_ha]
        return {
            "projects": len(rows),
            "withOverlap": len(hit),
            "biodiversitetHa": round(sum(p.get("biodiversitetHa") or 0 for p in rows), 2),
        }

    return {
        "thresholdHa": threshold_ha,
        "naturePipelineMeasures": sorted(NATURE_PIPELINE_MEASURES),
        "projectsWithGeometry": len(by_project),
        "naturePipelineWithGeometry": len(pipeline),
        "withBiodiversityOverlap": len(with_overlap),
        "withBiodiversityOverlapUnthresholded": len(unthresholded),
        "withoutBiodiversityOverlap": len(pipeline) - len(with_overlap),
        "biodiversitetHa": round(sum(p.get("biodiversitetHa") or 0 for p in pipeline), 2),
        "section3Ha": round(sum(p.get("section3Ha") or 0 for p in pipeline), 2),
        "natura2000Ha": round(sum(p.get("natura2000Ha") or 0 for p in pipeline), 2),
        "lavbund": bucket("Lavbundsprojekter"),
        "afforestation": bucket("Skovrejsning"),
    }


def main() -> int:
    src = next((p for p in PATHS if p.exists()), None)
    if src is None:
        print("No project-nature-overlap.json found", file=sys.stderr)
        return 1
    payload = json.loads(src.read_text(encoding="utf-8"))
    summary = national_overlap_summary(payload.get("byProject") or {})
    meta = payload.setdefault("metadata", {})
    meta["overlapThresholdHa"] = NATURE_OVERLAP_THRESHOLD_HA
    meta["note"] = (
        "Overlap er stedsspecifikt og ikke en ubetinget god indikator: projekter lagt "
        "hvor der allerede er natur kan være overlap med eksisterende beskyttelse, ikke ny natur. "
        "MARS holder tilskudsareal ude af §3. Projekter er klippet til kommunegrænser, "
        "så areal ikke dobbelttælles på tværs af kommuner."
    )
    payload["nationalSummary"] = summary
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    for path in PATHS:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    print(
        f"✓ {summary['withBiodiversityOverlap']}/{summary['naturePipelineWithGeometry']} "
        f"nature-pipeline projects overlap DCE 30 % (>{NATURE_OVERLAP_THRESHOLD_HA} ha); "
        f"{summary['biodiversitetHa']} ha. Unthresholded: "
        f"{summary['withBiodiversityOverlapUnthresholded']}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
