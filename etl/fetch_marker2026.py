#!/usr/bin/env python3
"""
Fetch Markkort 2026 field polygons per municipality bbox.

The national Marker:Marker_2026 layer has ~578k features and should not be
downloaded as one giant file. This fetcher queries the FVM GeoServer once per
municipality bbox, stores one GeoJSON file per municipality, and can safely be
rerun because existing files are treated as cache unless `--force` is passed.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import _wfs
from etl_log import log_etl_run

try:
    import geopandas as gpd
except ImportError as exc:  # pragma: no cover - user-facing failure path
    raise SystemExit(
        "Missing optional spatial dependencies. Run: mise run setup-spatial"
    ) from exc

REPO = SCRIPT_DIR.parent
WFS_BASE = "https://geodata.fvm.dk/geoserver/ows"
LAYER = "Marker:Marker_2026"
SRS = "urn:ogc:def:crs:EPSG::4326"
MUNICIPALITIES = REPO / "data" / "dawa" / "kommuner.geojson"
OUT = REPO / "data" / "markkort" / "marker-2026"
SUMMARY = REPO / "data" / "markkort" / "marker-2026-summary.json"
MAX_WORKERS = 8
REQUEST_TIMEOUT_SECONDS = 180
EXCLUDED_DAWA_CODES = {"0411"}  # Christiansø is returned by DAWA but is not one of the 98 municipalities.


def load_municipality_bboxes() -> list[dict[str, Any]]:
    """
    Load municipality polygons and return WGS84 bboxes.

    @returns List of dicts with `kode`, `navn`, and `bbox`
    @example load_municipality_bboxes()[0]["bbox"]
    """

    if not MUNICIPALITIES.exists():
        raise FileNotFoundError(f"{MUNICIPALITIES} not found. Run etl/fetch_dawa.py first.")
    gdf = gpd.read_file(MUNICIPALITIES)
    if gdf.crs is None:
        # DAWA kommune boundaries are stored in Danish UTM in this repo.
        gdf = gdf.set_crs("EPSG:25832")
    gdf = gdf.to_crs("EPSG:4326")

    rows: list[dict[str, Any]] = []
    for _, row in gdf.iterrows():
        kode = str(row.get("kode") or row.get("kommunekode") or "").zfill(4)
        navn = str(row.get("navn") or row.get("kommunenavn") or kode)
        if not kode or kode in EXCLUDED_DAWA_CODES:
            continue
        minx, miny, maxx, maxy = row.geometry.bounds
        rows.append({"kode": kode, "navn": navn, "bbox": (minx, miny, maxx, maxy)})
    rows.sort(key=lambda r: r["kode"])
    if len(rows) != 98:
        print(f"WARNING: expected 98 municipalities, loaded {len(rows)}")
    return rows


def build_wfs_url(bbox: tuple[float, float, float, float]) -> str:
    """
    Build a WFS 2.0 GeoJSON URL for Marker_2026 limited to one bbox.

    @param bbox - `(minx, miny, maxx, maxy)` in EPSG:4326
    @returns Fully encoded WFS URL
    @example build_wfs_url((9.0, 55.0, 10.0, 56.0))
    """

    bbox_param = ",".join(f"{v:.8f}" for v in bbox) + ",EPSG:4326"
    query = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": LAYER,
        "outputFormat": "application/json",
        "srsName": SRS,
        "bbox": bbox_param,
    }
    return WFS_BASE + "?" + urllib.parse.urlencode(query, safe=":,")


def slim_feature(feature: dict[str, Any]) -> dict[str, Any]:
    """
    Keep geometry and a minimal property set to reduce committed data size.

    @param feature - Raw GeoServer feature
    @returns Slim GeoJSON feature used by downstream overlay code
    @example slim_feature(raw_feature)["properties"]["sourceId"]
    """

    props = feature.get("properties") or {}
    return {
        "type": "Feature",
        "id": feature.get("id"),
        "geometry": feature.get("geometry"),
        "properties": {
            "sourceId": feature.get("id") or props.get("id"),
            "marknummer": props.get("marknummer") or props.get("MARKNR") or props.get("marknr"),
            "area_ha_estimate": _wfs.feature_area_ha(feature),
        },
    }


def fetch_one(entry: dict[str, Any], *, force: bool) -> dict[str, Any]:
    """
    Fetch one municipality bbox and write it to disk.

    @param entry - Municipality metadata from `load_municipality_bboxes`
    @param force - Whether to refetch when the output file already exists
    @returns Summary row for the municipality
    @example fetch_one({"kode": "0851", "navn": "Aalborg", "bbox": (...)}, force=False)
    """

    kode = entry["kode"]
    out_path = OUT / f"{kode}.geojson"
    if out_path.exists() and not force:
        with open(out_path, encoding="utf-8") as f:
            cached = json.load(f)
        return {
            "kode": kode,
            "navn": entry["navn"],
            "status": "cached",
            "features": len(cached.get("features", [])),
            "bytes": out_path.stat().st_size,
        }

    url = build_wfs_url(entry["bbox"])
    raw = _wfs.http_get(url, timeout=REQUEST_TIMEOUT_SECONDS)
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("iso-8859-1", errors="replace")
    fc = json.loads(text)
    if fc.get("type") != "FeatureCollection":
        raise RuntimeError(f"{kode}: unexpected response type {fc.get('type')}")
    _wfs.assert_dk_wgs84_feature_collection(fc)
    features = [slim_feature(f) for f in fc.get("features", []) if f.get("geometry")]
    out = {
        "type": "FeatureCollection",
        "metadata": {
            "kommuneKode": kode,
            "kommuneNavn": entry["navn"],
            "source": WFS_BASE,
            "layer": LAYER,
            "bbox": list(entry["bbox"]),
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
        },
        "features": features,
    }
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return {
        "kode": kode,
        "navn": entry["navn"],
        "status": "fetched",
        "features": len(features),
        "bytes": out_path.stat().st_size,
    }


def main(argv: list[str] | None = None) -> int:
    """
    CLI entrypoint for Markkort 2026 municipality bbox fetch.

    @param argv - Optional CLI argv for tests
    @returns Process exit code
    @example main(["--force", "--workers", "4"])
    """

    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Refetch even if per-kommune file exists")
    parser.add_argument("--workers", type=int, default=MAX_WORKERS, help="Parallel WFS requests")
    args = parser.parse_args(argv)

    t0 = time.time()
    OUT.mkdir(parents=True, exist_ok=True)
    municipalities = load_municipality_bboxes()
    print(f"Marker_2026 WFS fetch: {len(municipalities)} municipality bboxes, workers={args.workers}")

    rows: list[dict[str, Any]] = []
    errors: list[str] = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(fetch_one, entry, force=args.force): entry for entry in municipalities}
        for future in as_completed(futures):
            entry = futures[future]
            try:
                row = future.result()
                rows.append(row)
                print(f"  {row['kode']} {row['status']}: {row['features']:,} features")
            except Exception as exc:  # pragma: no cover - network failure path
                msg = f"{entry['kode']} {entry['navn']}: {exc}"
                errors.append(msg)
                print(f"  ERROR {msg}")

    rows.sort(key=lambda r: r["kode"])
    duration = time.time() - t0
    summary = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "source": WFS_BASE,
        "layer": LAYER,
        "municipalities": len(rows),
        "featureSum": sum(int(r["features"]) for r in rows),
        "bytes": sum(int(r["bytes"]) for r in rows),
        "durationSeconds": round(duration, 1),
        "workers": args.workers,
        "errors": errors,
        "byKommune": rows,
    }
    SUMMARY.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    log_etl_run(
        source="markkort-marker-2026",
        endpoints=[WFS_BASE],
        records={"municipalities": len(rows), "features_bbox_sum": summary["featureSum"]},
        status="ok" if not errors else "partial",
        notes=f"Marker_2026 per-kommune bbox fetch ({len(errors)} errors)",
        duration_seconds=duration,
    )
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
