"""
Tests for kommune attribution and MARS count semantics.
Run: cd etl && python3 -m unittest test_kommune_attribution -v

Guards three facts established in the 2026-10 number audit:
1. Kommune figures come from MARS's kommune-clipped rows (no geocoding).
2. MARS's countAssessedProjects = etableringstilsagn (status 10) and
   countApprovedProjects = forundersøgelse (status 6) — the reverse of the words.
3. Point → kommune lookup works offline (DAWA is shut down).
"""

import json
import unittest
from pathlib import Path

from kommune_lookup import KommuneLookup
from mars_municipality import aggregate_by_kommune, name_to_kode, project_attribution

REPO = Path(__file__).resolve().parent.parent

KOMMUNER = [{"navn": "Aalborg", "kode": "0851"}, {"navn": "Jammerbugt", "kode": "0849"}]

# One project (p1) spanning two kommuner, one sketch, one ekstensivering entry.
MUNICIPALITIES = [
    {
        "name": "Aalborg",
        "projects": [
            {"projectId": "p1", "projectStatus": 10, "nitrogenReductionT": 3.0,
             "extractionEffortHa": 30.0, "afforestationEffortHa": 0.0, "overlappingAreaHa": 30.0},
        ],
        "sketchProjects": [
            {"sketchProjectId": "s1", "nitrogenReductionT": 1.0, "extractionEffortHa": 5.0,
             "afforestationEffortHa": 0.0, "overlappingAreaHa": 5.0},
        ],
        "permanentEkstensiveringProjects": [{"nitrogenReductionT": 0.4}],
    },
    {
        "name": "Jammerbugt",
        "projects": [
            {"projectId": "p1", "projectStatus": 10, "nitrogenReductionT": 1.0,
             "extractionEffortHa": 10.0, "afforestationEffortHa": 0.0, "overlappingAreaHa": 10.0},
            {"projectId": "p2", "projectStatus": 6, "nitrogenReductionT": 0.0,
             "extractionEffortHa": 0.0, "afforestationEffortHa": 2.0, "overlappingAreaHa": 2.0},
        ],
        "sketchProjects": [],
        "permanentEkstensiveringProjects": [],
    },
]


class MarsMunicipalityTest(unittest.TestCase):
    def setUp(self) -> None:
        self.k2 = name_to_kode(KOMMUNER)

    def test_clipped_values_sum_per_kommune(self) -> None:
        agg = aggregate_by_kommune(MUNICIPALITIES, self.k2)
        self.assertEqual(agg["0851"]["byPhase"]["approved"]["extractionHa"], 30.0)
        self.assertEqual(agg["0849"]["byPhase"]["approved"]["extractionHa"], 10.0)
        # A two-kommune project counts once in each kommune — as MARS's kommune pages do.
        self.assertEqual(agg["0851"]["byPhase"]["approved"]["count"], 1)
        self.assertEqual(agg["0849"]["byPhase"]["approved"]["count"], 1)

    def test_status_buckets(self) -> None:
        agg = aggregate_by_kommune(MUNICIPALITIES, self.k2)
        self.assertEqual(agg["0849"]["byPhase"]["preliminary"]["count"], 1)  # status 6
        self.assertEqual(agg["0849"]["phases"]["assessed"], 1)  # legacy key for forundersøgelse
        self.assertEqual(agg["0851"]["byPhase"]["sketch"]["count"], 1)
        self.assertAlmostEqual(agg["0851"]["permanentEkstensiveringT"], 0.4)

    def test_primary_kommune_is_largest_share(self) -> None:
        projects, sketches = project_attribution(MUNICIPALITIES, self.k2)
        self.assertEqual(projects["p1"]["primaryKode"], "0851")
        self.assertEqual(projects["p1"]["koder"], ["0851", "0849"])
        self.assertEqual(projects["p2"]["primaryKode"], "0849")
        self.assertEqual(sketches["s1"]["primaryKode"], "0851")


class MarsCountSemanticsTest(unittest.TestCase):
    """Live-data invariant on the committed MARS snapshot. If MARS ever renames these
    fields to mean what they say, this fails — and the swap in build_dashboard_data.py
    and fetch_mars.py must be removed."""

    def _check(self, path: Path) -> None:
        if not path.exists():
            self.skipTest(f"{path.name} not present")
        rows_seen = 0
        for container in json.loads(path.read_text(encoding="utf-8")):
            rows = container.get("projects") or []
            if not rows:
                continue
            rows_seen += 1
            n = {st: sum(1 for r in rows if r.get("projectStatus") == st) for st in (6, 10, 15)}
            name = container.get("name")
            self.assertEqual(container.get("countAssessedProjects"), n[10], f"{name}: assessed ≠ status 10")
            self.assertEqual(container.get("countApprovedProjects"), n[6], f"{name}: approved ≠ status 6")
            self.assertEqual(container.get("countEstablishedProjects"), n[15], f"{name}: established ≠ status 15")
        self.assertGreater(rows_seen, 0)

    def test_plans(self) -> None:
        self._check(REPO / "data" / "mars" / "plans.json")

    def test_catchments(self) -> None:
        self._check(REPO / "data" / "mars" / "vos.json")


class KommuneLookupTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.lookup = KommuneLookup.load()

    def test_known_points(self) -> None:
        self.assertEqual(self.lookup.find(10.388, 55.396)["kode"], "0461")  # Odense
        self.assertEqual(self.lookup.find(12.57, 55.68)["kode"], "0101")  # København
        self.assertEqual(self.lookup.find(14.70, 55.10)["kode"], "0400")  # Bornholm

    def test_sea_is_none(self) -> None:
        self.assertIsNone(self.lookup.find(11.0, 56.5))  # Kattegat

    def test_coastal_point_snaps(self) -> None:
        # Just off Odense Fjord's simplified shoreline — must not be dropped.
        hit = self.lookup.find(10.52, 55.47)
        self.assertIsNotNone(hit)


if __name__ == "__main__":
    unittest.main()
