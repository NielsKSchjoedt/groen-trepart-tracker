"""Tests for build_kommune_ansvar. Run: cd etl && python3 -m unittest test_build_kommune_ansvar -v"""
from __future__ import annotations

import json
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ANSVAR_PATH = REPO / "data" / "kommune-benchmark" / "kommune-ansvar.json"


class TestKommuneAnsvarArtifact(unittest.TestCase):
    """Validate kommune-ansvar.json (built in the monthly spatial workflow)."""

    @unittest.skipUnless(ANSVAR_PATH.exists(), "kommune-ansvar.json not built yet")
    def test_allocations_preserve_national_goals(self) -> None:
        data = json.loads(ANSVAR_PATH.read_text(encoding="utf-8"))
        rows = data["byKommune"].values()
        self.assertEqual(len(data["byKommune"]), 98)
        self.assertAlmostEqual(sum(r["ansvarKvaelstofT"] for r in rows), data["national"]["kvaelstofMaalT"], delta=1)
        self.assertAlmostEqual(sum(r["ansvarLavbundHa"] for r in rows), data["national"]["lavbundMaalHa"], delta=10)
        self.assertAlmostEqual(sum(r["lavbundPotentialeHa"] for r in rows), data["national"]["lavbundPotentialeHa"], delta=10)
        self.assertAlmostEqual(sum(r["ansvarSkovHa"] for r in rows), data["national"]["skovMaalHa"], delta=10)

    @unittest.skipUnless(ANSVAR_PATH.exists(), "kommune-ansvar.json not built yet")
    def test_urban_kommuner_carry_almost_no_ansvar(self) -> None:
        by = json.loads(ANSVAR_PATH.read_text(encoding="utf-8"))["byKommune"]
        for kode in ("0101", "0147"):  # København, Frederiksberg
            self.assertLess(by[kode]["ansvarLavbundPct"], 0.05)
            self.assertLess(by[kode]["ansvarKvaelstofPct"], 0.05)


class TestAllocate(unittest.TestCase):
    def test_split_by_weight_with_fallback(self) -> None:
        try:
            import numpy as np
            from build_kommune_ansvar import allocate
        except (ImportError, SystemExit):
            self.skipTest("spatial dependencies not installed")
        weights = np.array([[1.0, 0.0], [3.0, 0.0]])
        fallback = np.array([[0.0, 1.0], [0.0, 1.0]])
        out = allocate([100.0, 10.0], weights, fallback)
        self.assertEqual(list(out), [25.0 + 5.0, 75.0 + 5.0])


if __name__ == "__main__":
    unittest.main()
