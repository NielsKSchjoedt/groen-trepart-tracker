#!/usr/bin/env python3
"""
Fetch DCE 30% + KU priority polygons from Arealdata GeoServer (WFS 2.0 GeoJSON).

Raw output under data/arealdata-biodiversitet/ (not served to the browser).
Set FULL_DCE=1 for full 83k DCE download (~40 MB, minutes). Default skips heavy D1 file.
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import _wfs
from etl_log import log_etl_run

WFS_BASE = "https://arld-extgeo.miljoeportal.dk/geoserver/ows"
SRS = "urn:ogc:def:crs:EPSG::4326"
PAGE_SIZE = int(os.environ.get("BIODIV_PAGE_SIZE", "2000"))

# Layer names (verified 2026-04 against GetCapabilities)
D1 = "dn:arealreservation_20220928"
KU1 = "ku:ku_239omr_cmec2024_2_1"
KU2 = "ku:ku_239omr_cmec2024_2_2"

REPO = SCRIPT_DIR.parent
OUT = REPO / "data" / "arealdata-biodiversitet"
MAX_DCE_MB = 60.0
FULL_DCE = os.environ.get("FULL_DCE", "0") == "1"


def _slim_d1_feature(f: dict) -> dict:
    p = f.get("properties") or {}
    ha = _wfs.feature_area_ha(f)
    return {
        "type": "Feature",
        "geometry": f.get("geometry"),
        "properties": {
            "id": p.get("cNavn"),
            "pri": p.get("prioritet"),
            "area_ha": round(ha, 4),
        },
    }


def _slim_ku_feature(f: dict) -> dict:
    p = f.get("properties") or {}
    return {
        "type": "Feature",
        "geometry": f.get("geometry"),
        "properties": {
            "omrId": p.get("OmrID_CMEC"),
            "nr": p.get("Omraade_nr"),
            "areal_ha": p.get("Areal_ha"),
            "pot_nat_ha": p.get("Pot_nat_ha"),
            "landsdel": p.get("Landsdel"),
            "prioritet": p.get("Prioritet"),
        },
    }


def _write_layer_file(path: Path, type_name: str, sort_by: str, slim) -> int:
    def it():
        first = True
        for page in _wfs.wfs_paginate_geojson_pages(
            WFS_BASE, type_name, page_size=PAGE_SIZE, sort_by=sort_by, srs=SRS
        ):
            if first:
                _wfs.assert_dk_wgs84_feature_collection(page)
                first = False
            for raw in page.get("features", []):
                yield slim(raw)

    return _wfs.write_geojson_feature_collection_streaming(str(path), it())


def main() -> int:
    t0 = time.time()
    OUT.mkdir(parents=True, exist_ok=True)
    summary: dict = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "wfsBase": WFS_BASE,
        "layers": {},
        "fullDce": FULL_DCE,
    }

    hits_d1 = _wfs.wfs_hits_count(WFS_BASE, D1, SRS)
    hits_k1 = _wfs.wfs_hits_count(WFS_BASE, KU1, SRS)
    hits_k2 = _wfs.wfs_hits_count(WFS_BASE, KU2, SRS)
    summary["layers"]["d1_hits"] = {"typeName": D1, "numberMatched": hits_d1}
    summary["layers"]["ku_prio_1_hits"] = {"typeName": KU1, "numberMatched": hits_k1}
    summary["layers"]["ku_prio_2_hits"] = {"typeName": KU2, "numberMatched": hits_k2}

    dce_path = OUT / "dce-30-percent.geojson"
    if FULL_DCE:
        n = _write_layer_file(dce_path, D1, "cNavn", _slim_d1_feature)
        mb = dce_path.stat().st_size / (1024 * 1024)
        if mb > MAX_DCE_MB:
            raise SystemExit(
                f"dce-30-percent.geojson too large: {mb:.1f} MB (limit {MAX_DCE_MB} MB)"
            )
        summary["layers"]["d1_fetched"] = n
    else:
        summary["layers"]["d1_fetched"] = 0
        summary["note_dce"] = "FULL_DCE=0: skipped file write; use hits count for audit. Set FULL_DCE=1 in scheduled job to materialise."

    n1 = _write_layer_file(OUT / "ku-prio-1.geojson", KU1, "OmrID_CMEC", _slim_ku_feature)
    n2 = _write_layer_file(OUT / "ku-prio-2.geojson", KU2, "OmrID_CMEC", _slim_ku_feature)
    summary["layers"]["ku_prio_1_fetched"] = n1
    summary["layers"]["ku_prio_2_fetched"] = n2

    (OUT / "summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    duration = time.time() - t0
    log_etl_run(
        source="arealdata-biodiversitet",
        endpoints=[WFS_BASE],
        records={
            "dce_hits": hits_d1,
            "dce_fetched": summary["layers"].get("d1_fetched", 0),
            "ku1": n1,
            "ku2": n2,
        },
        status="ok",
        notes=f"Arealdata WFS. FULL_DCE={FULL_DCE}. KU+ audit.",
        duration_seconds=duration,
    )
    print(f"✓ Wrote {OUT} in {duration:.1f}s (DCE file: {'yes' if FULL_DCE else 'skipped'})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
