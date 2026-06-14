"""Unit tests for the optional GeoPandas spatial overlay engine."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

try:
    import geopandas as gpd
    from shapely.geometry import Polygon, box

    from spatial_overlay import SpatialIndex
except ImportError as exc:  # pragma: no cover - exercised on stdlib-only CI
    gpd = None
    Polygon = None
    box = None
    SpatialIndex = None
    IMPORT_ERROR = exc
else:
    IMPORT_ERROR = None


@unittest.skipIf(IMPORT_ERROR is not None, f"spatial deps not installed: {IMPORT_ERROR}")
class TestSpatialIndex(unittest.TestCase):
    def test_square_overlap_area_is_expected(self) -> None:
        """1 km² square clipped by a half-width target should produce 50 ha."""

        source = gpd.GeoDataFrame(
            {"id": [1]},
            geometry=[box(500_000, 6_200_000, 501_000, 6_201_000)],
            crs="EPSG:25832",
        )
        idx = SpatialIndex(source, name="test_square", source_crs="EPSG:25832")
        target_metric = box(500_000, 6_200_000, 500_500, 6_201_000)
        target_4326 = gpd.GeoSeries([target_metric], crs="EPSG:25832").to_crs("EPSG:4326").iloc[0]

        result = idx.intersect_area(target_4326)

        self.assertAlmostEqual(result["totalHa"], 50.0, places=2)
        self.assertEqual(result["intersectingFeatures"], 1)

    def test_disjoint_polygon_returns_zero(self) -> None:
        """A target outside the indexed geometry should have no overlap."""

        source = gpd.GeoDataFrame(
            {"id": [1]},
            geometry=[box(500_000, 6_200_000, 501_000, 6_201_000)],
            crs="EPSG:25832",
        )
        idx = SpatialIndex(source, name="test_square", source_crs="EPSG:25832")
        target_metric = box(510_000, 6_210_000, 511_000, 6_211_000)
        target_4326 = gpd.GeoSeries([target_metric], crs="EPSG:25832").to_crs("EPSG:4326").iloc[0]

        result = idx.intersect_area(target_4326)

        self.assertEqual(result["totalHa"], 0)
        self.assertEqual(result["intersectingFeatures"], 0)

    def test_invalid_polygon_is_repaired(self) -> None:
        """A bow-tie polygon should not crash index construction or overlay."""

        invalid = Polygon([
            (500_000, 6_200_000),
            (501_000, 6_201_000),
            (500_000, 6_201_000),
            (501_000, 6_200_000),
            (500_000, 6_200_000),
        ])
        source = gpd.GeoDataFrame({"id": [1]}, geometry=[invalid], crs="EPSG:25832")
        target_4326 = gpd.GeoSeries(
            [box(499_000, 6_199_000, 502_000, 6_202_000)],
            crs="EPSG:25832",
        ).to_crs("EPSG:4326").iloc[0]

        idx = SpatialIndex(source, name="invalid", source_crs="EPSG:25832")
        result = idx.intersect_area(target_4326)

        self.assertGreater(result["totalHa"], 0)


if __name__ == "__main__":
    unittest.main()
