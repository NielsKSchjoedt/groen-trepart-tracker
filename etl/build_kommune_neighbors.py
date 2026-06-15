#!/usr/bin/env python3
"""
Build geographic neighbor index for Danish municipalities (shared kommunegrænse).

Reads data/dawa/kommuner.geojson and outputs kommune-neighbors.json keyed by
4-digit kode and kommune name.

Run via:
  mise run build-kommune-neighbors
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

try:
    import geopandas as gpd
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Run: mise run setup-spatial") from exc

from spatial_overlay import METRIC_CRS

KOMMUNER_PATH = REPO / "data" / "dawa" / "kommuner.geojson"
OUT_DATA = REPO / "data" / "kommune-neighbors.json"
OUT_PUBLIC = REPO / "public" / "data" / "kommune-neighbors.json"


def build() -> dict:
    gdf = gpd.read_file(KOMMUNER_PATH)
    if gdf.crs is None:
        gdf = gdf.set_crs(METRIC_CRS)
    gdf = gdf.to_crs(METRIC_CRS)

    if "kode" not in gdf.columns:
        gdf["kode"] = gdf.get("kommunekode", gdf.index.astype(str))
    gdf["kode"] = gdf["kode"].astype(str).str.zfill(4)
    if "navn" not in gdf.columns:
        gdf["navn"] = gdf.get("kommune", gdf["kode"])

    kode_to_navn = {row["kode"]: str(row["navn"]) for _, row in gdf.iterrows()}
    by_kode: dict[str, list[str]] = {}

    for idx, row in gdf.iterrows():
        kode = row["kode"]
        geom = row.geometry
        neighbors: set[str] = set()
        for other_idx, other in gdf.iterrows():
            if other_idx == idx:
                continue
            other_kode = other["kode"]
            if geom.touches(other.geometry) or (
                geom.intersects(other.geometry) and not geom.contains(other.geometry)
            ):
                neighbors.add(other_kode)
        by_kode[kode] = sorted(neighbors)

    by_navn: dict[str, list[str]] = {}
    for kode, neighbor_koder in by_kode.items():
        navn = kode_to_navn.get(kode, kode)
        by_navn[navn] = sorted(
            kode_to_navn.get(nk, nk) for nk in neighbor_koder
        )

    return {
        "builtAt": datetime.now(timezone.utc).isoformat(),
        "source": str(KOMMUNER_PATH.relative_to(REPO)),
        "count": len(by_kode),
        "byKode": by_kode,
        "byNavn": by_navn,
    }


def main() -> None:
    payload = build()
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    OUT_DATA.parent.mkdir(parents=True, exist_ok=True)
    OUT_DATA.write_text(text, encoding="utf-8")
    OUT_PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    OUT_PUBLIC.write_text(text, encoding="utf-8")
    print(f"Wrote {OUT_DATA} ({payload['count']} kommuner)")


if __name__ == "__main__":
    main()
