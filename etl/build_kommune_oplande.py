#!/usr/bin/env python3
"""
Build Sprint 6 kommune × water-catchment overlap (coastal + hovedoplande).

Output: kommune-oplande.json (data/ + public/data/kommune-benchmark/)
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

try:
    import geopandas as gpd
    from shapely.geometry import shape
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Run: mise run setup-spatial") from exc

from etl_log import log_etl_run
from spatial_overlay import DEFAULT_SOURCE_CRS, METRIC_CRS, SpatialIndex, repair_geometry

KOMMUNER_PATH = REPO / "data" / "dawa" / "kommuner.geojson"
COASTAL_PATH = REPO / "data" / "geo" / "coastal-waters-4326.geojson"
CATCHMENTS_PATH = REPO / "data" / "geo" / "catchments-4326.geojson"
COASTAL_STATUS_PATH = REPO / "public" / "data" / "coastal-water-status.json"
OUT_DIR = REPO / "data" / "kommune-benchmark"
PUBLIC_OUT_DIR = REPO / "public" / "data" / "kommune-benchmark"
METHOD_VERSION = "sprint6-v1"
EXCLUDED_KODER = {"0411"}


def write_json_both(relative_name: str, data: dict[str, Any]) -> None:
    for base in (OUT_DIR, PUBLIC_OUT_DIR):
        base.mkdir(parents=True, exist_ok=True)
        (base / relative_name).write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )


def load_eco_status() -> dict[str, str]:
    if not COASTAL_STATUS_PATH.exists():
        return {}
    payload = json.loads(COASTAL_STATUS_PATH.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for name, entry in payload.get("waters", {}).items():
        eco = entry.get("ecologicalStatus")
        if eco:
            out[name.strip()] = eco
    return out


def overlap_rows(
    kommune_metric,
    layer_index: SpatialIndex,
    id_field: str,
    name_field: str,
    kommune_area_ha: float,
    layer_areas: dict[str, float],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for idx in layer_index.gdf.index:
        feat = layer_index.gdf.loc[idx]
        op_id = str(feat.get(id_field, idx))
        op_navn = str(feat.get(name_field, op_id)).strip()
        feat_geom = feat.geometry
        inter = repair_geometry(kommune_metric.intersection(feat_geom))
        if inter.is_empty:
            continue
        overlap_ha = inter.area / 10_000
        if overlap_ha < 0.01:
            continue
        layer_ha = layer_areas.get(op_id, feat_geom.area / 10_000) or overlap_ha
        rows.append({
            "opId": op_id,
            "opNavn": op_navn,
            "overlapHa": round(overlap_ha, 2),
            "andelAfKommunePct": round(overlap_ha / kommune_area_ha * 100, 2) if kommune_area_ha > 0 else 0,
            "andelAfOplandPct": round(overlap_ha / layer_ha * 100, 2) if layer_ha > 0 else 0,
        })
    return rows


def build() -> dict[str, int]:
    for path in (KOMMUNER_PATH, COASTAL_PATH, CATCHMENTS_PATH):
        if not path.exists():
            raise SystemExit(f"Missing {path}")

    kommuner = gpd.read_file(KOMMUNER_PATH)
    if kommuner.crs is None:
        kommuner = kommuner.set_crs("EPSG:25832")
    kommuner = kommuner.to_crs(DEFAULT_SOURCE_CRS)
    kommuner["kode"] = kommuner["kode"].astype(str).str.zfill(4)
    kommuner = kommuner[~kommuner["kode"].isin(EXCLUDED_KODER)]

    coastal_idx = SpatialIndex.from_geojson(COASTAL_PATH, name="coastal_waters")
    catch_idx = SpatialIndex.from_geojson(CATCHMENTS_PATH, name="catchments")
    eco_by_name = load_eco_status()

    coastal_areas = {
        str(row.get("op_id", i)): row.geometry.area / 10_000
        for i, row in coastal_idx.gdf.iterrows()
    }
    catch_areas = {
        str(row.get("hov_id", i)): row.geometry.area / 10_000
        for i, row in catch_idx.gdf.iterrows()
    }

    by_kommune: dict[str, Any] = {}
    by_opland: dict[str, dict[str, Any]] = {}

    for _, km_row in kommuner.iterrows():
        kode = km_row["kode"]
        navn = km_row["navn"]
        geom = repair_geometry(km_row.geometry)
        metric = gpd.GeoSeries([geom], crs=DEFAULT_SOURCE_CRS).to_crs(METRIC_CRS).iloc[0]
        kommune_area_ha = metric.area / 10_000
        if kommune_area_ha <= 0:
            continue

        kyst = overlap_rows(
            metric,
            coastal_idx,
            "op_id",
            "op_navn",
            kommune_area_ha,
            coastal_areas,
        )
        for row in kyst:
            row["ecologicalStatus"] = eco_by_name.get(row["opNavn"])

        kyst.sort(key=lambda r: r["andelAfKommunePct"], reverse=True)

        hoved = []
        for idx in catch_idx.gdf.index:
            feat = catch_idx.gdf.loc[idx]
            hov_id = str(feat.get("hov_id", "")).strip()
            hov_navn = str(feat.get("hov_na", hov_id)).strip()
            inter = repair_geometry(metric.intersection(feat.geometry))
            if inter.is_empty:
                continue
            overlap_ha = inter.area / 10_000
            if overlap_ha < 0.01:
                continue
            pct = round(overlap_ha / kommune_area_ha * 100, 2)
            hoved.append({
                "hovId": hov_id,
                "hovNavn": hov_navn,
                "andelAfKommunePct": pct,
            })
        hoved.sort(key=lambda r: r["andelAfKommunePct"], reverse=True)

        by_kommune[kode] = {
            "kommuneNavn": navn,
            "kystvandsoplande": kyst,
            "hovedoplande": hoved,
            "antalOplande": len(kyst),
            "kystvandStatus": [
                {"opNavn": r["opNavn"], "ecologicalStatus": r.get("ecologicalStatus") or "Ukendt"}
                for r in kyst
            ],
        }

        for row in kyst:
            key = row["opNavn"]
            if key not in by_opland:
                by_opland[key] = {"opNavn": key, "opId": row["opId"], "kommuner": []}
            by_opland[key]["kommuner"].append({
                "kode": kode,
                "kommuneNavn": navn,
                "andelAfOplandPct": row["andelAfOplandPct"],
            })

    payload = {
        "metadata": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "methodVersion": METHOD_VERSION,
            "sourceLayers": [
                str(KOMMUNER_PATH.relative_to(REPO)),
                str(COASTAL_PATH.relative_to(REPO)),
                str(CATCHMENTS_PATH.relative_to(REPO)),
                str(COASTAL_STATUS_PATH.relative_to(REPO)),
            ],
        },
        "byKommune": by_kommune,
        "byOpland": by_opland,
    }

    write_json_both("kommune-oplande.json", payload)
    return {"kommuner": len(by_kommune), "oplande": len(by_opland)}


def main() -> int:
    t0 = time.time()
    records = build()
    duration = time.time() - t0
    log_etl_run(
        source="kommune-oplande",
        endpoints=["kommuner", "coastal-waters", "catchments"],
        records={k: int(v) for k, v in records.items()},
        status="ok",
        notes="Sprint 6 kommune × opland crosswalk",
        duration_seconds=duration,
    )
    print(f"✓ Kommune oplande built ({records['kommuner']} kommuner) in {duration:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
