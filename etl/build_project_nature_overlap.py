#!/usr/bin/env python3
"""
Build per-project nature-overlap, attributed to municipality (no double-count).

For every MARS project polygon we compute how much of the project area overlaps
mapped nature — the DCE 30 % biodiversity/nature-potential map (headline), plus
§3-protected nature and Natura 2000 as context. Each project polygon is first
CLIPPED to municipality boundaries, so a project crossing a kommune border is
split and each piece is attributed to the correct kommune — the same project is
never counted twice.

Headline metric = overlap with the DCE 30 % biodiversity map ("naturpotentiale").

IMPORTANT (honesty): a spatial overlap is NOT proof that nature was created or
improved — it is a strong indicator that the project is sited where it CAN
benefit nature. The UI must say so.

This is a heavy GIS build (GeoPandas/Shapely/Rtree, see requirements-spatial.txt)
and belongs in the monthly spatial-overlay workflow alongside
`build_kommune_benchmark.py`.

Usage:
  python3 build_project_nature_overlap.py [--limit N] [--no-section3]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

try:
    import geopandas as gpd
    from rtree import index
    from shapely import make_valid
    from shapely.geometry import Polygon
    from shapely.geometry.base import BaseGeometry
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Missing spatial deps. Run: mise run setup-spatial") from exc

from spatial_overlay import METRIC_CRS, DEFAULT_SOURCE_CRS, SpatialIndex, iter_kommuner_geojson


def repair_geometry(geom: BaseGeometry) -> BaseGeometry:
    """Robust geometry repair: make_valid → buffer(0) → original, never raises."""
    if geom is None or geom.is_empty or geom.is_valid:
        return geom
    try:
        fixed = make_valid(geom)
        if not fixed.is_empty:
            return fixed
    except Exception:
        pass
    try:
        fixed = geom.buffer(0)
        if not fixed.is_empty:
            return fixed
    except Exception:
        pass
    return geom

REPO = SCRIPT_DIR.parent
PROJECT_GEOMS = REPO / "public" / "data" / "project-geometries.json"
PROJECTS = REPO / "data" / "mars" / "projects.json"
MASTER_DATA = REPO / "data" / "mars" / "master-data.json"
KOMMUNER_PATH = REPO / "data" / "dawa" / "kommuner.geojson"
DCE_PATH = REPO / "data" / "arealdata-biodiversitet" / "dce-30-percent.geojson"
N2000_PATH = REPO / "data" / "natura2000" / "natura_2000_omraader.geojson"
SECTION3_DIR = REPO / "data" / "section3" / "by-kommune"
OUT = REPO / "data" / "project-nature-overlap.json"
PUBLIC_OUT = REPO / "public" / "data" / "project-nature-overlap.json"

METHOD_VERSION = "project-overlap-v1"
EXCLUDED_DAWA_CODES = {"0411"}  # Christiansø


def load_measure_names() -> dict[str, str]:
    """Map mitigationMeasureId → human name from MARS master-data."""
    out: dict[str, str] = {}

    def walk(o: Any) -> Any:
        if isinstance(o, dict):
            if o.get("name") and (o.get("id") or o.get("mitigationMeasureId")):
                out[str(o.get("id") or o.get("mitigationMeasureId"))] = o["name"]
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for it in o:
                walk(it)

    try:
        walk(json.loads(MASTER_DATA.read_text(encoding="utf-8")))
    except FileNotFoundError:
        pass
    return out


def load_projects() -> dict[str, dict[str, Any]]:
    """geoLocationId → project metadata (only real MARS projects)."""
    raw = json.loads(PROJECTS.read_text(encoding="utf-8"))
    projs = raw if isinstance(raw, list) else raw.get("projects") or raw.get("data") or []
    measures = load_measure_names()
    by_geo: dict[str, dict[str, Any]] = {}
    for p in projs:
        geo = p.get("geoLocationId")
        if not geo:
            continue
        by_geo[geo] = {
            "projectId": p.get("projectId"),
            "projectName": p.get("projectName") or "Unavngivet projekt",
            "status": p.get("projectStatus"),
            "measure": measures.get(str(p.get("mitigationMeasureId")), "Øvrige"),
            "nitrogenT": p.get("nitrogenReductionT") or 0,
            "extractionHa": p.get("extractionEffortHa") or 0,
            "afforestationHa": p.get("afforestationEffortHa") or 0,
        }
    return by_geo


def build_project_metric_geoms(geo_ids: list[str]) -> dict[str, BaseGeometry]:
    """Load project rings (WGS84) and project them to EPSG:25832 in one batch."""
    rings = json.loads(PROJECT_GEOMS.read_text(encoding="utf-8"))
    valid_ids: list[str] = []
    polys: list[BaseGeometry] = []
    for gid in geo_ids:
        ring = rings.get(gid)
        if not ring or len(ring) < 3:
            continue
        try:
            poly = repair_geometry(Polygon(ring))
        except (ValueError, TypeError):
            continue
        if poly.is_empty:
            continue
        valid_ids.append(gid)
        polys.append(poly)
    if not polys:
        return {}
    metric = gpd.GeoSeries(polys, crs=DEFAULT_SOURCE_CRS).to_crs(METRIC_CRS)
    return {gid: repair_geometry(g) for gid, g in zip(valid_ids, metric)}


def build_kommune_index() -> tuple[index.Index, list[dict[str, Any]]]:
    """R-tree over municipality geometries for clipping/attribution.

    `data/dawa/kommuner.geojson` is already in EPSG:25832 (metric), so the
    geometries are used as-is — no reprojection.
    """
    feats = [k for k in iter_kommuner_geojson(KOMMUNER_PATH) if k.kode not in EXCLUDED_DAWA_CODES]
    rows = [
        {"kode": f.kode, "navn": f.navn, "geom": repair_geometry(f.geometry)}
        for f in feats
    ]
    idx = index.Index()
    for i, r in enumerate(rows):
        g = r["geom"]
        if g is None or g.is_empty:
            continue
        idx.insert(i, g.bounds)
    return idx, rows


_section3_cache: dict[str, SpatialIndex | None] = {}


def section3_index(kode: str) -> SpatialIndex | None:
    """Lazily load a municipality's §3 layer (chunked per kommune)."""
    if kode in _section3_cache:
        return _section3_cache[kode]
    path = SECTION3_DIR / f"{kode}.geojson"
    if not path.exists():
        _section3_cache[kode] = None
        return None
    try:
        _section3_cache[kode] = SpatialIndex.from_geojson(path, name=f"s3_{kode}")
    except Exception:  # pragma: no cover
        _section3_cache[kode] = None
    return _section3_cache[kode]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="Only process the first N projects (debug)")
    ap.add_argument("--no-section3", action="store_true", help="Skip §3 overlap (faster debug)")
    args = ap.parse_args()

    t0 = time.time()
    projects = load_projects()
    geo_ids = list(projects.keys())
    if args.limit:
        geo_ids = geo_ids[: args.limit]
    print(f"Loading geometries for {len(geo_ids)} projects…")
    geoms = build_project_metric_geoms(geo_ids)
    print(f"  {len(geoms)} projects have a usable polygon")

    print("Building kommune index…")
    kidx, krows = build_kommune_index()

    print("Loading nature layers (DCE 30 %, Natura 2000)…")
    dce = SpatialIndex.from_geojson(DCE_PATH, name="dce_30")
    n2000 = SpatialIndex.from_geojson(N2000_PATH, name="natura2000")

    by_project: dict[str, Any] = {}
    by_kommune: dict[str, dict[str, float]] = {}

    def acc_kommune(kode: str, navn: str, **vals: float) -> None:
        d = by_kommune.setdefault(
            kode,
            {"kommuneNavn": navn, "projektAreaHa": 0.0, "biodiversitetHa": 0.0,
             "section3Ha": 0.0, "natura2000Ha": 0.0, "antalProjekter": 0},
        )
        for k, v in vals.items():
            d[k] = round(d.get(k, 0.0) + v, 4)

    seen_kommune_project: set[tuple[str, str]] = set()
    n = 0
    for gid, pmeta in projects.items():
        pg = geoms.get(gid)
        if pg is None:
            continue
        n += 1
        if n % 200 == 0:
            print(f"  …{n} projects processed ({time.time() - t0:.0f}s)")
        project_area = pg.area / 10_000
        per_kommune: list[dict[str, Any]] = []
        # Clip the project polygon to each municipality it touches.
        for i in kidx.intersection(pg.bounds):
            krow = krows[i]
            piece = repair_geometry(pg.intersection(krow["geom"]))
            if piece.is_empty:
                continue
            piece_ha = piece.area / 10_000
            if piece_ha < 1e-4:
                continue
            bio = dce.intersect_area_metric(piece)["totalHa"]
            n2k = n2000.intersect_area_metric(piece)["totalHa"]
            s3 = 0.0
            if not args.no_section3:
                s3idx = section3_index(krow["kode"])
                if s3idx is not None:
                    s3 = s3idx.intersect_area_metric(piece)["totalHa"]
            per_kommune.append({
                "kode": krow["kode"],
                "kommuneNavn": krow["navn"],
                "projektAreaHa": round(piece_ha, 4),
                "biodiversitetHa": round(bio, 4),
                "section3Ha": round(s3, 4),
                "natura2000Ha": round(n2k, 4),
            })
            first = (krow["kode"], gid) not in seen_kommune_project
            seen_kommune_project.add((krow["kode"], gid))
            acc_kommune(
                krow["kode"], krow["navn"],
                projektAreaHa=piece_ha, biodiversitetHa=bio, section3Ha=s3, natura2000Ha=n2k,
                antalProjekter=1 if first else 0,
            )
        if not per_kommune:
            continue
        # Primary kommune = the one holding the largest share of the project area.
        primary = max(per_kommune, key=lambda x: x["projektAreaHa"])
        by_project[gid] = {
            "geoId": gid,
            "projectId": pmeta["projectId"],
            "projectName": pmeta["projectName"],
            "measure": pmeta["measure"],
            "status": pmeta["status"],
            "projektAreaHa": round(project_area, 4),
            "primaryKommuneKode": primary["kode"],
            "biodiversitetHa": round(sum(p["biodiversitetHa"] for p in per_kommune), 4),
            "section3Ha": round(sum(p["section3Ha"] for p in per_kommune), 4),
            "natura2000Ha": round(sum(p["natura2000Ha"] for p in per_kommune), 4),
            "perKommune": per_kommune,
        }

    for d in by_kommune.values():
        d["projektAreaHa"] = round(d["projektAreaHa"], 2)
        d["biodiversitetHa"] = round(d["biodiversitetHa"], 2)
        d["section3Ha"] = round(d["section3Ha"], 2)
        d["natura2000Ha"] = round(d["natura2000Ha"], 2)

    payload = {
        "metadata": {
            "methodVersion": METHOD_VERSION,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "headline": "biodiversitetHa = projektareal-overlap med DCE 30 % biodiversitetskort",
            "note": ("Overlap er en stærk indikator for naturpotentiale, IKKE en garanti for "
                     "realiseret eller forbedret natur. Projekter er klippet til kommunegrænser, "
                     "så areal ikke dobbelttælles på tværs af kommuner."),
            "projectsWithGeometry": len(geoms),
            "projectsWithOverlap": len(by_project),
            "sources": ["MARS project geometries", "DCE 30 % (Arealdata)", "Natura 2000", "§3 (Miljøportal)"],
        },
        "byProject": by_project,
        "byKommune": by_kommune,
    }

    for path in (OUT, PUBLIC_OUT):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"✓ Done in {time.time() - t0:.0f}s — {len(by_project)} projects with overlap, "
          f"{len(by_kommune)} kommuner. Wrote {OUT.relative_to(REPO)}")


if __name__ == "__main__":
    main()
