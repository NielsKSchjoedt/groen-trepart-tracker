#!/usr/bin/env python3
"""
Split MARS project metrics across municipalities by geometry intersection.

MARS attributes only the area within the selected geographic boundary; this
module mirrors that for kommune-level ETL aggregation.
"""
from __future__ import annotations

from typing import Any

try:
    import geopandas as gpd
    from shapely.geometry import Polygon, shape
except ImportError:  # pragma: no cover
    gpd = None  # type: ignore[assignment]
    Polygon = None  # type: ignore[assignment,misc]
    shape = None  # type: ignore[assignment]

from spatial_overlay import DEFAULT_SOURCE_CRS, METRIC_CRS, SpatialIndex, repair_geometry


def spatial_available() -> bool:
    return gpd is not None and Polygon is not None


def _coords_to_geom_4326(coords: list[list[float]]):
    if not coords or len(coords) < 3:
        return None
    ring = [(float(c[0]), float(c[1])) for c in coords]
    geom = Polygon(ring)
    return repair_geometry(geom) if not geom.is_empty else None


def load_kommune_index(kommuner_geojson_path: str) -> SpatialIndex | None:
    """Load DAWA municipality polygons as a spatial index."""
    if not spatial_available():
        return None
    gdf = gpd.read_file(kommuner_geojson_path)
    if gdf.crs is None:
        gdf = gdf.set_crs(METRIC_CRS)
    gdf = gdf.to_crs(DEFAULT_SOURCE_CRS)
    if "kode" not in gdf.columns:
        gdf["kode"] = gdf.get("kommunekode", gdf.index.astype(str))
    gdf["kode"] = gdf["kode"].astype(str).str.zfill(4)
    return SpatialIndex(gdf, name="kommuner", source_crs=DEFAULT_SOURCE_CRS)


def split_metrics_by_kommune(
    project_geom_4326,
    nitrogen_t: float,
    extraction_ha: float,
    afforestation_ha: float,
    kommune_index: SpatialIndex,
) -> list[tuple[str, float, float, float]]:
    """
    Allocate project metrics to kommuner proportional to clipped intersection area.

    @returns List of (kode, nitrogenT, extractionHa, afforestationHa)
    """
    if project_geom_4326 is None or project_geom_4326.is_empty:
        return []

    clips: list[tuple[str, float]] = []
    total_ha = 0.0
    for idx, inter in kommune_index.intersect_features(project_geom_4326):
        kode = str(kommune_index.gdf.iloc[idx].get("kode", "")).zfill(4)
        if not kode:
            continue
        ha = inter.area / 10_000
        if ha < 0.001:
            continue
        clips.append((kode, ha))
        total_ha += ha

    if total_ha <= 0 or not clips:
        return []

    out: list[tuple[str, float, float, float]] = []
    for kode, ha in clips:
        share = ha / total_ha
        out.append((
            kode,
            round(nitrogen_t * share, 3),
            round(extraction_ha * share, 2),
            round(afforestation_ha * share, 2),
        ))
    return out


def geom_from_geo_id(
    geo_id: str,
    project_geometries: dict[str, list[list[float]]],
):
    coords = project_geometries.get(geo_id)
    if not coords:
        return None
    return _coords_to_geom_4326(coords)
