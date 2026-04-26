#!/usr/bin/env python3
"""
FVM Markkort: Vand_Natur_og_Skovprojekter_2026 — WFS GeoJSON → public/data + summary.

MARS count check only: no spatial join in stdlib.
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import _wfs
from etl_log import log_etl_run

FVM_WFS = "https://geodata.fvm.dk/geoserver/ows"
VNS = "GB_og_bioordninger:Vand_Natur_og_Skovprojekter_2026"
REPO = SCRIPT_DIR.parent
DATA_MARK = REPO / "data" / "markkort"
PUBLIC = REPO / "public" / "data"


def _load_kommune_centers() -> list[dict[str, Any]]:
    p = REPO / "data" / "dawa" / "kommuner.json"
    raw = json.loads(p.read_text(encoding="utf-8"))
    out = []
    for k in raw:
        kode = k.get("kode", "")
        if kode == "0411":  # Christiansø
            continue
        navn = k.get("navn", "")
        vc = k.get("visueltcenter")
        if not kode or not isinstance(vc, list) or len(vc) < 2:
            continue
        out.append(
            {
                "kode": kode,
                "navn": navn,
                "lon": float(vc[0]),
                "lat": float(vc[1]),
                "bbox": k.get("bbox") or [],
            }
        )
    return out


def _centroid(feat: dict) -> tuple[float, float] | None:
    g = feat.get("geometry")
    if not g:
        return None
    coords = g.get("coordinates")
    if g.get("type") == "Polygon" and coords:
        ring = coords[0]
    elif g.get("type") == "MultiPolygon" and coords and coords[0]:
        ring = coords[0][0]
    else:
        return None
    if not ring:
        return None
    xs = [p[0] for p in ring if len(p) >= 2]
    ys = [p[1] for p in ring if len(p) >= 2]
    if not xs:
        return None
    return (sum(xs) / len(xs), sum(ys) / len(ys))


def _point_in_bbox(lon: float, lat: float, bbox: list) -> bool:
    if not bbox or len(bbox) < 4:
        return False
    minx, miny, maxx, maxy = map(float, bbox[:4])
    return minx <= lon <= maxx and miny <= lat <= maxy


def _assign_kommune(lon: float, lat: float, kommuner: list[dict]) -> str:
    inside = [k for k in kommuner if _point_in_bbox(lon, lat, k["bbox"])]
    if len(inside) == 1:
        return inside[0]["kode"]
    if len(inside) > 1:
        # pick smallest bbox area (crude)
        def area(b):
            if len(b) < 4:
                return 1e9
            return (float(b[2]) - float(b[0])) * (float(b[3]) - float(b[1]))

        inside.sort(key=lambda k: area(k["bbox"]))
        return inside[0]["kode"]
    best, bd = None, 1e9
    for k in kommuner:
        d = (lon - k["lon"]) ** 2 + (lat - k["lat"]) ** 2
        if d < bd:
            bd, best = d, k
    return best["kode"] if best else "0000"


def _slim_vns(f: dict) -> dict:
    p = f.get("properties") or {}
    return {
        "type": "Feature",
        "geometry": f.get("geometry"),
        "properties": {
            "proj": p.get("Projekt", "")[:200],
            "ha": p.get("IMK_areal"),
            "tag": p.get("TAG"),
            "dir": p.get("Direktiv"),
            "y0": p.get("Startaar"),
            "y1": p.get("Slutaar"),
        },
    }


def _mars_project_count() -> int:
    try:
        p = REPO / "data" / "mars" / "projects.json"
        return len(json.loads(p.read_text(encoding="utf-8")))
    except Exception:
        return 0


def main() -> int:
    t0 = time.time()
    DATA_MARK.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    hits = _wfs.wfs_hits_count(FVM_WFS, VNS, "urn:ogc:def:crs:EPSG::4326")
    print(f"  VNS hits: {hits}")

    # Single-shot GeoJSON (fits in memory ~5–15 MB)
    q = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": VNS,
        "outputFormat": "application/json",
        "srsName": "urn:ogc:def:crs:EPSG::4326",
    }
    url = FVM_WFS + "?" + urllib.parse.urlencode(q, safe=":")
    rawb = _wfs.http_get(url)
    try:
        text = rawb.decode("utf-8")
    except UnicodeDecodeError:
        text = rawb.decode("iso-8859-1", errors="replace")
    fc: dict = json.loads(text)
    if fc.get("type") != "FeatureCollection":
        raise SystemExit("Unexpected response")
    _wfs.assert_dk_wgs84_feature_collection(fc)
    feats = fc.get("features") or []
    if len(feats) != hits:
        print(f"⚠ feature count {len(feats)} != hits {hits} (tolerance not enforced)")

    raw_path = DATA_MARK / "vand-natur-skov-projekter-2026.geojson"
    raw_path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": feats,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    slim_feats = [_slim_vns(f) for f in feats]
    slim = {"type": "FeatureCollection", "features": slim_feats}
    vjson = PUBLIC / "vand-natur-skov-projekter-2026.geojson"
    vjson.write_text(json.dumps(slim, ensure_ascii=False), encoding="utf-8")

    kommuner = _load_kommune_centers()
    counts: Counter = Counter()
    for f in feats:
        c = _centroid(f)
        if c:
            counts[_assign_kommune(c[0], c[1], kommuner)] += 1
        else:
            counts["0000"] += 1
    by_k = {k: v for k, v in sorted(counts.items(), key=lambda x: -x[1]) if v > 0}
    mc = _mars_project_count()
    summ = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "wfs": FVM_WFS,
        "typeName": VNS,
        "featureCount": len(feats),
        "hits": hits,
        "kommuneCounts": by_k,
        "countCheck": {
            "marsFormalProjects": mc,
            "vnsPolygons": len(feats),
            "note": "Ingen rumlig overlap beregnet i stdlib-ETL; refereres i Sprint 4 (geopandas).",
        },
    }
    (PUBLIC / "vand-natur-skov-projekter-2026-summary.json").write_text(
        json.dumps(summ, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    duration = time.time() - t0
    log_etl_run(
        source="fvm-markkort-vns",
        endpoints=[url[:200]],
        records={"vns": len(feats), "municipalities_tagged": len(by_k)},
        status="ok",
        notes="Vand_Natur_og_Skovprojekter_2026 slim → public + summary",
        duration_seconds=duration,
    )
    print(f"✓ VNS: {len(feats)} features → {vjson.name} ({duration:.1f}s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
