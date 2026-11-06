"""
Tests for the derived coastal status and link handling in fetch_coastal_status.py.
Run: cd etl && python3 -m unittest test_fetch_coastal_status -v
"""

import unittest

from fetch_coastal_status import (
    official_vandplandata_url,
    simplify_status,
    status_excl_national_substances,
)

GOOD = "God økologisk tilstand"
NA = "Ikke anvendelig"


def props(**overrides):
    base = {
        "ov_navn": "Test fjord",
        "til_oko_fy": GOOD,
        "til_oko_an": GOOD,
        "til_oko_bb": GOOD,
        "til_oko_il": NA,
        "til_oko_ly": NA,
        "til_oko_ms": "Ikke-god økologisk tilstand",
    }
    base.update(overrides)
    return base


class ExclNationalSubstancesTest(unittest.TestCase):
    def test_good_when_only_national_substances_fail(self) -> None:
        self.assertEqual(status_excl_national_substances(props()), "God")

    def test_worst_biological_element_wins(self) -> None:
        self.assertEqual(
            status_excl_national_substances(props(til_oko_an="Ringe økologisk tilstand")), "Ringe"
        )

    def test_failing_supporting_element_caps_at_moderat(self) -> None:
        self.assertEqual(simplify_status("Understøtter ikke god økologisk tilstand"), "Moderat")
        self.assertEqual(
            status_excl_national_substances(props(til_oko_il="Understøtter ikke god økologisk tilstand")),
            "Moderat",
        )

    def test_unrecognised_label_is_never_ignored(self) -> None:
        # An unknown label could be a failing grade: the water must not count as good.
        self.assertEqual(
            status_excl_national_substances(props(til_oko_bb="Helt ny vurderingstekst")), "Ukendt"
        )


class VandplandataLinkTest(unittest.TestCase):
    def test_keeps_https_vandplandata_links(self) -> None:
        url = "https://vandplandata.dk/vp3_2endelig2025/DKCOAST1"
        self.assertEqual(official_vandplandata_url(url), url)

    def test_drops_other_hosts_and_schemes(self) -> None:
        for bad in (
            "http://vandplandata.dk/x",
            "https://vandplandata.dk.evil.example/x",
            "javascript:alert(1)",
            "https://example.com/x",
            "",
            None,
        ):
            self.assertIsNone(official_vandplandata_url(bad), bad)


if __name__ == "__main__":
    unittest.main()
