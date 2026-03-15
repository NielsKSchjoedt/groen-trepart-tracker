"""
Pure-Python spatial utilities for ETL scripts.

No external dependencies (no shapely, geopandas, etc.) — only stdlib.

Used by fetch_section3.py and fetch_natura2000.py to assign nature-area
features to Danish municipalities via point-in-polygon.

Coordinate systems: all functions assume a consistent planar coordinate
system (works for both EPSG:25832 UTM32N and WGS84 lon/lat — the math
is the same for centroids and ray-casting).
"""

from __future__ import annotations
import json
from pathlib import Path
from typing import Iterator


# ---------------------------------------------------------------------------
# Polygon geometry helpers
# ---------------------------------------------------------------------------

def polygon_centroid(ring: list[list[float]]) -> tuple[float, float]:
    """
    Compute the centroid of a polygon exterior ring using the standard
    signed-area formula (more accurate than a simple vertex average).

    @param ring - List of [x, y] coordinate pairs forming the exterior ring
    @returns (cx, cy) centroid coordinates
    @example polygon_centroid([[0,0],[1,0],[1,1],[0,1],[0,0]])  # → (0.5, 0.5)
    """
    n = len(ring)
    if n < 3:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return (sum(xs) / len(xs), sum(ys) / len(ys))

    area = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(n - 1):
        x0, y0 = ring[i][0], ring[i][1]
        x1, y1 = ring[i + 1][0], ring[i + 1][1]
        cross = x0 * y1 - x1 * y0
        area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    area *= 0.5
    if area == 0:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return (sum(xs) / len(xs), sum(ys) / len(ys))
    cx /= (6.0 * area)
    cy /= (6.0 * area)
    return (cx, cy)


def geometry_centroid(geometry: dict) -> tuple[float, float] | None:
    """
    Compute the centroid of a GeoJSON geometry (Polygon or MultiPolygon).
    For MultiPolygon, uses the ring with the largest area.

    @param geometry - GeoJSON geometry dict with 'type' and 'coordinates'
    @returns (x, y) centroid or None if geometry is empty/invalid
    @example geometry_centroid({"type": "Polygon", "coordinates": [[[0,0],[1,0],[1,1],[0,1],[0,0]]]})
    """
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")
    if not coords:
        return None

    if gtype == "Polygon":
        ring = coords[0]  # exterior ring
        return polygon_centroid(ring)

    if gtype == "MultiPolygon":
        # Use the polygon with the most vertices as a proxy for largest
        best_ring = max(
            (poly[0] for poly in coords if poly),
            key=len,
            default=None,
        )
        return polygon_centroid(best_ring) if best_ring else None

    return None


def point_in_ring(x: float, y: float, ring: list[list[float]]) -> bool:
    """
    Ray-casting point-in-polygon test for a single polygon ring.

    @param x, y - Point coordinates
    @param ring  - List of [x, y] coordinate pairs (exterior or hole ring)
    @returns True if point is inside the ring
    @example point_in_ring(0.5, 0.5, [[0,0],[1,0],[1,1],[0,1],[0,0]])  # → True
    """
    inside = False
    n = len(ring)
    px, py = ring[-1][0], ring[-1][1]
    for i in range(n):
        cx, cy = ring[i][0], ring[i][1]
        if ((py > y) != (cy > y)) and (x < (cx - px) * (y - py) / (cy - py) + px):
            inside = not inside
        px, py = cx, cy
    return inside


def point_in_polygon_geometry(x: float, y: float, geometry: dict) -> bool:
    """
    Test whether (x, y) lies inside a GeoJSON Polygon or MultiPolygon geometry.
    Handles polygon holes (subtracts interior rings).

    @param x, y    - Point to test
    @param geometry - GeoJSON Polygon or MultiPolygon
    @returns True if point is inside the geometry (accounting for holes)
    @example
        geo = {"type": "Polygon", "coordinates": [[[0,0],[2,0],[2,2],[0,2],[0,0]]]}
        point_in_polygon_geometry(1, 1, geo)  # → True
        point_in_polygon_geometry(3, 3, geo)  # → False
    """
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")

    if gtype == "Polygon":
        rings = coords
        if not point_in_ring(x, y, rings[0]):
            return False
        # Subtract holes
        for hole in rings[1:]:
            if point_in_ring(x, y, hole):
                return False
        return True

    if gtype == "MultiPolygon":
        for polygon in coords:
            rings = polygon
            if not point_in_ring(x, y, rings[0]):
                continue
            inside = True
            for hole in rings[1:]:
                if point_in_ring(x, y, hole):
                    inside = False
                    break
            if inside:
                return True
        return False

    return False


# ---------------------------------------------------------------------------
# Municipality spatial index
# ---------------------------------------------------------------------------

class MunicipalityIndex:
    """
    Spatial index of Danish municipality polygons loaded from a GeoJSON file.

    Builds a bounding-box pre-filter so that point-in-polygon ray-casts
    are only run for municipalities whose bounding box contains the query point.

    Usage::
        idx = MunicipalityIndex.from_geojson("data/dawa/kommuner.geojson")
        kode = idx.find_kommune(723996.4, 6181935.9)  # UTM32N coords
    """

    def __init__(self, entries: list[dict]):
        """
        @param entries - List of dicts with keys:
            kode (str), navn (str), geometry (GeoJSON dict),
            bbox (minx, miny, maxx, maxy)
        """
        self._entries = entries

    @classmethod
    def from_geojson(cls, path: str | Path) -> "MunicipalityIndex":
        """
        Load municipality polygons from a GeoJSON FeatureCollection.

        @param path - Path to a GeoJSON file with Polygon/MultiPolygon features
            that have a 'kode' property (4-digit municipality code).
        @returns MunicipalityIndex ready for spatial queries
        @example MunicipalityIndex.from_geojson("data/dawa/kommuner.geojson")
        """
        with open(path, encoding="utf-8") as f:
            gj = json.load(f)

        entries = []
        for feat in gj.get("features", []):
            props = feat.get("properties", {})
            kode = props.get("kode", "")
            navn = props.get("navn", "")
            geo = feat.get("geometry", {})
            if not geo or not kode:
                continue

            bbox = _geometry_bbox(geo)
            if bbox is None:
                continue

            entries.append({
                "kode": kode,
                "navn": navn,
                "geometry": geo,
                "bbox": bbox,
            })

        return cls(entries)

    def find_kommune(self, x: float, y: float) -> tuple[str, str] | None:
        """
        Find which municipality (kode, navn) contains point (x, y).

        Uses bounding-box pre-filter followed by full ray-cast only for
        candidates that pass the bbox test.

        @param x - X coordinate (UTM easting or longitude)
        @param y - Y coordinate (UTM northing or latitude)
        @returns (kode, navn) tuple or None if point falls outside all municipalities
        @example idx.find_kommune(723996.4, 6181935.9)  # → ('0461', 'Odense')
        """
        for entry in self._entries:
            minx, miny, maxx, maxy = entry["bbox"]
            if x < minx or x > maxx or y < miny or y > maxy:
                continue
            if point_in_polygon_geometry(x, y, entry["geometry"]):
                return (entry["kode"], entry["navn"])
        return None

    def __len__(self) -> int:
        return len(self._entries)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _iter_rings(geometry: dict) -> Iterator[list[list[float]]]:
    """Yield all rings from a Polygon or MultiPolygon geometry."""
    gtype = geometry.get("type")
    coords = geometry.get("coordinates", [])
    if gtype == "Polygon":
        for ring in coords:
            yield ring
    elif gtype == "MultiPolygon":
        for poly in coords:
            for ring in poly:
                yield ring


def _geometry_bbox(geometry: dict) -> tuple[float, float, float, float] | None:
    """Compute (minx, miny, maxx, maxy) bounding box of a geometry."""
    all_x: list[float] = []
    all_y: list[float] = []
    for ring in _iter_rings(geometry):
        all_x.extend(p[0] for p in ring)
        all_y.extend(p[1] for p in ring)
    if not all_x:
        return None
    return (min(all_x), min(all_y), max(all_x), max(all_y))
