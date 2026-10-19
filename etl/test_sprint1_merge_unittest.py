import importlib.util
import unittest
from pathlib import Path

# Import compute from merge script

_BASE = Path(__file__).resolve().parent
_SPEC = importlib.util.spec_from_file_location("merge", _BASE / "merge_sprint1_national.py")
_merge = importlib.util.module_from_spec(_SPEC)
assert _SPEC and _SPEC.loader
_SPEC.loader.exec_module(_merge)  # type: ignore[attr-defined]


class TestByInitiatorHa(unittest.TestCase):
    def test_extraction_sums_municipal(self):
        plans = [
            {
                "projectDetails": [
                    {
                        "phase": "established",
                        "schemeOrg": "SGAV",
                        "schemeName": "Kvælstofvådområder",
                        "nitrogenT": 0,
                        "extractionHa": 10,
                        "afforestationHa": 0,
                    }
                ],
                "sketchProjects": [],
            }
        ]
        out = _merge.compute_by_initiator_ha(plans)
        self.assertAlmostEqual(out["extraction"]["municipal"]["ha"], 10.0, places=1)

    def test_cancelled_projects_are_excluded(self):
        # legacy_enrich_phase maps cancelled MARS states to "preliminary";
        # they must not count as forundersøgelse in the initiator breakdown.
        live = {
            "phase": "preliminary",
            "pipelinePhase": "preliminary_grant",
            "isCancelled": False,
            "schemeOrg": "SGAV",
            "schemeName": "Klima-Lavbund",
            "nitrogenT": 2,
            "extractionHa": 10,
            "afforestationHa": 0,
        }
        cancelled = {**live, "pipelinePhase": "cancelled", "isCancelled": True, "extractionHa": 99}
        plans = [{"projectDetails": [live, cancelled], "sketchProjects": []}]
        out = _merge.compute_by_initiator_ha(plans)
        prelim = out["byPhase"]["preliminary"]["extraction"]
        self.assertAlmostEqual(sum(prelim[k]["ha"] for k in prelim), 10.0, places=1)
        self.assertEqual(sum(prelim[k]["projectCount"] for k in prelim), 1)


if __name__ == "__main__":
    unittest.main()
