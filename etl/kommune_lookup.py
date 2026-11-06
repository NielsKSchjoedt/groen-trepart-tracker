"""
Point → kommune lookup without network access (stdlib only).

Replaces DAWA's /kommuner/reverse endpoint, which Dataforsyningen shut down in
2026 (every DAWA endpoint now answers HTTP 410 Gone). Boundaries come from the
committed, WGS84 TopoJSON ``public/data/kommuner.topo.json`` (99 features incl.
Christiansø, quantised to roughly 40 m), so the lookup is deterministic and
works in the daily GitHub Actions job, which installs no GIS libraries.

Accuracy is ample for assigning a project centroid to a kommune; it is not
meant for area clipping (MARS's own per-kommune figures are used for that —
see ``mars_municipality.py``).
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TOPOJSON = REPO_ROOT / "public" / "data" / "kommuner.topo.json"

Ring = list[tuple[float, float]]


def _decode_arcs(topo: dict) -> list[Ring]:
    """Decode delta-encoded, quantised TopoJSON arcs into absolute lon/lat rings."""
    transform = topo.get("transform")
    arcs: list[Ring] = []
    for arc in topo["arcs"]:
        x = y = 0
        pts: Ring = []
        for point in arc:
            if transform:
                x += point[0]
                y += point[1]
                sx, sy = transform["scale"]
                tx, ty = transform["translate"]
                pts.append((x * sx + tx, y * sy + ty))
            else:
                pts.append((float(point[0]), float(point[1])))
        arcs.append(pts)
    return arcs


def _ring_from_arc_indexes(indexes: Iterable[int], arcs: list[Ring]) -> Ring:
    ring: Ring = []
    for i in indexes:
        arc = arcs[i] if i >= 0 else list(reversed(arcs[~i]))
        # Consecutive arcs share their joint point — drop the duplicate.
        ring.extend(arc if not ring else arc[1:])
    return ring


def _point_in_ring(lon: float, lat: float, ring: Ring) -> bool:
    """Even-odd ray casting."""
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat):
            x_cross = (xj - xi) * (lat - yi) / (yj - yi) + xi
            if lon < x_cross:
                inside = not inside
        j = i
    return inside


def _segment_distance_m(px, py, ax, ay, bx, by, kx, ky) -> float:
    """Distance in metres from P to segment AB (lon/lat scaled by kx, ky)."""
    px, py, ax, ay, bx, by = px * kx, py * ky, ax * kx, ay * ky, bx * kx, by * ky
    dx, dy = bx - ax, by - ay
    seg2 = dx * dx + dy * dy
    u = 0.0 if seg2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg2))
    cx, cy = ax + u * dx, ay + u * dy
    return math.hypot(px - cx, py - cy)


class KommuneLookup:
    """
    Resolve WGS84 points to kommuner from the committed TopoJSON.

    @example
        lookup = KommuneLookup.load()
        lookup.find(10.388, 55.396)  # → {'kode': '0461', 'navn': 'Odense'}
    """

    def __init__(self, features: list[tuple[str, str, list[list[Ring]], tuple[float, float, float, float]]]):
        self._features = features

    @classmethod
    def load(cls, path: Path | str = DEFAULT_TOPOJSON) -> "KommuneLookup":
        topo = json.loads(Path(path).read_text(encoding="utf-8"))
        arcs = _decode_arcs(topo)
        obj = next(iter(topo["objects"].values()))
        features = []
        for geom in obj["geometries"]:
            props = geom.get("properties") or {}
            if geom["type"] == "Polygon":
                polys_idx = [geom["arcs"]]
            elif geom["type"] == "MultiPolygon":
                polys_idx = geom["arcs"]
            else:
                continue
            polygons = [[_ring_from_arc_indexes(r, arcs) for r in poly] for poly in polys_idx]
            xs = [p[0] for poly in polygons for p in poly[0]]
            ys = [p[1] for poly in polygons for p in poly[0]]
            bbox = (min(xs), min(ys), max(xs), max(ys))
            features.append((str(props.get("kode", "")), str(props.get("navn", "")), polygons, bbox))
        return cls(features)

    def find(self, lon: float, lat: float, max_snap_m: float = 2_000) -> dict[str, str] | None:
        """
        Return {'kode', 'navn'} of the kommune containing the point.

        Points just outside the simplified coastline (a fjord-side lowland project's
        centroid, say) snap to the nearest kommune boundary within ``max_snap_m``.
        Returns None only for points genuinely at sea.
        """
        for kode, navn, polygons, (x0, y0, x1, y1) in self._features:
            if not (x0 <= lon <= x1 and y0 <= lat <= y1):
                continue
            for poly in polygons:
                if _point_in_ring(lon, lat, poly[0]) and not any(
                    _point_in_ring(lon, lat, hole) for hole in poly[1:]
                ):
                    return {"kode": kode, "navn": navn}
        return self._nearest(lon, lat, max_snap_m)

    def _nearest(self, lon: float, lat: float, max_m: float) -> dict[str, str] | None:
        # Equirectangular metres — accurate to well under 1 % at Danish latitudes.
        kx = 111_320 * math.cos(math.radians(lat))
        ky = 110_574
        pad_lon, pad_lat = max_m / kx, max_m / ky
        best: tuple[float, str, str] | None = None
        for kode, navn, polygons, (x0, y0, x1, y1) in self._features:
            if not (x0 - pad_lon <= lon <= x1 + pad_lon and y0 - pad_lat <= lat <= y1 + pad_lat):
                continue
            for poly in polygons:
                ring = poly[0]
                for (ax, ay), (bx, by) in zip(ring, ring[1:]):
                    d = _segment_distance_m(lon, lat, ax, ay, bx, by, kx, ky)
                    if d <= max_m and (best is None or d < best[0]):
                        best = (d, kode, navn)
        return {"kode": best[1], "navn": best[2]} if best else None


_DEFAULT: KommuneLookup | None = None


def find_kommune(lon: float, lat: float) -> dict[str, str] | None:
    """Module-level convenience wrapper with a lazily loaded default lookup."""
    global _DEFAULT
    if _DEFAULT is None:
        _DEFAULT = KommuneLookup.load()
    return _DEFAULT.find(lon, lat)
