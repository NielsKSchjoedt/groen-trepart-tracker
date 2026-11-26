"""Tests for etl/fetch_miljoegis.py feature ordering.

Run: python -m unittest test_fetch_miljoegis  (inside etl/)
No network.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import fetch_miljoegis as fm  # noqa: E402


def fc(*ids):
    return {"type": "FeatureCollection", "features": [{"type": "Feature", "id": i} for i in ids]}


class SortFeaturesTest(unittest.TestCase):
    def test_sorts_by_numeric_id_suffix(self):
        out = fm.sort_features(fc("kla_projektforslag.176", "kla_projektforslag.9", "kla_projektforslag.133"))
        self.assertEqual(
            [f["id"] for f in out["features"]],
            ["kla_projektforslag.9", "kla_projektforslag.133", "kla_projektforslag.176"],
        )

    def test_same_output_regardless_of_upstream_order(self):
        a = fm.sort_features(fc("x.3", "x.1", "x.2"))
        b = fm.sort_features(fc("x.2", "x.3", "x.1"))
        self.assertEqual(a, b)

    def test_non_numeric_and_missing_ids_go_last_and_stay_stable(self):
        out = fm.sort_features({"type": "FeatureCollection", "features": [{"id": "x.b"}, {}, {"id": "x.2"}, {"id": "x.a"}]})
        self.assertEqual([f.get("id") for f in out["features"]], ["x.2", None, "x.a", "x.b"])

    def test_tolerates_missing_features(self):
        self.assertEqual(fm.sort_features({"type": "FeatureCollection"}), {"type": "FeatureCollection"})


if __name__ == "__main__":
    unittest.main()
