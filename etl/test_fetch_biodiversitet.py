"""Unit tests for WFS helpers used by biodiversitet fetchers (no network)."""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest import mock

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import _wfs  # noqa: E402


class TestAssertDkWgs84(unittest.TestCase):
    def test_rejects_likely_axis_swap(self) -> None:
        # Swapped (lat, lon) for a point in Denmark often lands as lon>16.
        bad = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [56.2, 9.5]},
                }
            ],
        }
        with self.assertRaises(ValueError):
            _wfs.assert_dk_wgs84_feature_collection(bad, n_sample=1)

    def test_accepts_copenhagenish_point(self) -> None:
        good = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [12.57, 55.68]},
                }
            ],
        }
        _wfs.assert_dk_wgs84_feature_collection(good, n_sample=1)


class TestPaginateContract(unittest.TestCase):
    def test_pagination_concat_matches_total(self) -> None:
        """Two pages of 2+1 features: iterator yields two FC dicts."""
        pages = [
            {
                "type": "FeatureCollection",
                "features": [
                    {"type": "Feature", "properties": {"id": 1}, "geometry": None},
                    {"type": "Feature", "properties": {"id": 2}, "geometry": None},
                ],
            },
            {
                "type": "FeatureCollection",
                "features": [
                    {"type": "Feature", "properties": {"id": 3}, "geometry": None},
                ],
            },
        ]
        with mock.patch.object(_wfs, "wfs_hits_count", return_value=3):
            with mock.patch.object(
                _wfs,
                "http_get",
                side_effect=[json.dumps(p).encode() for p in pages],
            ):
                all_feats: list[dict] = []
                for fc in _wfs.wfs_paginate_geojson_pages(
                    "https://example.test/wfs",
                    "t:test",
                    page_size=2,
                    sort_by="id",
                ):
                    all_feats.extend(fc.get("features", []))
        self.assertEqual(len(all_feats), 3)
        self.assertEqual([f["properties"]["id"] for f in all_feats], [1, 2, 3])


if __name__ == "__main__":
    unittest.main()
