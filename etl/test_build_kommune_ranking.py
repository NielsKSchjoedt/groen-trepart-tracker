"""Tests for build_kommune_ranking. Run: cd etl && python3 -m unittest test_build_kommune_ranking -v"""
from __future__ import annotations

import json
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
RANKING_PATH = REPO / "data" / "kommune-benchmark" / "kommune-ranking.json"
B1_PATH = REPO / "data" / "kommune-benchmark" / "b1-andel-nationalt-naturpotentiale.json"


class TestKommuneRankingArtifact(unittest.TestCase):
    """Validate kommune-ranking.json when present (built in CI/spatial workflow)."""

    @unittest.skipUnless(RANKING_PATH.exists(), "kommune-ranking.json not built yet")
    def test_ninety_eight_kommuner(self) -> None:
        data = json.loads(RANKING_PATH.read_text(encoding="utf-8"))
        self.assertEqual(len(data["kommuner"]), 98)
        self.assertEqual(len(data["byKommune"]), 98)

    @unittest.skipUnless(RANKING_PATH.exists() and B1_PATH.exists(), "ranking/b1 missing")
    def test_ansvar_sums_near_hundred(self) -> None:
        data = json.loads(RANKING_PATH.read_text(encoding="utf-8"))
        b1 = json.loads(B1_PATH.read_text(encoding="utf-8"))
        total = sum(row["ansvarPct"] for row in data["kommuner"])
        b1_total = sum(r["dce30PctOfNational"] for r in b1["byKommune"].values())
        self.assertAlmostEqual(total, b1_total, delta=0.5)
        self.assertAlmostEqual(total, 100.0, delta=2.0)

    @unittest.skipUnless(RANKING_PATH.exists(), "kommune-ranking.json not built yet")
    def test_levering_pct_sums_near_hundred(self) -> None:
        data = json.loads(RANKING_PATH.read_text(encoding="utf-8"))
        for key in ("leveringUdtagningPct", "leveringSkovPct", "leveringKvaelstofPct"):
            vals = [r[key] for r in data["kommuner"] if r.get(key) is not None]
            self.assertEqual(len(vals), 98)
            self.assertAlmostEqual(sum(vals), 100.0, delta=0.5, msg=key)

    @unittest.skipUnless(RANKING_PATH.exists(), "kommune-ranking.json not built yet")
    def test_rank_by_metric_covers_all(self) -> None:
        data = json.loads(RANKING_PATH.read_text(encoding="utf-8"))
        for row in data["kommuner"]:
            ranks = row.get("rankByMetric", {})
            self.assertIn("idxLavbund", ranks)
            self.assertGreaterEqual(ranks["idxLavbund"], 1)
            self.assertLessEqual(ranks["idxLavbund"], 98)


class TestKommuneRankingLogic(unittest.TestCase):
    def test_safe_ratio(self) -> None:
        from build_kommune_ranking import _safe_ratio

        self.assertIsNone(_safe_ratio(10, 0))
        self.assertEqual(_safe_ratio(25, 100), 0.25)


if __name__ == "__main__":
    unittest.main()
