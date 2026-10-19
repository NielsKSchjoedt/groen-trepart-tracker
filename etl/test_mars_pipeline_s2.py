"""Tests for mars_pipeline_s2 (Sprint 2 DN 5-fase mapping). Run: cd etl && python3 test_mars_pipeline_s2.py"""
import unittest

from mars_pipeline_s2 import (
    CANCELLED_STATES,
    PIPELINE_STATE_MAP,
    build_by_pipeline_phase,
    build_by_pipeline_phase_from_enriched_plans,
    build_by_owner_org,
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
        self.assertEqual(r["byPipelinePhase"]["extraction"]["preliminary_grant"]["count"], 0)
        self.assertEqual(r["byPipelinePhase"]["afforestation"]["preliminary_grant"]["count"], 0)

    def test_phase_breakdown_filters_by_positive_pillar_metric(self) -> None:
        r = build_by_pipeline_phase(
            [
                {
                    "projectStatus": 6,
                    "nitrogenReductionT": 1.0,
                    "extractionEffortHa": 0.0,
                    "afforestationEffortHa": 0.0,
                },
                {
                    "projectStatus": 10,
                    "nitrogenReductionT": 0.0,
                    "extractionEffortHa": 2.0,
                    "afforestationEffortHa": 0.0,
                },
                {
                    "projectStatus": 15,
                    "nitrogenReductionT": 0.0,
                    "extractionEffortHa": 0.0,
                    "afforestationEffortHa": 3.0,
                },
                {
                    "projectStatus": 15,
                    "nitrogenReductionT": 4.0,
                    "extractionEffortHa": 5.0,
                    "afforestationEffortHa": 0.0,
                },
            ],
            [],
        )["byPipelinePhase"]

        self.assertEqual(r["nitrogen"]["preliminary_grant"]["count"], 1)
        self.assertEqual(r["extraction"]["preliminary_grant"]["count"], 0)
        self.assertEqual(r["afforestation"]["preliminary_grant"]["count"], 0)
        self.assertEqual(r["nitrogen"]["establishment_grant"]["count"], 0)
        self.assertEqual(r["extraction"]["establishment_grant"]["count"], 1)
        self.assertEqual(r["afforestation"]["establishment_grant"]["count"], 0)
        self.assertEqual(r["nitrogen"]["established"]["count"], 1)
        self.assertEqual(r["extraction"]["established"]["count"], 1)
        self.assertEqual(r["afforestation"]["established"]["count"], 1)

    def test_state_2_is_sketch_ansoegt(self) -> None:
        r = build_by_pipeline_phase(
            [{"projectStatus": 2, "nitrogenReductionT": 2.0, "extractionEffortHa": 3.0}],
            [],
        )
        sk = r["byPipelinePhase"]["nitrogen"]["sketch"]
        self.assertEqual(sk["count"], 1)
        self.assertEqual(sk["subStates"]["ansoegt"]["count"], 1)
        self.assertEqual(sk["subStates"]["kladde"]["count"], 0)

    def test_sketch_breakdown_filters_by_positive_pillar_metric(self) -> None:
        r = build_by_pipeline_phase(
            [{"projectStatus": 2, "nitrogenReductionT": 2.0, "extractionEffortHa": 3.0}],
            [{"sketchProjectId": "s1", "afforestationEffortHa": 4.0}],
        )["byPipelinePhase"]

        self.assertEqual(r["nitrogen"]["sketch"]["count"], 1)
        self.assertEqual(r["nitrogen"]["sketch"]["subStates"]["ansoegt"]["count"], 1)
        self.assertEqual(r["extraction"]["sketch"]["count"], 1)
        self.assertEqual(r["extraction"]["sketch"]["subStates"]["ansoegt"]["count"], 1)
        self.assertEqual(r["afforestation"]["sketch"]["count"], 1)
        self.assertEqual(r["afforestation"]["sketch"]["subStates"]["kladde"]["count"], 1)
        self.assertEqual(r["afforestation"]["sketch"]["subStates"]["ansoegt"]["count"], 0)

    def test_legacy_compat_excludes_sketches(self) -> None:
        r = build_by_pipeline_phase(
            [{"projectStatus": 6, "nitrogenReductionT": 1.0}],
            [{"sketchProjectId": "s1", "nitrogenReductionT": 99.0}],
        )
        l3 = legacy3_merged_from_by_pipeline(r["byPipelinePhase"])
        self.assertEqual(l3["preliminary"]["count"], 1)
        self.assertAlmostEqual(l3["preliminary"]["nitrogenT"], 1.0, places=1)

    def test_owner_org_counts_formal_projects_only(self) -> None:
        owner = build_by_owner_org(
            [{"projectStatus": 6, "subsidySchemeId": "sgav", "extractionEffortHa": 1.0}],
            [{"sketchProjectId": "s1", "subsidySchemeId": "nst", "extractionEffortHa": 10.0}],
            {"sgav": "SGAV", "nst": "NST"},
        )
        self.assertEqual(owner["SGAV"]["count"], 1)
        self.assertNotIn("NST", owner)

    def test_owner_org_pipeline_filters_by_pillar_metric(self) -> None:
        owner = build_by_owner_org(
            [
                {"projectStatus": 6, "subsidySchemeId": "sgav", "nitrogenReductionT": 1.0},
                {"projectStatus": 6, "subsidySchemeId": "sgav", "extractionEffortHa": 2.0},
            ],
            [],
            {"sgav": "SGAV"},
        )["SGAV"]

        self.assertEqual(owner["count"], 2)
        self.assertEqual(owner["byPipelinePhase"]["nitrogen"]["preliminary_grant"]["count"], 1)
        self.assertEqual(owner["byPipelinePhase"]["extraction"]["preliminary_grant"]["count"], 1)
        self.assertEqual(owner["byPipelinePhase"]["afforestation"]["preliminary_grant"]["count"], 0)

    def test_cancelled_states_roll_up_to_sidecar(self) -> None:
        cancelled = build_by_pipeline_phase(
            [
                {"projectStatus": 3, "extractionEffortHa": 1.0},
                {"projectStatus": 5, "extractionEffortHa": 2.0},
                {"projectStatus": 16, "afforestationEffortHa": 3.0},
                {"projectStatus": 17, "afforestationEffortHa": 4.0},
            ],
            [],
        )["cancelled"]

        self.assertEqual(cancelled["totalCount"], 4)
        self.assertAlmostEqual(cancelled["totalHa"], 10.0, places=1)
        self.assertEqual(cancelled["byCancellationStage"]["preliminary"]["count"], 2)
        self.assertEqual(cancelled["byCancellationStage"]["establishment"]["count"], 2)
        self.assertEqual(cancelled["byReason"]["opgivet"]["count"], 2)
        self.assertEqual(cancelled["byReason"]["afslag"]["count"], 2)

    def test_enriched_plans_matches_funnel_logic(self) -> None:
        plans = [
            {
                "sketchProjects": [
                    {"nitrogenT": 0, "extractionHa": 0, "afforestationHa": 10, "pipelinePhase": "sketch"},
                ],
                "projectDetails": [
                    {
                        "nitrogenT": 0,
                        "extractionHa": 0,
                        "afforestationHa": 5,
                        "pipelinePhase": "established",
                        "statusNr": 15,
                        "isCancelled": False,
                    },
                ],
            }
        ]
        r = build_by_pipeline_phase_from_enriched_plans(plans)
        aff = r["byPipelinePhase"]["afforestation"]
        self.assertAlmostEqual(aff["sketch"]["afforestationHa"], 10.0, places=1)
        self.assertAlmostEqual(aff["established"]["afforestationHa"], 5.0, places=1)


if __name__ == "__main__":
    unittest.main()
