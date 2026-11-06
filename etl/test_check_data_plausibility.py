"""Tests for check_data_plausibility. Run: cd etl && python3 -m unittest test_check_data_plausibility -v"""
from __future__ import annotations

import copy
import unittest

from check_data_plausibility import compare


def summary(total: int = 1666, est: int = 135, n: float = 6360, e: float = 105_566, a: float = 3582) -> dict:
    return {
        "plans": [{}] * 37,
        "national": {
            "byKommune": [{}] * 98,
            "projectPipeline": {"total": total, "phases": {"established": {"count": est}}},
            "progress": {
                "nitrogen": {"totalT": n},
                "extraction": {"totalHa": e},
                "afforestation": {"marsTotal": {"ha": a}},
            },
        },
    }


class TestCompare(unittest.TestCase):
    def test_normal_daily_movement_passes(self) -> None:
        self.assertEqual(compare(summary(), summary(total=1690, n=6300, e=104_000)), [])

    def test_empty_upstream_answer_fails(self) -> None:
        problems = compare(summary(), summary(total=0, est=0, n=0, e=0, a=0))
        self.assertTrue(any("faldet fra" in p for p in problems))

    def test_large_drop_fails(self) -> None:
        problems = compare(summary(), summary(e=50_000))
        self.assertEqual(len(problems), 1)
        self.assertIn("lavbund", problems[0])

    def test_missing_kommuner_and_plans_fail(self) -> None:
        new = summary()
        new["national"]["byKommune"] = [{}] * 60
        new["plans"] = [{}] * 10
        self.assertEqual(len(compare(summary(), new)), 2)

    def test_missing_field_fails(self) -> None:
        new = copy.deepcopy(summary())
        del new["national"]["progress"]["nitrogen"]
        self.assertTrue(any("mangler" in p for p in compare(summary(), new)))


if __name__ == "__main__":
    unittest.main()
