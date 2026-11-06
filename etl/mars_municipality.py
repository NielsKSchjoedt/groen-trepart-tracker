"""
Kommune figures and project → kommune attribution from MARS's own
``/api/status/municipality`` endpoint (stdlib only).

Why this exists
---------------
MARS publishes, per kommune, every project row **clipped to the kommune**
("medregnes kun det areal, der ligger inden for den valgte geografiske
afgrænsning"). Building our kommune figures from those rows means:

* they match MARS's own kommune pages by construction;
* projects spanning several kommuner count only their share in each;
* no geocoding and no GIS libraries are needed (the daily CI job has neither,
  and DAWA's reverse geocoder is gone — HTTP 410 since 2026).

Phase buckets follow the ETL's byKommune keys: status 6 → ``preliminary``
(legacy count key ``assessed``), 10 → ``approved``, 15 → ``established``,
sketch rows → ``sketch``.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable

STATUS_TO_BUCKET = {6: "preliminary", 10: "approved", 15: "established"}
BUCKET_TO_LEGACY_COUNT = {
    "sketch": "sketches",
    "preliminary": "assessed",
    "approved": "approved",
    "established": "established",
}


def _zero_phase() -> dict[str, float]:
    return {"nitrogenT": 0.0, "extractionHa": 0.0, "afforestationHa": 0.0, "count": 0}


def _empty_entry(navn: str) -> dict[str, Any]:
    return {
        "nitrogenT": 0.0,
        "extractionHa": 0.0,
        "afforestationMarsHa": 0.0,
        "permanentEkstensiveringT": 0.0,
        "projectCount": 0,
        "phases": {"sketches": 0, "assessed": 0, "approved": 0, "established": 0},
        "byPhase": {k: _zero_phase() for k in ("sketch", "preliminary", "approved", "established")},
        "kommuneNavn": navn,
    }


def name_to_kode(kommuner: Iterable[dict]) -> dict[str, str]:
    """DAWA kommuner.json (navn, kode) → {navn: kode}. MARS uses the same names."""
    return {k["navn"]: k["kode"] for k in kommuner if k.get("navn") and k.get("kode")}


def aggregate_by_kommune(
    municipalities: list[dict],
    kode_by_name: dict[str, str],
    excluded_ids: set[str] | None = None,
) -> dict[str, dict]:
    """
    Sum MARS's kommune-clipped rows into the byKommune accumulator shape.

    @param municipalities - Parsed ``/status/municipality`` payload
    @param kode_by_name   - {kommune navn: kode}
    @param excluded_ids   - projectIds to skip (e.g. cancelled)
    @returns {kode: accumulator}; a project spanning n kommuner is counted in each,
             exactly as MARS counts it on its kommune pages.
    """
    excluded_ids = excluded_ids or set()
    by_kode: dict[str, dict] = {}
    for m in municipalities:
        kode = kode_by_name.get(m.get("name", ""))
        if not kode:
            continue
        entry = by_kode.setdefault(kode, _empty_entry(m["name"]))

        rows: list[tuple[str, dict]] = []
        for p in m.get("projects") or []:
            if p.get("projectId") in excluded_ids:
                continue
            bucket = STATUS_TO_BUCKET.get(p.get("projectStatus"))
            if bucket:
                rows.append((bucket, p))
        rows += [("sketch", s) for s in (m.get("sketchProjects") or [])]

        for bucket, row in rows:
            n = row.get("nitrogenReductionT") or 0.0
            e = row.get("extractionEffortHa") or 0.0
            a = row.get("afforestationEffortHa") or 0.0
            entry["nitrogenT"] += n
            entry["extractionHa"] += e
            entry["afforestationMarsHa"] += a
            entry["projectCount"] += 1
            entry["phases"][BUCKET_TO_LEGACY_COUNT[bucket]] += 1
            bp = entry["byPhase"][bucket]
            bp["nitrogenT"] += n
            bp["extractionHa"] += e
            bp["afforestationHa"] += a
            bp["count"] += 1

        entry["permanentEkstensiveringT"] += sum(
            (x.get("nitrogenReductionT") or 0.0) for x in (m.get("permanentEkstensiveringProjects") or [])
        )
    return by_kode


def project_attribution(
    municipalities: list[dict],
    kode_by_name: dict[str, str],
) -> tuple[dict[str, dict], dict[str, dict]]:
    """
    projectId / sketchProjectId → {primaryKode, primaryNavn, koder}.

    Primary kommune = the one holding the largest clipped project area; ``koder``
    lists every kommune the project touches, largest share first.
    """

    def collect(key: str, list_key: str) -> dict[str, dict]:
        parts: dict[str, list[tuple[float, str, str]]] = defaultdict(list)
        for m in municipalities:
            kode = kode_by_name.get(m.get("name", ""))
            if not kode:
                continue
            for row in m.get(list_key) or []:
                pid = row.get(key)
                if not pid:
                    continue
                weight = (row.get("overlappingAreaHa") or 0.0) + 1e-9 * (
                    (row.get("extractionEffortHa") or 0.0) + (row.get("afforestationEffortHa") or 0.0)
                )
                parts[pid].append((weight, kode, m["name"]))
        out: dict[str, dict] = {}
        for pid, rows in parts.items():
            rows.sort(key=lambda r: -r[0])
            out[pid] = {
                "primaryKode": rows[0][1],
                "primaryNavn": rows[0][2],
                "koder": [r[1] for r in rows],
            }
        return out

    return collect("projectId", "projects"), collect("sketchProjectId", "sketchProjects")
