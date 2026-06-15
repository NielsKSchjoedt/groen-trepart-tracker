#!/usr/bin/env python3
"""
Build Sprint 6 municipality competition ranking dataset.

Combines dashboard byKommune (MARS phases) with B1/B2/B3 benchmarks into
`kommune-ranking.json` for the standings UI.

Delivery uses established (anlagt) only by default; KSF + NST included in skov delivery.
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
REPO = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from etl_log import log_etl_run

DASHBOARD_SUMMARY = REPO / "data" / "dashboard-summary.json"
B1_PATH = REPO / "data" / "kommune-benchmark" / "b1-andel-nationalt-naturpotentiale.json"
B2_PATH = REPO / "data" / "kommune-benchmark" / "b2-marker-i-naturpotentiale.json"
B3_PATH = REPO / "data" / "kommune-benchmark" / "b3-n2000-er-landbrug.json"
PROJECT_OVERLAP_PATH = REPO / "data" / "project-nature-overlap.json"
OUT_DIR = REPO / "data" / "kommune-benchmark"
PUBLIC_OUT_DIR = REPO / "public" / "data" / "kommune-benchmark"

METHOD_VERSION = "sprint6-v2"
RANKING_PHASES = ("established",)
EXCLUDED_KODER = {"0411"}


def write_json_both(relative_name: str, data: dict[str, Any]) -> None:
    """Write artifact to data/ and public/data/."""
    for base in (OUT_DIR, PUBLIC_OUT_DIR):
        base.mkdir(parents=True, exist_ok=True)
        (base / relative_name).write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )


def _phase_sum(km: dict[str, Any], field: str) -> float:
    by_phase = km.get("byPhase") or {}
    return sum(float(by_phase.get(ph, {}).get(field, 0) or 0) for ph in RANKING_PHASES)


def _skov_delivery_ha(km: dict[str, Any]) -> float:
    """MARS skov (phase-filtered) + Klimaskovfonden + Naturstyrelsen."""
    mars = _phase_sum(km, "afforestationHa")
    ksf = float(km.get("afforestationKsfHa", 0) or 0)
    nst = float(km.get("afforestationNstHa", 0) or 0)
    return mars + ksf + nst


def _safe_ratio(num: float, denom: float) -> float | None:
    if denom <= 0:
        return None
    return round(num / denom, 4)


def _rank_map(rows: list[dict[str, Any]], key: str, higher_better: bool = True) -> dict[str, int]:
    """Assign ranks 1..N; null values sort last."""
    def sort_val(row: dict[str, Any]) -> float:
        v = row.get(key)
        if v is None:
            return float("-inf") if higher_better else float("inf")
        return float(v)

    ordered = sorted(rows, key=sort_val, reverse=higher_better)
    return {row["kode"]: i + 1 for i, row in enumerate(ordered)}


def build() -> dict[str, int]:
    """Build ranking JSON from dashboard + benchmark files."""
    if not DASHBOARD_SUMMARY.exists():
        raise SystemExit(f"Missing {DASHBOARD_SUMMARY} — run build_dashboard_data.py first")
    for path in (B1_PATH, B2_PATH, B3_PATH):
        if not path.exists():
            raise SystemExit(f"Missing {path} — run build_kommune_benchmark.py first")

    dashboard = json.loads(DASHBOARD_SUMMARY.read_text(encoding="utf-8"))
    b1 = json.loads(B1_PATH.read_text(encoding="utf-8"))
    b2 = json.loads(B2_PATH.read_text(encoding="utf-8"))
    b3 = json.loads(B3_PATH.read_text(encoding="utf-8"))

    kommuner: list[dict[str, Any]] = dashboard["national"]["byKommune"]
    b1_by = b1["byKommune"]
    b2_by = b2["byKommune"]
    b3_by = b3["byKommune"]

    # Per-kommune project × nature overlap (our own spatial overlay; optional —
    # produced by build_project_nature_overlap.py in the monthly spatial job).
    overlap_by: dict[str, Any] = {}
    try:
        overlap_by = json.loads(PROJECT_OVERLAP_PATH.read_text(encoding="utf-8")).get("byKommune", {})
    except FileNotFoundError:
        print("⚠ project-nature-overlap.json not found — projektNatur* fields will be 0")

    deliveries: list[dict[str, Any]] = []
    nat_extraction = 0.0
    nat_skov = 0.0
    nat_n = 0.0
    nat_phase_ha: dict[str, dict[str, float]] = {
        ph: {"extractionHa": 0.0, "afforestationHa": 0.0, "nitrogenT": 0.0, "count": 0.0}
        for ph in (*RANKING_PHASES, "sketch")
    }

    for km in kommuner:
        kode = str(km.get("kode", "")).zfill(4)
        if kode in EXCLUDED_KODER:
            continue
        ext = _phase_sum(km, "extractionHa")
        skov = _skov_delivery_ha(km)
        n_t = _phase_sum(km, "nitrogenT")
        nat_extraction += ext
        nat_skov += skov
        nat_n += n_t
        by_phase = km.get("byPhase") or {}
        for ph in nat_phase_ha:
            pm = by_phase.get(ph, {})
            nat_phase_ha[ph]["extractionHa"] += float(pm.get("extractionHa", 0) or 0)
            nat_phase_ha[ph]["afforestationHa"] += float(pm.get("afforestationHa", 0) or 0)
            nat_phase_ha[ph]["nitrogenT"] += float(pm.get("nitrogenT", 0) or 0)
            nat_phase_ha[ph]["count"] += float(pm.get("count", 0) or 0)

        deliveries.append({
            "kode": kode,
            "navn": km.get("navn", ""),
            "region": km.get("region", ""),
            "deliveryExtractionHa": round(ext, 2),
            "deliverySkovHa": round(skov, 2),
            "deliveryKvaelstofT": round(n_t, 2),
            "leveretHa": round(ext + skov, 2),
            "co2T": round(float(km.get("co2EstimatedT", 0) or 0), 1),
            "projekterTotal": int(km.get("projectCount", 0) or 0),
        })

    rows: list[dict[str, Any]] = []
    for d in deliveries:
        kode = d["kode"]
        b1_row = b1_by.get(kode)
        b2_row = b2_by.get(kode)
        b3_row = b3_by.get(kode)
        if not b1_row or not b2_row or not b3_row:
            continue

        ansvar = float(b1_row.get("dce30PctOfNational", 0) or 0)
        lev_ext = _safe_ratio(d["deliveryExtractionHa"], nat_extraction)
        lev_ext_pct = round(lev_ext * 100, 4) if lev_ext is not None else None
        lev_skov = _safe_ratio(d["deliverySkovHa"], nat_skov)
        lev_skov_pct = round(lev_skov * 100, 4) if lev_skov is not None else None
        lev_n = _safe_ratio(d["deliveryKvaelstofT"], nat_n)
        lev_n_pct = round(lev_n * 100, 4) if lev_n is not None else None

        def idx(levering_pct: float | None) -> float | None:
            if levering_pct is None or ansvar <= 0:
                return None
            return round(levering_pct / ansvar, 4)

        gap = b3_row.get("andelLandbrugIN2000Pct")
        gap_f = float(gap) if gap is not None else None

        ov = overlap_by.get(kode) or {}

        rows.append({
            "kode": kode,
            "kommuneNavn": d["navn"],
            "region": d["region"],
            "ansvarPct": round(ansvar, 4),
            "ansvarKuPrio1Pct": round(float(b1_row.get("kuPrio1PctOfNational", 0) or 0), 4),
            "ansvarKuPrio2Pct": round(float(b1_row.get("kuPrio2PctOfNational", 0) or 0), 4),
            "leveringUdtagningPct": lev_ext_pct,
            "leveringSkovPct": lev_skov_pct,
            "leveringKvaelstofPct": lev_n_pct,
            "idxLavbund": idx(lev_ext_pct),
            "idxSkov": idx(lev_skov_pct),
            "idxKvaelstof": idx(lev_n_pct),
            "kvalitetGapPct": round(gap_f, 2) if gap_f is not None else None,
            "markerHoejtPotentialePct": round(float(b2_row.get("hoejtPotentialePct", 0) or 0), 2),
            "projektNaturBiodiversitetHa": round(float(ov.get("biodiversitetHa", 0) or 0), 2),
            "projektNaturSection3Ha": round(float(ov.get("section3Ha", 0) or 0), 2),
            "projektNaturNatura2000Ha": round(float(ov.get("natura2000Ha", 0) or 0), 2),
            "projektNaturAreaHa": round(float(ov.get("projektAreaHa", 0) or 0), 2),
            "leveretHa": d["leveretHa"],
            "deliveryExtractionHa": d["deliveryExtractionHa"],
            "deliverySkovHa": d["deliverySkovHa"],
            "deliveryKvaelstofT": d["deliveryKvaelstofT"],
            "co2T": d["co2T"],
            "projekterTotal": d["projekterTotal"],
        })

    rank_keys = [
        ("idxLavbund", True),
        ("idxSkov", True),
        ("idxKvaelstof", True),
        ("kvalitetGapPct", False),
        ("projektNaturBiodiversitetHa", True),
        ("leveretHa", True),
    ]
    for key, higher in rank_keys:
        ranks = _rank_map(rows, key, higher_better=higher)
        for row in rows:
            row.setdefault("rankByMetric", {})[key] = ranks.get(row["kode"])

    nat_total_ha = sum(
        nat_phase_ha[ph]["extractionHa"] + nat_phase_ha[ph]["afforestationHa"]
        for ph in RANKING_PHASES
    )
    national = {
        "deliveryExtractionHa": round(nat_extraction, 2),
        "deliverySkovHa": round(nat_skov, 2),
        "deliveryKvaelstofT": round(nat_n, 2),
        "leveretHa": round(nat_extraction + nat_skov, 2),
        "phaseShareHa": {
            ph: {
                "extractionHa": round(nat_phase_ha[ph]["extractionHa"], 2),
                "afforestationHa": round(nat_phase_ha[ph]["afforestationHa"], 2),
                "nitrogenT": round(nat_phase_ha[ph]["nitrogenT"], 2),
                "count": int(nat_phase_ha[ph]["count"]),
                "sharePct": round(
                    (
                        nat_phase_ha[ph]["extractionHa"] + nat_phase_ha[ph]["afforestationHa"]
                    )
                    / nat_total_ha
                    * 100,
                    2,
                )
                if nat_total_ha > 0
                else 0.0,
            }
            for ph in (*RANKING_PHASES, "sketch")
        },
    }

    payload = {
        "metadata": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "methodVersion": METHOD_VERSION,
            "rankingPhases": list(RANKING_PHASES),
            "ansvarBasis": "dce30PctOfNational",
            "sources": [
                str(DASHBOARD_SUMMARY.relative_to(REPO)),
                str(B1_PATH.relative_to(REPO)),
                str(B2_PATH.relative_to(REPO)),
                str(B3_PATH.relative_to(REPO)),
            ],
            "disclaimer": (
                "Der findes ingen officiel kommunal fordeling af naturmålet. "
                "Ranglisten bruger naturpotentiale (DCE 30 %) som fagligt stand-in for ansvar — "
                "ikke en politisk forpligtelse. Standardvisning: kun anlagt (established). "
                "Skov-levering inkluderer MARS + Klimaskovfonden + Naturstyrelsen. Skitser tæller ikke med."
            ),
        },
        "national": national,
        "byKommune": {row["kode"]: row for row in rows},
        "kommuner": rows,
    }

    if len(rows) != 98:
        print(f"WARNING: expected 98 ranking rows, got {len(rows)}")

    write_json_both("kommune-ranking.json", payload)
    return {"kommuner": len(rows)}


def main() -> int:
    t0 = time.time()
    records = build()
    duration = time.time() - t0
    log_etl_run(
        source="kommune-ranking",
        endpoints=["dashboard-summary", "b1", "b2", "b3"],
        records={k: int(v) for k, v in records.items()},
        status="ok",
        notes="Sprint 6 kommune competition ranking",
        duration_seconds=duration,
    )
    print(f"✓ Kommune ranking built ({records['kommuner']} kommuner) in {duration:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
