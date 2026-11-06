#!/usr/bin/env python3
"""
Fetch §3 protected nature polygons per municipality bbox.

The national `natur:ais_par3` layer has ~186k features — too large to hold in
memory. This fetcher queries MiljøGIS WFS once per DAWA municipality bbox
(same pattern as fetch_marker2026.py) and stores one GeoJSON per kommune under
`data/section3/by-kommune/<kode>.geojson`.
"""
from __future__ import annotations

import argparse
import hashlib
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
WFS_BASE = "https://wfs2-miljoegis.mim.dk/natur/ows"
LAYER = "natur:ais_par3"
SRS = "urn:ogc:def:crs:EPSG::4326"
MUNICIPALITIES = REPO / "data" / "dawa" / "kommuner.geojson"
OUT = REPO / "data" / "section3" / "by-kommune"
SUMMARY = REPO / "data" / "section3" / "by-kommune-summary.json"
MAX_WORKERS = 6
REQUEST_TIMEOUT_SECONDS = 180
EXCLUDED_DAWA_CODES = {"0411"}


def file_hash(path: Path) -> str:
    """Return first 16 hex chars of SHA256 for cache invalidation."""

    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def load_municipality_bboxes() -> list[dict[str, Any]]:
    """
    Load municipality polygons and return WGS84 bboxes.

    @returns List of dicts with `kode`, `navn`, and `bbox`
    """

    if not MUNICIPALITIES.exists():
        raise FileNotFoundError(f"{MUNICIPALITIES} not found. Run etl/fetch_dawa.py first.")
    gdf = gpd.read_file(MUNICIPALITIES)
    if gdf.crs is None:
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
    """Build a WFS 2.0 GeoJSON URL for ais_par3 limited to one bbox."""

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
    """Keep geometry and minimal §3 properties."""

    props = feature.get("properties") or {}
    return {
        "type": "Feature",
        "id": feature.get("id"),
        "geometry": feature.get("geometry"),
        "properties": {
            "sourceId": feature.get("id") or props.get("id"),
            "a_type": props.get("a_type"),
            "hectares": props.get("hectares") or props.get("area"),
        },
    }


def fetch_one(entry: dict[str, Any], *, force: bool) -> dict[str, Any]:
    """
    Fetch one municipality bbox and write it to disk.

    @param entry - Municipality metadata from `load_municipality_bboxes`
    @param force - Whether to refetch when the output file already exists
    @returns Summary row for the municipality
    """

    kode = entry["kode"]
    out_path = OUT / f"{kode}.geojson"
    if out_path.exists() and not force:
        return {
            "kode": kode,
            "navn": entry["navn"],
            "status": "cached",
            "features": len(json.loads(out_path.read_text(encoding="utf-8")).get("features", [])),
            "bytes": out_path.stat().st_size,
            "hash": file_hash(out_path),
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
        "hash": file_hash(out_path),
    }


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint for §3 per-kommune bbox fetch."""

    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Refetch even if per-kommune file exists")
    parser.add_argument("--workers", type=int, default=MAX_WORKERS, help="Parallel WFS requests")
    args = parser.parse_args(argv)

    t0 = time.time()
    OUT.mkdir(parents=True, exist_ok=True)
    municipalities = load_municipality_bboxes()
    print(f"§3 ais_par3 WFS fetch: {len(municipalities)} municipality bboxes, workers={args.workers}")

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
    manifest_hash = hashlib.sha256(
        json.dumps([(r["kode"], r.get("hash", "")) for r in rows], sort_keys=True).encode()
    ).hexdigest()[:16]
    summary = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "source": WFS_BASE,
        "layer": LAYER,
        "manifestHash": manifest_hash,
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
        source="section3-by-kommune",
        endpoints=[WFS_BASE],
        records={"municipalities": len(rows), "features_bbox_sum": summary["featureSum"]},
        status="ok" if not errors else "partial",
        notes=f"§3 ais_par3 per-kommune bbox fetch ({len(errors)} errors)",
        duration_seconds=duration,
    )
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
