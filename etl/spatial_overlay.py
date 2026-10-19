#!/usr/bin/env python3
"""
Reusable GeoPandas/Shapely overlay helpers for Sprint 4 spatial ETL.

This module is intentionally separate from `spatial_utils.py`, which remains
stdlib-only for the daily ETL. Importing this file requires the optional
`etl/requirements-spatial.txt` dependencies.
"""
from __future__ import annotations

import json
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TypedDict

import geopandas as gpd
from rtree import index
from shapely.geometry import box, shape
from shapely.geometry.base import BaseGeometry

METRIC_CRS = "EPSG:25832"
DEFAULT_SOURCE_CRS = "EPSG:4326"


class OverlayResult(TypedDict):
    """Area-overlap result returned by `SpatialIndex.intersect_area`."""

    totalHa: float
    intersectingFeatures: int
    totalCandidates: int
    indexName: str


@dataclass(frozen=True)
class KommuneFeature:
    """
    Municipality geometry prepared for overlay calls.

    @param kode - DAWA 4-digit municipality code
    @param navn - Municipality display name
    @param geometry - Shapely geometry in EPSG:4326
    """

    kode: str
    navn: str
    geometry: BaseGeometry


def repair_geometry(geom: BaseGeometry) -> BaseGeometry:
    """
    Return a valid geometry where possible.

    GeoServer layers occasionally contain self-intersections. Shapely's
    `buffer(0)` is the conservative repair used here because it is widely
    supported and sufficient for area overlays in this project.

    @param geom - Input Shapely geometry
    @returns Original geometry if valid, otherwise a repaired geometry
    @example repair_geometry(shape(feature["geometry"]))
    """

    if geom.is_empty or geom.is_valid:
        return geom
    fixed = geom.buffer(0)
    return fixed if not fixed.is_empty else geom


class SpatialIndex:
    """
    R-tree indexed feature collection in EPSG:25832 for area calculations.

    The public methods accept EPSG:4326 target geometries and return hectares.
    Internally both source and target geometries are projected to EPSG:25832 so
    area calculations use metres.
    """

    def __init__(
        self,
        gdf: gpd.GeoDataFrame,
        *,
        name: str,
        source_crs: str = DEFAULT_SOURCE_CRS,
    ) -> None:
        """
        Build an indexed, metric GeoDataFrame.

        @param gdf - GeoDataFrame containing polygon geometries
        @param name - Human-readable layer name included in results
        @param source_crs - CRS to assume when `gdf.crs` is missing
        @example SpatialIndex(gdf, name="dce_30")
        """

        self.name = name
        if gdf.crs is None:
            gdf = gdf.set_crs(source_crs)
        metric_gdf = gdf.to_crs(METRIC_CRS)
        metric_gdf = metric_gdf[metric_gdf.geometry.notna()].copy()
        metric_gdf["geometry"] = metric_gdf.geometry.apply(repair_geometry)
        metric_gdf = metric_gdf[~metric_gdf.geometry.is_empty].reset_index(drop=True)

        self.gdf = metric_gdf
        self.rtree = index.Index()
        for i, geom in enumerate(self.gdf.geometry):
            self.rtree.insert(i, geom.bounds)

    @classmethod
    def from_geojson(cls, path: str | Path, *, name: str) -> "SpatialIndex":
        """
        Load a GeoJSON FeatureCollection and build a SpatialIndex.

        @param path - Path to a GeoJSON file
        @param name - Human-readable layer name
        @returns SpatialIndex in EPSG:25832
        @example SpatialIndex.from_geojson("data/arealdata-biodiversitet/ku-prio-1.geojson", name="ku_prio_1")
        """

        return cls(gpd.read_file(path), name=name)

    @classmethod
    def from_features(
        cls,
        features: list[dict[str, Any]],
        *,
        name: str,
        source_crs: str = DEFAULT_SOURCE_CRS,
    ) -> "SpatialIndex":
        """
        Build a SpatialIndex from in-memory GeoJSON features.

        @param features - GeoJSON Feature dictionaries
        @param name - Human-readable layer name
        @param source_crs - CRS for the feature geometries
        @returns SpatialIndex in EPSG:25832
        @example SpatialIndex.from_features(fc["features"], name="marker_0851")
        """

        return cls(gpd.GeoDataFrame.from_features(features, crs=source_crs), name=name)

    def _to_metric(self, geom_4326: BaseGeometry) -> BaseGeometry:
        """Project one EPSG:4326 geometry to EPSG:25832."""

        series = gpd.GeoSeries([geom_4326], crs=DEFAULT_SOURCE_CRS).to_crs(METRIC_CRS)
        return repair_geometry(series.iloc[0])

    def intersect_area(self, target_geom_4326: BaseGeometry) -> OverlayResult:
        """
        Compute the total overlap area between this index and a target geometry.

        @param target_geom_4326 - Target geometry in EPSG:4326
        @returns Total hectares plus feature/candidate counts
        @example idx.intersect_area(kommune.geometry)["totalHa"]
        """

        target = self._to_metric(target_geom_4326)
        return self.intersect_area_metric(target)

    def intersect_area_metric(self, target_geom_25832: BaseGeometry) -> OverlayResult:
        """
        Compute overlap area against an already-projected EPSG:25832 geometry.

        @param target_geom_25832 - Target geometry in EPSG:25832
        @returns Total hectares plus feature/candidate counts
        @example idx.intersect_area_metric(metric_union)["totalHa"]
        """

        target = repair_geometry(target_geom_25832)
        candidate_ids = list(self.rtree.intersection(target.bounds))
        total_ha = 0.0
        intersecting = 0
        for i in candidate_ids:
            geom = self.gdf.geometry.iloc[i]
            if not geom.intersects(target):
                continue
            inter = geom.intersection(target)
            if inter.is_empty:
                continue
            total_ha += inter.area / 10_000
            intersecting += 1
        return {
            "totalHa": round(total_ha, 4),
            "intersectingFeatures": intersecting,
            "totalCandidates": len(candidate_ids),
            "indexName": self.name,
        }

    def intersect_features(self, target_geom_4326: BaseGeometry) -> Iterator[tuple[int, BaseGeometry]]:
        """
        Yield exact intersection geometries for features touching a target.

        @param target_geom_4326 - Target geometry in EPSG:4326
        @returns Iterator of `(feature_index, intersection_geometry)` in EPSG:25832
        @example sum(inter.area for _, inter in idx.intersect_features(kommune.geometry))
        """

        target = self._to_metric(target_geom_4326)
        for i in self.rtree.intersection(target.bounds):
            geom = self.gdf.geometry.iloc[i]
            if not geom.intersects(target):
                continue
            inter = geom.intersection(target)
            if not inter.is_empty:
                yield i, inter

    def clip_to_bbox(self, bbox_4326: tuple[float, float, float, float]) -> "SpatialIndex":
        """
        Return a new SpatialIndex containing features whose bbox touches bbox_4326.

        @param bbox_4326 - `(minx, miny, maxx, maxy)` in EPSG:4326
        @returns SpatialIndex with the same feature schema but fewer rows
        @example idx.clip_to_bbox((9.0, 55.0, 10.0, 56.0))
        """

        bbox_metric = gpd.GeoSeries([box(*bbox_4326)], crs=DEFAULT_SOURCE_CRS).to_crs(METRIC_CRS).iloc[0]
        candidate_ids = list(self.rtree.intersection(bbox_metric.bounds))
        return SpatialIndex(self.gdf.iloc[candidate_ids].copy(), name=self.name, source_crs=METRIC_CRS)

    @property
    def total_area_ha(self) -> float:
        """Total area of all indexed geometries in hectares."""

        return round(float(self.gdf.geometry.area.sum() / 10_000), 4)


def iter_kommuner_geojson(path: str | Path) -> Iterator[KommuneFeature]:
    """
    Yield municipality features from a DAWA/TopoJSON-derived GeoJSON file.

    @param path - Path to a WGS84 municipality GeoJSON FeatureCollection
    @returns Iterator of KommuneFeature entries
    @example list(iter_kommuner_geojson("data/geo/kommuner-wgs84.geojson"))
    """

    with open(path, encoding="utf-8") as f:
        fc = json.load(f)
    for feat in fc.get("features", []):
        props = feat.get("properties") or {}
        geom = feat.get("geometry")
        kode = str(props.get("kode") or props.get("kommunekode") or "")
        navn = str(props.get("navn") or props.get("kommune") or kode)
        if not kode or not geom:
            continue
        yield KommuneFeature(kode=kode, navn=navn, geometry=shape(geom))


def overlay_per_kommune(
    target_index: SpatialIndex,
    kommuner: Iterator[KommuneFeature],
    *,
    output_path: Path | None = None,
) -> dict[str, OverlayResult]:
    """
    Compute a target layer's overlap with each municipality.

    @param target_index - SpatialIndex for the source layer being measured
    @param kommuner - Iterator of municipality geometries in EPSG:4326
    @param output_path - Optional path to write `{kode: OverlayResult}` JSON
    @returns Mapping from municipality code to overlay result
    @example overlay_per_kommune(dce_index, iter_kommuner_geojson("kommuner.geojson"))
    """

    results: dict[str, OverlayResult] = {}
    for kommune in kommuner:
        results[kommune.kode] = target_index.intersect_area(kommune.geometry)
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return results
