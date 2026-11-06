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


    @unittest.skipUnless(ANSVAR_PATH.exists(), "kommune-ansvar.json not built yet")
    def test_kulstof_matches_official_wfs_scale(self) -> None:
        """The ≥ 6 % kulstofkort covers ~207.000 ha; the old WMS pixel count gave far more."""
        data = json.loads(ANSVAR_PATH.read_text(encoding="utf-8"))
        rows = data["byKommune"]
        total = sum(r["kulstofrigJordHa"] for r in rows.values())
        self.assertGreater(total, 180_000)
        self.assertLess(total, 230_000)
        for r in rows.values():
            self.assertAlmostEqual(
                r["kulstofrigJord6til12Ha"] + r["kulstofrigJordOver12Ha"], r["kulstofrigJordHa"], delta=0.2
            )
        # Spot checks against direct WFS overlays per kommune (Nov 2026).
        for kode, expected in (("0665", 1_417), ("0550", 9_637), ("0779", 4_164)):
            self.assertAlmostEqual(rows[kode]["kulstofrigJordHa"], expected, delta=0.03 * expected)

    @unittest.skipUnless(ANSVAR_PATH.exists(), "kommune-ansvar.json not built yet")
    def test_plan_kulstof_shares_sum_to_100(self) -> None:
        rows = json.loads(ANSVAR_PATH.read_text(encoding="utf-8"))["byKommune"].values()
        sums: dict[str, float] = {}
        for r in rows:
            for p in r["planer"]:
                sums[p["plan"]] = sums.get(p["plan"], 0.0) + p["andelAfPlanKulstofPct"]
        for plan, total in sums.items():
            if total > 0:
                self.assertAlmostEqual(total, 100.0, delta=0.5, msg=plan)


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


class TestVectorOverlay(unittest.TestCase):
    def setUp(self) -> None:
        try:
            import numpy  # noqa: F401
            from shapely.geometry import box  # noqa: F401
            import build_kommune_ansvar  # noqa: F401
        except (ImportError, SystemExit):
            self.skipTest("spatial dependencies not installed")

    def test_pieces_cover_kommune_including_area_outside_plans(self) -> None:
        from shapely.geometry import box
        from build_kommune_ansvar import overlay_pieces

        kommuner = [box(0, 0, 100, 100), box(100, 0, 200, 100)]
        plans = [box(0, 0, 150, 50)]  # covers half of kommune 0, a quarter of kommune 1
        k_idx, p_idx, pieces = overlay_pieces(kommuner, plans)
        areas = {(k, p): g.area for k, p, g in zip(k_idx, p_idx, pieces)}
        self.assertEqual(areas, {(0, 0): 5000, (0, 1): 5000, (1, 0): 2500, (1, 1): 7500})

    def test_kulstof_area_counts_partial_polygons_by_true_area(self) -> None:
        import numpy as np
        from shapely.geometry import box
        from build_kommune_ansvar import kulstof_area_by_piece

        pieces = np.array([box(0, 0, 100, 100), box(100, 0, 200, 100)], dtype=object)
        feats = np.array(
            [box(10, 10, 20, 20), box(95, 10, 105, 20), box(150, 50, 160, 60), box(500, 500, 510, 510)],
            dtype=object,
        )
        codes = np.array([12, 60, 60, 12])
        out = kulstof_area_by_piece(pieces, feats, codes)
        # m² → ha: 100 m² = 0,01 ha; the straddling square splits 50/50.
        self.assertEqual(list(np.round(out[12], 4)), [0.01, 0.0])
        self.assertEqual(list(np.round(out[60], 4)), [0.005, 0.015])


if __name__ == "__main__":
    unittest.main()
