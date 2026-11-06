"""Tests for etl/fetch_dawa.py (kommune boundaries: live DAGI sources + archive fallback).

Run: python -m unittest etl/test_fetch_dawa.py  (from the repo root, or inside etl/)
No network: live sources are replaced with stubs.
"""

from __future__ import annotations

import copy
import json
import lzma
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import fetch_dawa as fd  # noqa: E402


def square(x0: float, y0: float, size: float) -> dict:
    ring = [[x0, y0], [x0 + size, y0], [x0 + size, y0 + size], [x0, y0 + size], [x0, y0]]
    return {"type": "MultiPolygon", "coordinates": [[ring]]}


def make_archive() -> tuple[dict, list[dict]]:
    """Two kommuner plus Christiansø, in the archive's (DAWA) schema."""
    feats, meta = [], []
    for kode, navn, x0 in (("0101", "København", 720000.0), ("0147", "Frederiksberg", 730000.0),
                           ("0411", "Christiansø", 890000.0)):
        geom = square(x0, 6170000.0, 5000.0)
        feats.append({
            "type": "Feature",
            "geometry": geom,
            "properties": {"kode": kode, "navn": navn, "regionskode": "1084",
                           "regionsnavn": "Region Hovedstaden", "ændret": "x", "geo_ændret": "x",
                           "visueltcenter_x": x0 + 2500.0, "visueltcenter_y": 6172500.0},
            "bbox": fd.geometry_bbox(geom),
        })
        meta.append({"ændret": "x", "geo_ændret": "x", "bbox": fd.wgs84_bbox(geom),
                     "visueltcenter": [round(v, 8) for v in fd.utm32n_to_wgs84(x0 + 2500.0, 6172500.0)],
                     "kode": kode, "navn": navn, "regionskode": "1084",
                     "region": {"kode": "1084", "navn": "Region Hovedstaden"}})
    fc = {"type": "FeatureCollection", "crs": {"type": "name", "properties": {"name": "EPSG:25832"}},
          "features": feats}
    return fc, meta


def live_from(fc: dict, skip=("0411",)) -> dict[str, dict]:
    return {f["properties"]["kode"]: {"navn": f["properties"]["navn"], "geometry": copy.deepcopy(f["geometry"])}
            for f in fc["features"] if f["properties"]["kode"] not in skip}


class HelperTests(unittest.TestCase):
    def test_parse_features_normalises_codes(self):
        fc = {"features": [{"properties": {"komnr": 101, "kommunenavn": "København"}, "geometry": square(0, 0, 1)}]}
        out = fd.parse_features(fc, ("komnr",), ("kommunenavn",))
        self.assertEqual(list(out), ["0101"])
        self.assertEqual(out["0101"]["navn"], "København")

    def test_parse_features_rejects_duplicates(self):
        f = {"properties": {"komnr": "0101", "kommunenavn": "A"}, "geometry": square(0, 0, 1)}
        with self.assertRaises(fd.SourceError):
            fd.parse_features({"features": [f, f]}, ("komnr",), ("kommunenavn",))

    def test_geometry_equal_tolerates_float_noise(self):
        a = square(723835.69, 6181946.53, 100)
        b = copy.deepcopy(a)
        b["coordinates"][0][0][1][0] = 723935.690000001
        self.assertTrue(fd.geometry_equal(a, b))
        b["coordinates"][0][0][1][0] += 0.5
        self.assertFalse(fd.geometry_equal(a, b))

    def test_polylabel_is_inside_and_central(self):
        geom = square(0, 0, 1000)
        x, y = fd.visual_centre(geom)
        self.assertAlmostEqual(x, 500, delta=15)
        self.assertAlmostEqual(y, 500, delta=15)

    def test_utm_conversion_known_point(self):
        # Archive: København visueltcenter 719519.814/6178678.776 ↔ 12.49390862, 55.7040906
        lon, lat = fd.utm32n_to_wgs84(719519.814, 6178678.776)
        self.assertAlmostEqual(lon, 12.49390862, places=5)
        self.assertAlmostEqual(lat, 55.7040906, places=5)


class MergeTests(unittest.TestCase):
    def test_unchanged_live_layer_changes_nothing(self):
        fc, meta = make_archive()
        before = (json.dumps(fc), json.dumps(meta))
        self.assertEqual(fd.merge_live(fc, meta, live_from(fc), "T"), [])
        self.assertEqual((json.dumps(fc), json.dumps(meta)), before)

    def test_changed_geometry_and_name_update_only_that_kommune(self):
        fc, meta = make_archive()
        live = live_from(fc)
        live["0147"]["geometry"] = square(730000.0, 6170000.0, 6000.0)
        live["0147"]["navn"] = "Frederiksberg Ny"
        changes = fd.merge_live(fc, meta, live, "T")
        self.assertEqual([c["kode"] for c in changes], ["0147"])
        self.assertTrue(changes[0]["geometry_changed"] and changes[0]["name_changed"])
        self.assertAlmostEqual(changes[0]["area_change_pct"], 44.0, places=3)
        m = {x["kode"]: x for x in meta}
        self.assertEqual(m["0147"]["navn"], "Frederiksberg Ny")
        self.assertEqual(m["0147"]["bbox"], fd.wgs84_bbox(square(730000.0, 6170000.0, 6000.0)))
        self.assertEqual(m["0147"]["region"]["navn"], "Region Hovedstaden")  # region kept
        self.assertEqual(m["0101"]["ændret"], "x")  # untouched
        f = {x["properties"]["kode"]: x for x in fc["features"]}
        self.assertAlmostEqual(f["0147"]["properties"]["visueltcenter_x"], 733000, delta=20)

    def test_unknown_or_missing_kommune_rejects_source_without_mutation(self):
        fc, meta = make_archive()
        before = json.dumps(fc)
        live = live_from(fc)
        live["9999"] = {"navn": "Ny", "geometry": square(0, 0, 1)}
        with self.assertRaises(fd.SourceError):
            fd.merge_live(fc, meta, live, "T")
        live = live_from(fc, skip=("0411", "0147"))
        with self.assertRaises(fd.SourceError):
            fd.merge_live(fc, meta, live, "T")
        self.assertEqual(json.dumps(fc), before)


class MainTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        d = Path(self.tmp.name)
        fc, meta = make_archive()
        self.fc = fc
        with lzma.open(d / "kommuner.geojson.xz", "wb") as f:
            f.write(json.dumps(fc, ensure_ascii=False, indent=2).encode())
        (d / "kommuner.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        (d / "kommuner.csv").write_text(
            "kode|navn|regionskode|regionsnavn|centerLon|centerLat\n"
            + "".join(f"{m['kode']}|{m['navn']}|1084|Region Hovedstaden|{m['visueltcenter'][0]}|{m['visueltcenter'][1]}\n"
                      for m in meta), encoding="utf-8")
        self.patches = [
            mock.patch.multiple(fd, DATA_DIR=d, META_PATH=d / "kommuner.json", CSV_PATH=d / "kommuner.csv",
                                GEO_PATH=d / "kommuner.geojson", GEO_ARCHIVE=d / "kommuner.geojson.xz",
                                SUMMARY_PATH=d / "summary.json", EXPECTED_KOMMUNER=3,
                                log_etl_run=mock.Mock()),
            mock.patch.dict("os.environ", {"DATAFORDELER_API_KEY": ""}),
        ]
        for p in self.patches:
            p.start()
        self.d = d

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.tmp.cleanup()

    def test_falls_back_to_archive_when_offline(self):
        archive_bytes = (self.d / "kommuner.geojson.xz").read_bytes()
        with mock.patch.object(fd, "fetch_plandata", side_effect=fd.SourceError("offline")):
            self.assertEqual(fd.main(), 0)
        s = json.loads((self.d / "summary.json").read_text())
        self.assertEqual(s["source"], "archive")
        self.assertEqual(s["source_errors"], ["plandata: offline"])
        self.assertEqual((self.d / "kommuner.geojson.xz").read_bytes(), archive_bytes)
        self.assertTrue((self.d / "kommuner.geojson").exists())
        fd.log_etl_run.assert_called_once()
        self.assertEqual(fd.log_etl_run.call_args.kwargs["status"], "partial")

    def test_unchanged_live_source_leaves_archive_bytes_untouched(self):
        files = {n: (self.d / n).read_bytes() for n in ("kommuner.geojson.xz", "kommuner.json", "kommuner.csv")}
        with mock.patch.object(fd, "fetch_plandata", return_value=live_from(self.fc)):
            self.assertEqual(fd.main(), 0)
        for n, b in files.items():
            self.assertEqual((self.d / n).read_bytes(), b, n)
        s = json.loads((self.d / "summary.json").read_text())
        self.assertEqual((s["source"], s["changed_kommuner"], s["christiansoe_from_archive"]), ("plandata", [], True))

    def test_changed_live_source_rewrites_outputs(self):
        csv_path = self.d / "kommuner.csv"
        csv_path.write_text("\n".join(
            "0147|Frederiksberg|1084|Region Hovedstaden|1.5|2.5" if line.startswith("0147|") else line
            for line in csv_path.read_text().splitlines()) + "\n")
        live = live_from(self.fc)
        live["0101"]["geometry"] = square(720000.0, 6170000.0, 4000.0)
        with mock.patch.object(fd, "fetch_plandata", return_value=live):
            self.assertEqual(fd.main(), 0)
        with lzma.open(self.d / "kommuner.geojson.xz") as f:
            fc = json.load(f)
        g = {x["properties"]["kode"]: x for x in fc["features"]}
        self.assertEqual(g["0101"]["geometry"], square(720000.0, 6170000.0, 4000.0))
        self.assertEqual(g["0411"]["geometry"], self.fc["features"][2]["geometry"])  # Christiansø kept
        csv_rows = (self.d / "kommuner.csv").read_text().splitlines()
        meta = {m["kode"]: m for m in json.loads((self.d / "kommuner.json").read_text())}
        self.assertIn(f"0101|København|1084|Region Hovedstaden|{meta['0101']['visueltcenter'][0]}|"
                      f"{meta['0101']['visueltcenter'][1]}", csv_rows)
        self.assertIn("0147|Frederiksberg|1084|Region Hovedstaden|1.5|2.5", csv_rows)  # unchanged row kept
        self.assertEqual(json.loads((self.d / "kommuner.geojson").read_text()), fc)


if __name__ == "__main__":
    unittest.main()
