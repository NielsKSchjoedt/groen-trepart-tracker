"""
Tests for the MARS official-WFS mapping (mars_wfs.py).
Run: cd etl && python3 -m unittest test_mars_wfs -v

Guards the facts the WFS switch relies on (verified against REST on 2026-11-06):
1. A `mars:projekter_samlet` row maps 1:1 onto a REST /status/projects row
   (status by state name, scheme/measure by name, effects/area unchanged, None kept).
2. Rows the nightly WFS snapshot does not reflect yet are detected and taken from REST.
3. Forest sub-polygons replace REST supplementaryGeometries (type id by title).
4. GeoJSON → WKT keeps the REST layout, so the geometry pipeline parses it unchanged.
"""

import unittest

from fetch_geometries import parse_wkt_multipolygon
from mars_wfs import (
    build_lookups,
    geojson_to_wkt,
    merge_with_rest_fallback,
    plan_rows_by_project,
    stale_project_ids,
    supplementary_from_forest,
    wfs_project_row,
)

MASTER = {
    "states": [
        {"stateNr": 6, "name": "Forundersøgelsestilsagn"},
        {"stateNr": 10, "name": "Etableringstilsagn"},
        {"stateNr": 15, "name": "Anlagt"},
        # MARS has duplicate state names outside the formal phases.
        {"stateNr": 31, "name": "Udbetaling • Anmodet"},
        {"stateNr": 33, "name": "Udbetaling • Anmodet"},
    ],
    "subsidySchemes": [
        {"id": "sch-skov", "name": "Skovrejsning", "supplementaryGeometryTypes": [
            {"id": "t-uroert", "title": "Urørt skov"},
            {"id": "t-tilskud", "title": "Tilskudsberettiget areal"},
        ]},
        {"id": "sch-kla", "name": "KLA-Kvælstofvådområder"},
    ],
    "mitigationMeasures": [
        {"id": "m-skov", "name": "Skovrejsning"},
        {"id": "m-kva", "name": "Kvælstofvådområder"},
    ],
}

WFS_PROPS = {
    "mars_id": "p1",
    "titel": "Små vådområder Loddenhøj TJ46",
    "sags_id": "2026-5220",
    "areal_ha": 1.0532920644244486,
    "tilskudsordning": "KLA-Kvælstofvådområder",
    "status": "Forundersøgelsestilsagn",
    "ansoeger": "Middelfart Kommune",
    "ansoegningsrunde_aar": 2026,
    "kvaelstofeffekt_t": 0.09479628579804908,
    "udtagningseffekt_ha": None,
    "skovrejsningseffekt_ha": None,
    "forundersoegelsestilsagn_dato": "2026-05-28T11:32:46.407Z",
    "etableringstilsagn_dato": None,
    "anlaegelse_dato": None,
    "updated": "2026-11-06T01:00:00.001Z",
    "virkemiddel": "Kvælstofvådområder",
}

PLAN_ROW = {
    "projectId": "p1", "projectStatus": 6, "geoLocationId": "g1",
    "applicationTimestamp": "2026-02-13T12:00:00+00:00",
    "lastStateChanged": "2026-05-28T11:32:46.407807+00:00",
    "includedEffectRewetting": False,
}


def forest_row(mars_id, gtype, area, name=None):
    return {"properties": {"mars_id": mars_id, "geometri_type": gtype,
                           "geometri_navn": name, "areal_ha": area}}


class LookupTest(unittest.TestCase):
    def test_formal_states_win_and_duplicates_are_dropped(self) -> None:
        lk = build_lookups(MASTER)
        self.assertEqual(lk["state"]["Anlagt"], 15)
        self.assertNotIn("Udbetaling • Anmodet", lk["state"])
        self.assertEqual(lk["scheme"]["Skovrejsning"], "sch-skov")
        self.assertEqual(lk["supplType"]["Urørt skov"], "t-uroert")


class ProjectRowTest(unittest.TestCase):
    def test_maps_onto_rest_shape(self) -> None:
        row = wfs_project_row(WFS_PROPS, build_lookups(MASTER), PLAN_ROW)
        self.assertEqual(row["projectId"], "p1")
        self.assertEqual(row["projectStatus"], 6)
        self.assertEqual(row["subsidySchemeId"], "sch-kla")
        self.assertEqual(row["mitigationMeasureId"], "m-kva")
        self.assertEqual(row["nitrogenReductionT"], 0.09479628579804908)
        self.assertIsNone(row["extractionEffortHa"])  # None stays None, as in REST
        self.assertEqual(row["overlappingAreaHa"], 1.0532920644244486)
        self.assertEqual(row["geoLocationId"], "g1")
        self.assertEqual(row["applicationTimestamp"], PLAN_ROW["applicationTimestamp"])
        self.assertEqual(row["lastStateChanged"], PLAN_ROW["lastStateChanged"])
        self.assertEqual(row["forundersoegelsestilsagnDato"], "2026-05-28T11:32:46.407000+00:00")
        self.assertIsNone(row["anlaegelseDato"])
        self.assertEqual(row["sagsId"], "2026-5220")
        self.assertIsNone(row["supplementaryGeometries"])

    def test_last_state_changed_from_phase_date_without_plan_row(self) -> None:
        row = wfs_project_row(WFS_PROPS, build_lookups(MASTER), None)
        self.assertEqual(row["lastStateChanged"], "2026-05-28T11:32:46.407000+00:00")
        self.assertIsNone(row["geoLocationId"])

    def test_forest_sub_polygons_become_supplementary_geometries(self) -> None:
        rows = [
            forest_row("p1", "Projektpolygon", 4.2),
            forest_row("p1", "Urørt skov", 1.3, "Urørt skov 2"),
            forest_row("p1", "Tilskudsberettiget areal", 4.0),
        ]
        sup = supplementary_from_forest(rows, build_lookups(MASTER))
        self.assertEqual(len(sup), 2)  # project outline itself is not a sub-polygon
        uroert = [g for g in sup if g["supplementaryGeometryTypeId"] == "t-uroert"]
        self.assertEqual(uroert[0]["areaHa"], 1.3)
        self.assertEqual(uroert[0]["name"], "Urørt skov 2")
        self.assertIsNone(supplementary_from_forest([forest_row("p1", "Projektpolygon", 1)], build_lookups(MASTER)))


class ReconcileTest(unittest.TestCase):
    def setUp(self) -> None:
        lk = build_lookups(MASTER)
        self.wfs = {"p1": wfs_project_row(WFS_PROPS, lk, PLAN_ROW),
                    "p3": wfs_project_row({**WFS_PROPS, "mars_id": "p3"}, lk, {**PLAN_ROW, "projectId": "p3"})}
        self.plans = [{"projects": [
            PLAN_ROW,
            {**PLAN_ROW, "projectId": "p2", "geoLocationId": "g2"},   # created after the snapshot
            {**PLAN_ROW, "projectId": "p3", "projectStatus": 10},     # status changed after it
        ]}]

    def test_detects_new_and_changed_projects(self) -> None:
        stale = stale_project_ids(self.wfs, plan_rows_by_project(self.plans))
        self.assertEqual(stale, {"p2", "p3"})

    def test_unmappable_name_is_stale(self) -> None:
        lk = build_lookups(MASTER)
        bad = {"p1": wfs_project_row({**WFS_PROPS, "tilskudsordning": "Ny ordning"}, lk, PLAN_ROW)}
        self.assertEqual(stale_project_ids(bad, plan_rows_by_project([{"projects": [PLAN_ROW]}])), {"p1"})

    def test_stale_rows_come_from_rest(self) -> None:
        rest = [
            {"projectId": "p1", "projectStatus": 6},
            {"projectId": "p2", "projectStatus": 6, "geoLocationId": "g2"},
            {"projectId": "p3", "projectStatus": 10},
        ]
        rows = {r["projectId"]: r for r in merge_with_rest_fallback(self.wfs, {"p2", "p3"}, rest)}
        self.assertEqual(rows["p1"]["source"], "wfs")
        self.assertEqual(rows["p2"]["source"], "rest-fallback")
        self.assertEqual(rows["p3"]["projectStatus"], 10)
        self.assertEqual(rows["p3"]["sagsId"], "2026-5220")  # WFS history kept on fallback rows

    def test_without_rest_wfs_rows_are_kept(self) -> None:
        rows = merge_with_rest_fallback(self.wfs, {"p2", "p3"}, None)
        self.assertEqual([r["projectId"] for r in rows], ["p1", "p3"])


class GeometryTest(unittest.TestCase):
    def test_geojson_to_wkt_round_trips_through_rest_parser(self) -> None:
        geom = {"type": "MultiPolygon", "coordinates": [[
            [[558338.361345, 6141870.54896179], [558355.93842979, 6141864.5470304],
             [558400.95291521, 6141829.82157021], [558338.361345, 6141870.54896179]],
        ]]}
        wkt = geojson_to_wkt(geom)
        self.assertTrue(wkt.startswith("MULTIPOLYGON (((558338.361345 6141870.54896179, "))
        ring = parse_wkt_multipolygon(wkt)[0]
        # Parsed exactly like REST WKT (the parser drops the first vertex; the closing one remains).
        self.assertEqual(ring[0], (558355.93842979, 6141864.5470304))
        self.assertIsNone(geojson_to_wkt({"type": "Point", "coordinates": [1, 2]}))


class BuildProjectsWithoutPlansTest(unittest.TestCase):
    def test_missing_plans_uses_rest_list_not_wfs(self) -> None:
        """Without REST plans the WFS rows would lack geoLocationId — REST list instead."""
        from unittest import mock
        import fetch_mars

        rest_rows = [{"projectId": "p1", "geoLocationId": "g1"}]
        with mock.patch.object(fetch_mars.mars_wfs, "fetch_layer") as wfs, \
                mock.patch.object(fetch_mars, "fetch_endpoint", return_value=rest_rows) as rest:
            rows, info = fetch_mars.build_projects(None, MASTER)
        wfs.assert_not_called()
        rest.assert_called_once()
        self.assertEqual(rows, rest_rows)
        self.assertEqual(info["source"], "rest")


if __name__ == "__main__":
    unittest.main()
