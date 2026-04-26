"""Tests for mars_pipeline_s2 (Sprint 2 DN 5-fase mapping). Run: cd etl && python3 test_mars_pipeline_s2.py"""
import unittest

from mars_pipeline_s2 import (
    CANCELLED_STATES,
    PIPELINE_STATE_MAP,
    build_by_pipeline_phase,
    legacy3_merged_from_by_pipeline,
    legacy_enrich_phase,
    pipeline_phase_name,
)


class MarsPipelineS2Test(unittest.TestCase):
    def test_pipeline_state_map(self) -> None:
        self.assertEqual(PIPELINE_STATE_MAP[1], "sketch")
        self.assertEqual(PIPELINE_STATE_MAP[2], "sketch")
        self.assertEqual(PIPELINE_STATE_MAP[6], "preliminary_grant")
        self.assertEqual(PIPELINE_STATE_MAP[10], "establishment_grant")
        self.assertEqual(PIPELINE_STATE_MAP[15], "established")
        self.assertEqual(PIPELINE_STATE_MAP[3], "cancelled")

    def test_cancelled_states(self) -> None:
        self.assertIn(3, CANCELLED_STATES)
        self.assertIn(16, CANCELLED_STATES)

    def test_legacy_enrich(self) -> None:
        self.assertEqual(legacy_enrich_phase(15), "established")
        self.assertEqual(legacy_enrich_phase(10), "approved")
        self.assertEqual(legacy_enrich_phase(6), "preliminary")
        self.assertEqual(legacy_enrich_phase(1), "preliminary")
        self.assertEqual(pipeline_phase_name(1), "sketch")
        self.assertEqual(pipeline_phase_name(3), "cancelled")

    def test_empty(self) -> None:
        r = build_by_pipeline_phase([], [])
        b = r["byPipelinePhase"]["nitrogen"]["sketch"]
        self.assertEqual(b["count"], 0)
        l3 = legacy3_merged_from_by_pipeline(r["byPipelinePhase"])
        self.assertEqual(l3["preliminary"]["count"], 0)

    def test_one_preliminary_grant(self) -> None:
        projs = [
            {
                "projectStatus": 6,
                "nitrogenReductionT": 1.0,
                "extractionEffortHa": 0.0,
                "afforestationEffortHa": 0.0,
            }
        ]
        r = build_by_pipeline_phase(projs, [])
        n = r["byPipelinePhase"]["nitrogen"]["preliminary_grant"]
        self.assertEqual(n["count"], 1)
        self.assertAlmostEqual(n["nitrogenT"], 1.0, places=1)


if __name__ == "__main__":
    unittest.main()
