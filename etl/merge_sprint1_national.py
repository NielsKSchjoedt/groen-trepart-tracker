"""
Append Sprint 1 national fields to an existing dashboard-data.json
without re-running the full MARS/DAWA pipeline. Invoked as:

  python3 etl/merge_sprint1_national.py

Reads/writes: public/data/dashboard-summary.json and data/dashboard-summary.json
(merges project-details.json in memory for by-initiator computation)
"""
from __future__ import annotations

import json
import os
import sys
import shutil

BASE = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
SUMMARY_PATHS = [
    f"{BASE}/public/data/dashboard-summary.json",
    f"{BASE}/data/dashboard-summary.json",
]
DETAILS_PATHS = [
    f"{BASE}/public/data/project-details.json",
    f"{BASE}/data/project-details.json",
]


def _merge_plan_drilldown(summary: dict) -> list:
    """Attach projectDetails from project-details.json for scripts that need them."""
    details_src = DETAILS_PATHS[0] if os.path.isfile(DETAILS_PATHS[0]) else DETAILS_PATHS[1]
    if not os.path.isfile(details_src):
        return summary.get("plans", [])
    with open(details_src, encoding="utf-8") as f:
        details = json.load(f)
    by_id = {p["id"]: p for p in details.get("plans", [])}
    merged = []
    for plan in summary.get("plans", []):
        drill = by_id.get(plan["id"], {})
        merged.append({
            **plan,
            "projectDetails": drill.get("projectDetails", []),
            "sketchProjects": drill.get("sketchProjects", []),
            "naturePotentials": drill.get("naturePotentials", []),
        })
    return merged


def classify_initiator(scheme_org: str, scheme_name: str) -> str:
    if scheme_org == "NST":
        return "state"
    if scheme_org == "LBST" or scheme_name == "Minivådområder":
        return "private"
    return "municipal"


def _empty_ha_cell():
    return {"ha": 0.0, "projectCount": 0}


def _empty_nitro_cell():
    return {"ha": 0.0, "projectCount": 0}


def _empty_ha_breakdown():
    return {"state": _empty_ha_cell(), "municipal": _empty_ha_cell(), "private": _empty_ha_cell()}


def _empty_nitro_breakdown():
    return {"state": _empty_nitro_cell(), "municipal": _empty_nitro_cell(), "private": _empty_nitro_cell()}


def _acc_ha(bd, init: str, ha: float):
    c = bd[init]
    c["ha"] = round(c["ha"] + ha, 2)
    c["projectCount"] += 1


def _acc_nitro(bd, init: str, t: float):
    c = bd[init]
    c["ha"] = round(c["ha"] + t, 3)
    c["projectCount"] += 1


def compute_by_initiator_ha(plan_entries: list) -> dict:
    phases = ("sketch", "preliminary", "approved", "established")
    by_phase: dict = {}
    for ph in phases:
        by_phase[ph] = {
            "extraction": _empty_ha_breakdown(),
            "afforestation": _empty_ha_breakdown(),
            "nitrogen": _empty_nitro_breakdown(),
        }

    for plan in plan_entries:
        for proj in plan.get("projectDetails", []):
            phase = proj.get("phase", "")
            if phase not in ("preliminary", "approved", "established"):
                continue
            init = classify_initiator(proj.get("schemeOrg", ""), proj.get("schemeName", ""))
            n = proj.get("nitrogenT", 0) or 0
            e = proj.get("extractionHa", 0) or 0
            a = proj.get("afforestationHa", 0) or 0
            if n > 0:
                _acc_nitro(by_phase[phase]["nitrogen"], init, n)
            if e > 0:
                _acc_ha(by_phase[phase]["extraction"], init, e)
            if a > 0:
                _acc_ha(by_phase[phase]["afforestation"], init, a)
        for sk in plan.get("sketchProjects", []):
            init = classify_initiator(sk.get("schemeOrg", ""), sk.get("schemeName", ""))
            n = sk.get("nitrogenT", 0) or 0
            e = sk.get("extractionHa", 0) or 0
            a = sk.get("afforestationHa", 0) or 0
            if n > 0:
                _acc_nitro(by_phase["sketch"]["nitrogen"], init, n)
            if e > 0:
                _acc_ha(by_phase["sketch"]["extraction"], init, e)
            if a > 0:
                _acc_ha(by_phase["sketch"]["afforestation"], init, a)

    def _merge_ha_bds(*bds):
        out = _empty_ha_breakdown()
        for bd in bds:
            for k in ("state", "municipal", "private"):
                out[k]["ha"] = round(out[k]["ha"] + bd[k]["ha"], 2)
                out[k]["projectCount"] += bd[k]["projectCount"]
        return out

    def _merge_nitro_bds(*bds):
        out = _empty_nitro_breakdown()
        for bd in bds:
            for k in ("state", "municipal", "private"):
                out[k]["ha"] = round(out[k]["ha"] + bd[k]["ha"], 3)
                out[k]["projectCount"] += bd[k]["projectCount"]
        return out

    p_nop = ("preliminary", "approved", "established")
    return {
        "extraction": _merge_ha_bds(*(by_phase[p]["extraction"] for p in p_nop)),
        "afforestation": _merge_ha_bds(*(by_phase[p]["afforestation"] for p in p_nop)),
        "nitrogen": _merge_nitro_bds(*(by_phase[p]["nitrogen"] for p in p_nop)),
        "byPhase": by_phase,
    }


def main() -> int:
    src = SUMMARY_PATHS[0] if os.path.isfile(SUMMARY_PATHS[0]) else SUMMARY_PATHS[1]
    if not os.path.isfile(src):
        print("No dashboard-summary.json found — run build_dashboard_data.py first", file=sys.stderr)
        return 1
    with open(src, encoding="utf-8") as f:
        d = json.load(f)
    national = d.setdefault("national", {})
    plans = _merge_plan_drilldown(d)
    national["byInitiatorHa"] = compute_by_initiator_ha(plans)

    try:
        with open(f"{BASE}/data/klimaraadet/statusrapport-2026.json", encoding="utf-8") as f:
            km = json.load(f)
        national["klimaraadet"] = {
            "rapportTitle": km.get("rapportTitle", ""),
            "publiceret": km.get("publiceret", ""),
            "url": km.get("url", ""),
            "vurderinger": km.get("vurderinger", {}),
            "_meta": km.get("_meta"),
        }
    except FileNotFoundError:
        pass

    try:
        with open(f"{BASE}/data/finansiering/aftaler.json", encoding="utf-8") as f:
            bud = json.load(f)
        prog = national["progress"]
        _ext_e = prog["extraction"]["byPhase"]["established"]["ha"]
        _ksf_lb = prog["extraction"].get("supplementary", {}).get("klimaskovfondenLavbundHa", 0) or 0
        _aff_e = prog["afforestation"]["marsTotal"]["byPhase"]["established"]["ha"]
        _ksf_s = prog["afforestation"].get("supplementary", {}).get("klimaskovfondenHa", 0) or 0
        _nst_s = prog["afforestation"].get("supplementary", {}).get("nstSkovHa", 0) or 0
        _n_est = prog["nitrogen"]["byPhase"]["established"]["T"]
        for _cat in bud.get("kategorier", []):
            if _cat.get("id") == "lavbund-udtagning":
                _cat["realiseringHa"] = round(float(_ext_e) + float(_ksf_lb), 1)
            elif _cat.get("id") == "skov":
                _cat["realiseringHa"] = round(float(_aff_e) + float(_ksf_s) + float(_nst_s), 1)
            elif _cat.get("id") == "kvaelstof":
                _cat["realiseringTonN"] = round(float(_n_est), 1)
        national["budgetData"] = bud
    except FileNotFoundError:
        pass

    for p in SUMMARY_PATHS:
        try:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, "w", encoding="utf-8") as f:
                json.dump(d, f, ensure_ascii=False, indent=2)
            print("Updated", p)
        except OSError as e:
            print("Skip", p, e, file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
