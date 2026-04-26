"""
Sprint 2 — DN 5-fase pipeline (MARS stateNr) + legacy 3-bucket beregninger.

Used by `build_dashboard_data.py`. Tests: `etl/test_mars_pipeline_s2.py`.
"""
from __future__ import annotations

# Verificeret mapping (sprint-2 spec); state 1–2 → sketch (sub: kladde / ansøgt)
PIPELINE_STATE_MAP: dict[int, str] = {
    1: "sketch",
    2: "sketch",
    6: "preliminary_grant",
    20: "preliminary_grant",
    32: "preliminary_done",
    50: "preliminary_done",
    51: "preliminary_done",
    9: "establishment_grant",
    10: "establishment_grant",
    11: "establishment_grant",
    21: "establishment_grant",
    31: "establishment_grant",
    52: "establishment_grant",
    53: "establishment_grant",
    54: "establishment_grant",
    15: "established",
    18: "established",
    3: "cancelled",
    5: "cancelled",
    16: "cancelled",
    17: "cancelled",
}

MAIN_5: tuple[str, ...] = (
    "sketch",
    "preliminary_grant",
    "preliminary_done",
    "establishment_grant",
    "established",
)
CANCELLED_STATES: frozenset[int] = frozenset({3, 5, 16, 17})


def _cel() -> dict:
    return {"count": 0, "ha": 0.0}


def _base() -> dict:
    return {
        "count": 0,
        "nitrogenT": 0.0,
        "extractionHa": 0.0,
        "afforestationHa": 0.0,
    }


def _empty_five() -> dict[str, dict]:
    o = {k: _base() for k in MAIN_5}
    o["sketch"] = {
        "count": 0,
        "nitrogenT": 0.0,
        "extractionHa": 0.0,
        "afforestationHa": 0.0,
        "subStates": {"kladde": _base(), "ansoegt": _base()},
    }
    return o


def _pillar() -> dict:
    return {"nitrogen": _empty_five(), "extraction": _empty_five(), "afforestation": _empty_five()}


def _rollup_sketch(triple: dict) -> None:
    for pk in ("nitrogen", "extraction", "afforestation"):
        sk = triple[pk]["sketch"]
        kl, an = sk["subStates"]["kladde"], sk["subStates"]["ansoegt"]
        sk["count"] = kl["count"] + an["count"]
        sk["nitrogenT"] = round(kl["nitrogenT"] + an["nitrogenT"], 3)
        sk["extractionHa"] = round(kl["extractionHa"] + an["extractionHa"], 2)
        sk["afforestationHa"] = round(kl["afforestationHa"] + an["afforestationHa"], 2)


def _bump(triple: dict, pl: str, n: float, e: float, a: float) -> None:
    for pk in ("nitrogen", "extraction", "afforestation"):
        b = triple[pk][pl]
        b["count"] += 1
        b["nitrogenT"] = round(b["nitrogenT"] + n, 3)
        b["extractionHa"] = round(b["extractionHa"] + e, 2)
        b["afforestationHa"] = round(b["afforestationHa"] + a, 2)


def _bump_sketch(triple: dict, n: float, e: float, a: float, sub: str) -> None:
    for pk in ("nitrogen", "extraction", "afforestation"):
        ssub = triple[pk]["sketch"]["subStates"][sub]
        ssub["count"] += 1
        ssub["nitrogenT"] = round(ssub["nitrogenT"] + n, 3)
        ssub["extractionHa"] = round(ssub["extractionHa"] + e, 2)
        ssub["afforestationHa"] = round(ssub["afforestationHa"] + a, 2)
    _rollup_sketch(triple)


def _empty_cancelled() -> dict:
    return {
        "totalCount": 0,
        "totalHa": 0.0,
        "byCancellationStage": {"preliminary": _cel(), "establishment": _cel()},
        "byReason": {"opgivet": _cel(), "afslag": _cel()},
    }


def _track_cancelled(canc: dict, st: int, n: float, e: float, a: float) -> None:
    ha = max(float(e or 0), float(a or 0))
    canc["totalHa"] = round(canc.get("totalHa", 0) + ha, 1)
    if st in (3, 5):
        b = canc["byCancellationStage"]["preliminary"]
    elif st in (16, 17):
        b = canc["byCancellationStage"]["establishment"]
    else:
        b = None
    if b is not None:
        b["count"] += 1
        b["ha"] = round(b.get("ha", 0) + ha, 1)
    if st in (3, 16):
        r = canc["byReason"]["opgivet"]
    elif st in (5, 17):
        r = canc["byReason"]["afslag"]
    else:
        r = None
    if r is not None:
        r["count"] += 1
        r["ha"] = round(r.get("ha", 0) + ha, 1)
    canc["totalCount"] = (
        canc["byCancellationStage"]["preliminary"]["count"]
        + canc["byCancellationStage"]["establishment"]["count"]
    )


def _round_five(triple: dict) -> None:
    for pk in ("nitrogen", "extraction", "afforestation"):
        for ph in MAIN_5:
            b = triple[pk][ph]
            b["nitrogenT"] = round(b.get("nitrogenT", 0), 1)
            b["extractionHa"] = round(b.get("extractionHa", 0), 1)
            b["afforestationHa"] = round(b.get("afforestationHa", 0), 1)
            if ph == "sketch":
                for sub in ("kladde", "ansoegt"):
                    sb = b["subStates"][sub]
                    sb["nitrogenT"] = round(sb.get("nitrogenT", 0), 1)
                    sb["extractionHa"] = round(sb.get("extractionHa", 0), 1)
                    sb["afforestationHa"] = round(sb.get("afforestationHa", 0), 1)


def build_by_pipeline_phase(
    formal_projects: list[dict],
    deduped_sketches: list[dict],
) -> dict:
    """Returner { byPipelinePhase, cancelled } med fuld 5-fase + sidecar."""
    triple = _pillar()
    canc = _empty_cancelled()
    for p in formal_projects:
        st = p.get("projectStatus")
        n, e, a = p.get("nitrogenReductionT", 0) or 0, p.get("extractionEffortHa", 0) or 0, p.get("afforestationEffortHa", 0) or 0
        if st in CANCELLED_STATES:
            _track_cancelled(canc, st, n, e, a)
            continue
        pl = PIPELINE_STATE_MAP.get(st, "preliminary_grant")
        if pl == "cancelled":
            _track_cancelled(canc, st, n, e, a)
            continue
        if pl == "sketch":
            _bump_sketch(triple, n, e, a, "ansoegt" if st == 2 else "kladde")
        else:
            _bump(triple, pl, n, e, a)
    for s in deduped_sketches:
        n, e, a = s.get("nitrogenReductionT", 0) or 0, s.get("extractionEffortHa", 0) or 0, s.get("afforestationEffortHa", 0) or 0
        _bump_sketch(triple, n, e, a, "kladde")
    _round_five(triple)
    canc["totalCount"] = int(
        canc["byCancellationStage"]["preliminary"]["count"] + canc["byCancellationStage"]["establishment"]["count"]
    )
    return {"byPipelinePhase": triple, "cancelled": canc}


def _legacy_3_for_pillar(five: dict) -> dict:
    pre_sum = {"count": 0, "nitrogenT": 0.0, "extractionHa": 0.0, "afforestationHa": 0.0}
    # Legacy Sprint 1 buckets intentionally exclude sketches. Sketch projects
    # remain visible through ProjectFunnel's own countSketchProjects fields and
    # the new Sprint 2 byPipelinePhase.sketch bucket.
    for ph in ("preliminary_grant", "preliminary_done"):
        x = five[ph]
        pre_sum["count"] += x.get("count", 0)
        pre_sum["nitrogenT"] += x.get("nitrogenT", 0)
        pre_sum["extractionHa"] += x.get("extractionHa", 0)
        pre_sum["afforestationHa"] += x.get("afforestationHa", 0)
    ap = five["establishment_grant"]
    est = five["established"]
    return {
        "preliminary": {
            "count": int(pre_sum["count"]),
            "nitrogenT": round(pre_sum["nitrogenT"], 1),
            "extractionHa": round(pre_sum["extractionHa"], 1),
            "afforestationHa": round(pre_sum["afforestationHa"], 1),
        },
        "approved": {
            "count": ap.get("count", 0),
            "nitrogenT": round(ap.get("nitrogenT", 0), 1),
            "extractionHa": round(ap.get("extractionHa", 0), 1),
            "afforestationHa": round(ap.get("afforestationHa", 0), 1),
        },
        "established": {
            "count": est.get("count", 0),
            "nitrogenT": round(est.get("nitrogenT", 0), 1),
            "extractionHa": round(est.get("extractionHa", 0), 1),
            "afforestationHa": round(est.get("afforestationHa", 0), 1),
        },
    }


def legacy3_merged_from_by_pipeline(triple: dict) -> dict:
    """3-fase shape fra et enkelt `byPipelinePhase`-treet (én build)."""
    n = _legacy_3_for_pillar(triple["nitrogen"])
    e = _legacy_3_for_pillar(triple["extraction"])
    a = _legacy_3_for_pillar(triple["afforestation"])
    return {
        "preliminary": {
            "count": n["preliminary"]["count"],
            "nitrogenT": n["preliminary"]["nitrogenT"],
            "extractionHa": e["preliminary"]["extractionHa"],
            "afforestationHa": a["preliminary"]["afforestationHa"],
        },
        "approved": {
            "count": n["approved"]["count"],
            "nitrogenT": n["approved"]["nitrogenT"],
            "extractionHa": e["approved"]["extractionHa"],
            "afforestationHa": a["approved"]["afforestationHa"],
        },
        "established": {
            "count": n["established"]["count"],
            "nitrogenT": n["established"]["nitrogenT"],
            "extractionHa": e["established"]["extractionHa"],
            "afforestationHa": a["established"]["afforestationHa"],
        },
    }


def compute_project_phase_breakdown_legacy3(
    project_list: list[dict],
    sketch_list: list[dict] | None = None,
) -> dict:
    # `sketch_list` is accepted for backwards call-site compatibility but must
    # not affect legacy preliminary/approved/established totals.
    r = build_by_pipeline_phase(project_list, [])
    return legacy3_merged_from_by_pipeline(r["byPipelinePhase"])


def dedupe_sketches_by_id(plans: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for plan in plans:
        for sp in plan.get("sketchProjects", []):
            sid = sp.get("sketchProjectId", "")
            if not sid or sid in seen:
                continue
            seen.add(sid)
            out.append(sp)
    return out


def build_by_owner_org(
    formal: list[dict], sketches: list[dict], org_from_scheme: dict[str, str]
) -> dict:
    by: dict = {}
    for p in formal:
        st = p.get("projectStatus")
        if st in CANCELLED_STATES:
            continue
        pl = PIPELINE_STATE_MAP.get(st, "preliminary_grant")
        if pl == "cancelled":
            continue
        n, e, a = p.get("nitrogenReductionT", 0) or 0, p.get("extractionEffortHa", 0) or 0, p.get("afforestationEffortHa", 0) or 0
        org = org_from_scheme.get(p.get("subsidySchemeId", ""), "unknown")
        if org not in by:
            by[org] = {"count": 0, "ha": 0.0, "byPipelinePhase": _pillar()}
        o = by[org]
        o["count"] += 1
        o["ha"] = round(o["ha"] + max(e, a), 1)
        if pl == "sketch":
            _bump_sketch(o["byPipelinePhase"], n, e, a, "ansoegt" if st == 2 else "kladde")
        else:
            _bump(o["byPipelinePhase"], pl, n, e, a)
    for _org, o in by.items():
        _round_five(o["byPipelinePhase"])
    return by


def legacy_enrich_phase(status: int | None) -> str:
    """3-fase streng som Sprint 1-UI (ProjectDetail.phase)."""
    if status is None:
        return "preliminary"
    if status in CANCELLED_STATES:
        return "preliminary"
    pl = PIPELINE_STATE_MAP.get(status, "preliminary_grant")
    if pl == "established":
        return "established"
    if pl == "establishment_grant":
        return "approved"
    return "preliminary"


def pipeline_phase_name(status: int | None) -> str:
    if status is None:
        return "preliminary_grant"
    if status in CANCELLED_STATES:
        return "cancelled"
    return PIPELINE_STATE_MAP.get(status, "preliminary_grant")


def project_type_from_measure_name(name: str) -> str:
    m = (name or "").lower()
    if "skov" in m or "skovrejsning" in m:
        return "natur"
    if "lavbund" in m or "mose" in m:
        return "lavbund"
    if "natur" in m or "biodiv" in m:
        return "natur"
    return "lavbund"
