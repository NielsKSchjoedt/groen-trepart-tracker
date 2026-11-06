#!/usr/bin/env python3
"""
Build a per-kommune "ansvar" (fair share of the national goal) for each of the
three Grøn Trepart delivery goals — the denominator of the kommune rankings.

There is no official per-kommune split of the goals. The finest official split
is MARS' 37 kystvandoplande (plans): each carries an N-reduction goal (summing
to the national 12.776 t) and a lavbund extraction potential (ha). Each plan's
figure is distributed to the kommuner that overlap it:

* Kvælstof: plan N goal × the kommune's share of the plan's *farmland*
  (overlap area × the kommune's farmland density, DST AREALDK "Landbrugsafgrøder").
  N reduction comes from agricultural land, so urban overlap carries ~no weight.
* Lavbund: plan extraction potential × the kommune's share of the plan's
  *carbon-rich soil* (DCA 2022 kulstofkort, 6–12 % and > 12 % classes), read
  as vector polygons from Miljøministeriet's official MiljøGIS WFS
  (wfs2-miljoegis.mim.dk, natur:kulstof2022).
  Plans with no mapped carbon soil fall back to the farmland weight.
* Skov: the forest goal (250.000 ha) has no geographic split at all; new forest
  is planted on farmland, so ansvar = the kommune's share of national farmland.

All overlaps are exact vector areas in EPSG:25832: kommune × plan pieces (also
used for the farmland weights, previously a 50 m raster) are intersected with the
kulstofkort's 10 m polygons. (Until Nov 2026 the kulstofkort
was read from a WMS *picture* and every pixel with any opacity counted as carbon
soil; anti-aliased edges made that overcount 3–20× and unevenly between kommuner.)
The 3–6 % class (natur:kulstof2022_3_6_pct) is deliberately left out: the map,
legend and the agreement's lavbund target use ≥ 6 %. The farmland-density weight
on carbon soil is unrelated to the old pixel artefact (it discounts bogs and
reserves in urban/nature kommuner) and is kept unchanged.

Output: kommune-ansvar.json (data/ + public/data/kommune-benchmark/).
Runs in the monthly spatial-overlay workflow (needs requirements-spatial.txt).
"""
from __future__ import annotations

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

SCRIPT_DIR = Path(__file__).resolve().parent
REPO = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

try:
    import geopandas as gpd
    import numpy as np
    import shapely
    from shapely import STRtree
    from shapely import wkt as shapely_wkt
    from shapely.geometry import MultiPolygon, Polygon, box, shape
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Run: mise run setup-spatial") from exc

from etl_log import log_etl_run
from spatial_overlay import METRIC_CRS

KOMMUNER_PATH = REPO / "data" / "dawa" / "kommuner.geojson"
PLANS_PATH = REPO / "data" / "mars" / "plans.json"
MASTER_DATA_PATH = REPO / "data" / "mars" / "master-data.json"
DST_LANDBRUG_PATH = REPO / "data" / "dst" / "arealdk-landbrug.json"
CACHE_DIR = REPO / "data" / "spatial-overlays" / "cache" / "kommune-ansvar"
OUT_DIR = REPO / "data" / "kommune-benchmark"
PUBLIC_OUT_DIR = REPO / "public" / "data" / "kommune-benchmark"

METHOD_VERSION = "ansvar-v2"
EXCLUDED_KODER = {"0411"}
USER_AGENT = (
    "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; "
    "open-source environmental monitor)"
)
MARS_BASE = "https://mars.sgav.dk/api"
DST_BASE = "https://api.statbank.dk/v1"
KULSTOF_WFS = "https://wfs2-miljoegis.mim.dk/natur/ows"
KULSTOF_LAYER = "natur:kulstof2022"  # gridcode 12 = 6–12 % tørv, 60 = > 12 %
KULSTOF_CLASSES = {12: "6til12", 60: "Over12"}

# Denmark incl. Bornholm as 100 km start tiles, split in quadrants until each
# WFS request returns at most WFS_MAX_FEATURES polygons.
TILE_M = 100_000
GRID_X0, GRID_Y0 = 440_000, 6_040_000
TILES_X, TILES_Y = 5, 4
WFS_MAX_FEATURES = 50_000
SUBDIVIDE_M = 5_000


def _http_get(url: str, accept: str = "application/json", timeout: int = 120) -> bytes:
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    for attempt in range(4):
        try:
            with urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except (HTTPError, URLError, OSError) as err:
            if attempt == 3:
                raise
            print(f"  ↻ retry {attempt + 1} for {url[:90]}… ({err})")
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("unreachable")


def write_json_both(relative_name: str, data: dict[str, Any]) -> None:
    for base in (OUT_DIR, PUBLIC_OUT_DIR):
        base.mkdir(parents=True, exist_ok=True)
        (base / relative_name).write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )


# --- Inputs -----------------------------------------------------------------


def load_plans() -> list[dict[str, Any]]:
    plans = json.loads(PLANS_PATH.read_text(encoding="utf-8"))
    return [
        {
            "name": p["name"],
            "geoId": p["geoLocationId"],
            "nGoalT": float(p.get("nitrogenReductionGoalT") or 0),
            "lavbundPotentialHa": float(p.get("extractionPotentialHa") or 0),
        }
        for p in plans
        if isinstance(p, dict) and p.get("geoLocationId")
    ]


def plan_geometry(geo_id: str) -> Polygon | MultiPolygon:
    """MARS plan polygon (EPSG:25832 WKT), cached on disk between runs."""
    path = CACHE_DIR / "plans" / f"{geo_id}.wkt"
    if not path.exists():
        payload = json.loads(_http_get(f"{MARS_BASE}/geometries/{geo_id}"))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(payload["geometryWkt"], encoding="utf-8")
    # make_valid, not buffer(0): buffer(0) drops parts of some self-touching MARS rings.
    return _polygonal(shapely_wkt.loads(path.read_text(encoding="utf-8")))


def load_landbrug_ha(refresh: bool) -> dict[str, float]:
    """DST AREALDK category D (Landbrugsafgrøder), latest year, ha per kommune kode."""
    if DST_LANDBRUG_PATH.exists() and not refresh:
        return json.loads(DST_LANDBRUG_PATH.read_text(encoding="utf-8"))["byKommune"]

    info = json.loads(_http_post(f"{DST_BASE}/tableinfo", {"table": "AREALDK", "lang": "da"}))
    years = [v["id"] for v in next(v for v in info["variables"] if v["id"] == "Tid")["values"]]
    latest = max(years)
    body = {
        "table": "AREALDK",
        "format": "JSONSTAT",
        "lang": "da",
        "variables": [
            {"code": "ARE1", "values": ["D"]},
            {"code": "OMRÅDE", "values": ["*"]},
            {"code": "ENHED", "values": ["0120"]},
            {"code": "Tid", "values": [latest]},
        ],
    }
    stat = json.loads(_http_post(f"{DST_BASE}/data", body))["dataset"]
    areas = stat["dimension"]["OMRÅDE"]["category"]["index"]
    values = stat["value"]
    by_kode: dict[str, float] = {}
    for area_id, pos in areas.items():
        # Kommune codes are 3 digits; skip regions (08x), LAND, IKMAK, 000.
        if not (area_id.isdigit() and len(area_id) == 3 and not area_id.startswith("08")) or area_id == "000":
            continue
        km2 = values[pos]
        if km2 is not None:
            by_kode[area_id.zfill(4)] = round(float(km2) * 100, 1)
    DST_LANDBRUG_PATH.write_text(
        json.dumps(
            {
                "table": "AREALDK",
                "category": "D — Landbrugsafgrøder",
                "year": latest,
                "unit": "ha",
                "fetchedAt": datetime.now(timezone.utc).isoformat(),
                "byKommune": by_kode,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    return by_kode


def _http_post(url: str, body: dict[str, Any]) -> bytes:
    req = Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"User-Agent": USER_AGENT, "Content-Type": "application/json"},
    )
    with urlopen(req, timeout=120) as resp:
        return resp.read()


# --- Kulstofkort (WFS) ----------------------------------------------------------


def _wfs_url(**params: Any) -> str:
    base = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": KULSTOF_LAYER,
        "srsName": METRIC_CRS,
    }
    return f"{KULSTOF_WFS}?{urlencode({**base, **params})}"


def _bbox_param(bbox: tuple[int, int, int, int]) -> str:
    return f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]},{METRIC_CRS}"


def _wfs_hits(bbox: tuple[int, int, int, int]) -> int:
    body = _http_get(_wfs_url(resultType="hits", bbox=_bbox_param(bbox)), accept="application/xml")
    match = re.search(rb'numberMatched="(\d+)"', body)
    if not match:
        raise SystemExit(f"Kulstof WFS: no numberMatched for bbox {bbox}: {body[:300]!r}")
    return int(match.group(1))


def _leaf_tiles(bbox: tuple[int, int, int, int]) -> list[tuple[int, int, int, int]]:
    """Split bbox into quadrants until each holds at most WFS_MAX_FEATURES features."""
    n = _wfs_hits(bbox)
    if n == 0:
        return []
    if n <= WFS_MAX_FEATURES:
        return [bbox]
    x0, y0, x1, y1 = bbox
    xm, ym = (x0 + x1) // 2, (y0 + y1) // 2
    out: list[tuple[int, int, int, int]] = []
    for q in ((x0, y0, xm, ym), (xm, y0, x1, ym), (x0, ym, xm, y1), (xm, ym, x1, y1)):
        out += _leaf_tiles(q)
    return out


def _fetch_tile(bbox: tuple[int, int, int, int], path: Path) -> None:
    """One WFS GetFeature for a tile, stored as feature ids + gridcode + WKB (npz)."""
    payload = json.loads(
        _http_get(
            _wfs_url(outputFormat="application/json", count=WFS_MAX_FEATURES, bbox=_bbox_param(bbox)),
            timeout=600,
        )
    )
    feats = payload["features"]
    matched = payload.get("numberMatched")
    if isinstance(matched, int) and matched != len(feats):
        raise SystemExit(f"Kulstof WFS tile {bbox}: got {len(feats)} of {matched} features")
    ids = np.array([int(f["id"].rsplit(".", 1)[1]) for f in feats], dtype=np.int64)
    codes = np.array([int(f["properties"]["gridcode"]) for f in feats], dtype=np.int16)
    wkb = shapely.to_wkb([shape(f["geometry"]) for f in feats])
    offsets = np.cumsum([0] + [len(b) for b in wkb], dtype=np.int64)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp.npz")
    np.savez_compressed(
        tmp, ids=ids, codes=codes, offsets=offsets, wkb=np.frombuffer(b"".join(wkb), dtype=np.uint8)
    )
    tmp.replace(path)


def kulstof_features() -> tuple[np.ndarray, np.ndarray]:
    """DCA 2022 kulstofkort (>= 6 % organic carbon) as vector polygons + gridcode.

    Fetched from the official WFS in quadtree tiles of at most WFS_MAX_FEATURES
    features (one request per tile, so no reliance on server-side paging order),
    cached as npz per tile. The map is static (2022), so cached tiles are reused
    on every rerun; delete the cache dir to refetch. Polygons crossing a tile
    border are returned for both tiles and are de-duplicated on feature id.
    """
    cache = CACHE_DIR / "kulstof-wfs"
    index_path = cache / "tiles.json"
    if index_path.exists():
        tiles = [tuple(t) for t in json.loads(index_path.read_text(encoding="utf-8"))]
    else:
        print("  Kulstof WFS: planlægger fliser …")
        tiles = []
        for ty in range(TILES_Y):
            for tx in range(TILES_X):
                x0, y0 = GRID_X0 + tx * TILE_M, GRID_Y0 + ty * TILE_M
                tiles += _leaf_tiles((x0, y0, x0 + TILE_M, y0 + TILE_M))
        cache.mkdir(parents=True, exist_ok=True)
        index_path.write_text(json.dumps(tiles), encoding="utf-8")

    ids_all, codes_all, geoms_all = [], [], []
    for i, bbox in enumerate(tiles):
        path = cache / f"{bbox[0]}_{bbox[1]}_{bbox[2]}_{bbox[3]}.npz"
        if not path.exists():
            print(f"  Kulstof WFS: henter flise {i + 1}/{len(tiles)} {bbox}")
            _fetch_tile(bbox, path)
        with np.load(path) as z:
            blob, offsets = z["wkb"].tobytes(), z["offsets"]
            ids_all.append(z["ids"])
            codes_all.append(z["codes"])
        geoms_all.append(
            shapely.from_wkb([blob[offsets[j] : offsets[j + 1]] for j in range(len(offsets) - 1)])
        )
    ids = np.concatenate(ids_all)
    codes = np.concatenate(codes_all)
    geoms = np.concatenate(geoms_all)
    _, first = np.unique(ids, return_index=True)
    geoms, codes = geoms[first], codes[first]
    # ~3 % of the raster-derived rings self-touch at a corner; make_valid keeps the
    # area unchanged but makes GEOS intersections reliable.
    invalid = ~shapely.is_valid(geoms)
    geoms[invalid] = [_polygonal(g) for g in geoms[invalid]]
    print(f"  Kulstof WFS: {len(first):,} polygoner ({len(ids) - len(first):,} dubletter på flisegrænser fjernet, {int(invalid.sum()):,} gjort gyldige)")
    return geoms, codes


# --- Vector overlay -------------------------------------------------------------


def _polygonal(geom):
    """make_valid, keeping only the (multi)polygon part."""
    geom = shapely.make_valid(geom)
    if geom.geom_type in ("Polygon", "MultiPolygon"):
        return geom
    parts = [g for g in getattr(geom, "geoms", []) if g.geom_type in ("Polygon", "MultiPolygon")]
    return shapely.union_all(parts) if parts else Polygon()


def overlay_pieces(
    kommune_geoms: list, plan_geoms: list
) -> tuple[list[int], list[int], np.ndarray]:
    """Kommune × plan intersection pieces, plus each kommune's area outside all plans.

    Returns (kommune index, plan index, geometry) per piece; plan index == len(plan_geoms)
    marks the residual "outside any MARS plan" piece.
    """
    plan_tree = STRtree(plan_geoms)
    k_idx: list[int] = []
    p_idx: list[int] = []
    pieces: list = []
    n_plans = len(plan_geoms)
    for k, kg in enumerate(kommune_geoms):
        covered = []
        for p in plan_tree.query(kg, predicate="intersects"):
            piece = _polygonal(shapely.intersection(kg, plan_geoms[p]))
            if piece.is_empty or piece.area <= 0:
                continue
            k_idx.append(k)
            p_idx.append(int(p))
            pieces.append(piece)
            covered.append(piece)
        rest = _polygonal(shapely.difference(kg, shapely.union_all(covered))) if covered else kg
        if not rest.is_empty and rest.area > 0:
            k_idx.append(k)
            p_idx.append(n_plans)
            pieces.append(rest)
    return k_idx, p_idx, np.array(pieces, dtype=object)


def _subdivide(pieces: np.ndarray, cell_m: int = SUBDIVIDE_M) -> tuple[np.ndarray, np.ndarray]:
    """Cut pieces along a cell_m grid so each intersection test touches few vertices."""
    parents: list[int] = []
    parts: list = []
    for i, geom in enumerate(pieces):
        x0, y0, x1, y1 = geom.bounds
        xs = range(int(x0 // cell_m) * cell_m, int(x1) + 1, cell_m)
        ys = range(int(y0 // cell_m) * cell_m, int(y1) + 1, cell_m)
        cells = [box(x, y, x + cell_m, y + cell_m) for x in xs for y in ys]
        for cut in shapely.intersection(geom, cells):
            cut = _polygonal(cut)
            if not cut.is_empty and cut.area > 0:
                parents.append(i)
                parts.append(cut)
    return np.array(parents), np.array(parts, dtype=object)


def kulstof_area_by_piece(pieces: np.ndarray, feats: np.ndarray, codes: np.ndarray) -> dict[int, np.ndarray]:
    """Hectares of each kulstof class (gridcode) inside each piece."""
    parents, parts = _subdivide(pieces)
    shapely.prepare(parts)
    tree = STRtree(parts)
    out = {int(c): np.zeros(len(pieces)) for c in np.unique(codes)}
    chunk = 200_000
    for s in range(0, len(feats), chunk):
        f = feats[s : s + chunk]
        fi, pj = tree.query(f, predicate=None)  # bbox candidates
        inside = shapely.contains_properly(parts[pj], f[fi])
        area = shapely.area(f[fi])
        edge = ~inside
        area[edge] = shapely.area(shapely.intersection(f[fi[edge]], parts[pj[edge]]))
        c = codes[s : s + chunk][fi]
        for code, acc in out.items():
            sel = c == code
            np.add.at(acc, parents[pj[sel]], area[sel] / 10_000)
    return out


# --- Allocation ---------------------------------------------------------------


def allocate(
    totals: list[float],
    weights: np.ndarray,
    fallback: np.ndarray | None = None,
) -> np.ndarray:
    """Split each plan total (column) across kommuner (rows) by weight share."""
    out = np.zeros(weights.shape[0])
    for p, total in enumerate(totals):
        if total <= 0:
            continue
        col = weights[:, p]
        if col.sum() <= 0 and fallback is not None:
            col = fallback[:, p]
        if col.sum() <= 0:
            continue
        out += total * col / col.sum()
    return out


def build(refresh_dst: bool = False) -> dict[str, int]:
    # from_features avoids a fiona/pyogrio (GDAL) dependency for a plain GeoJSON read.
    # The DAWA file declares its CRS (EPSG:25832) in a legacy `crs` member.
    raw = json.loads(KOMMUNER_PATH.read_text(encoding="utf-8"))
    src_crs = (raw.get("crs") or {}).get("properties", {}).get("name", "EPSG:4326")
    kommuner = gpd.GeoDataFrame.from_features(raw["features"], crs=src_crs).to_crs(METRIC_CRS)
    kommuner["kode"] = kommuner["kode"].astype(str).str.zfill(4)
    kommuner = kommuner[~kommuner["kode"].isin(EXCLUDED_KODER)].reset_index(drop=True)
    koder = list(kommuner["kode"])
    navne = dict(zip(kommuner["kode"], kommuner["navn"]))

    plans = load_plans()
    print(f"  {len(kommuner)} kommuner, {len(plans)} MARS-planer")
    plan_geoms = [plan_geometry(p["geoId"]) for p in plans]
    landbrug = load_landbrug_ha(refresh_dst)
    missing = [k for k in koder if k not in landbrug]
    if missing:
        raise SystemExit(f"DST AREALDK mangler landbrugsareal for {missing}")

    kommune_geoms = [_polygonal(g) for g in kommuner.geometry]
    k_idx, p_idx, pieces = overlay_pieces(kommune_geoms, plan_geoms)
    feats, codes = kulstof_features()
    kul_by_class = kulstof_area_by_piece(pieces, feats, codes)
    unknown = set(kul_by_class) - set(KULSTOF_CLASSES)
    if unknown:
        raise SystemExit(f"Kulstof WFS: ukendt gridcode {unknown}")

    nk, np_ = len(koder), len(plans)
    # Hectares per (kommune, plan); the extra last column is land outside every plan.
    area_ha = np.zeros((nk, np_ + 1))
    np.add.at(area_ha, (k_idx, p_idx), shapely.area(pieces) / 10_000)
    kul_class_ha = {code: np.zeros((nk, np_ + 1)) for code in KULSTOF_CLASSES}
    for code, by_piece in kul_by_class.items():
        np.add.at(kul_class_ha[code], (k_idx, p_idx), by_piece)
    kul_all_ha = sum(kul_class_ha.values())
    kommune_ha = area_ha.sum(axis=1)
    nat_kul = float(kul_all_ha.sum())
    print(f"  Kulstofrig jord (≥ 6 %) i kommunerne: {nat_kul:,.0f} ha ({float(kul_all_ha[:, :np_].sum()):,.0f} ha inden for MARS-planerne)")

    # Farmland in each (kommune, plan) overlap, assuming even density within a kommune.
    density = np.array([landbrug[k] for k in koder]) / np.maximum(kommune_ha, 1)
    farmland = area_ha[:, :np_] * density[:, None]
    kulstof_ha = kul_all_ha[:, :np_]
    # The lavbund goal targets carbon-rich soil *in farming*; the kulstofkort also
    # maps bogs and reserves (e.g. Vestamager). Scale by farmland density so
    # unfarmed carbon soil in urban/nature kommuner carries little weight.
    kulstof_dyrket = kulstof_ha * np.minimum(density, 1.0)[:, None]

    n_goals = [p["nGoalT"] for p in plans]
    l_pot = [p["lavbundPotentialHa"] for p in plans]
    ansvar_n = allocate(n_goals, farmland)
    ansvar_l = allocate(l_pot, kulstof_dyrket, fallback=farmland)
    farm_total = sum(landbrug[k] for k in koder)

    n_total, l_total = sum(n_goals), sum(l_pot)
    print(f"  N fordelt: {ansvar_n.sum():,.0f} af {n_total:,.0f} t")
    print(f"  Lavbund fordelt: {ansvar_l.sum():,.0f} af {l_total:,.0f} ha")

    # Shares are taken from the plan figures; the *amounts* are shares of the
    # national goals (140.000 ha lavbund is less than the 220.000 ha potential).
    master = json.loads(MASTER_DATA_PATH.read_text(encoding="utf-8"))
    lavbund_goal = float(master["extractionEffectGoalHa"])
    skov_goal = float(master["afforestationEffortGoalHa"])
    n_goal = float(master["nitrogenReductionGoalT"])

    by_kommune: dict[str, Any] = {}
    for i, kode in enumerate(koder):
        plans_here = [
            {
                "plan": plans[p]["name"],
                "andelAfPlanLandbrugPct": round(100 * farmland[i, p] / farmland[:, p].sum(), 2)
                if farmland[:, p].sum() > 0
                else 0.0,
                "andelAfPlanKulstofPct": round(100 * kulstof_dyrket[i, p] / kulstof_dyrket[:, p].sum(), 2)
                if kulstof_dyrket[:, p].sum() > 0
                else 0.0,
            }
            for p in range(np_)
            if area_ha[i, p] >= 1
        ]
        by_kommune[kode] = {
            "kommuneNavn": navne[kode],
            "landbrugHa": landbrug[kode],
            "kulstofrigJordHa": round(float(kul_all_ha[i].sum()), 1),
            "kulstofrigJord6til12Ha": round(float(kul_class_ha[12][i].sum()), 1),
            "kulstofrigJordOver12Ha": round(float(kul_class_ha[60][i].sum()), 1),
            "ansvarKvaelstofT": round(float(n_goal * ansvar_n[i] / n_total), 2),
            "ansvarKvaelstofPct": round(float(100 * ansvar_n[i] / n_total), 4),
            "ansvarLavbundHa": round(float(lavbund_goal * ansvar_l[i] / l_total), 1),
            "ansvarLavbundPct": round(float(100 * ansvar_l[i] / l_total), 4),
            "lavbundPotentialeHa": round(float(ansvar_l[i]), 1),
            "ansvarSkovHa": round(skov_goal * landbrug[kode] / farm_total, 1),
            "ansvarSkovPct": round(100 * landbrug[kode] / farm_total, 4),
            "planer": plans_here,
        }

    write_json_both(
        "kommune-ansvar.json",
        {
            "metadata": {
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "methodVersion": METHOD_VERSION,
                "kulstofkort": f"{KULSTOF_WFS} ({KULSTOF_LAYER}, gridcode 12 og 60 = ≥ 6 % organisk kulstof)",
                "sources": [
                    "MARS: planernes kvælstofreduktionsmål og lavbundspotentiale (37 kystvandoplande)",
                    "Danmarks Statistik AREALDK: landbrugsafgrøder pr. kommune",
                    "DCA 2022 kulstofkort (Miljøministeriets WFS, natur:kulstof2022): kulstofrige lavbundsjorder ≥ 6 % kulstof",
                    "DAGI kommunegrænser",
                ],
                "method": {
                    "kvaelstof": "Planens N-mål fordelt efter kommunens andel af planens landbrugsareal.",
                    "lavbund": "Planens lavbundspotentiale fordelt efter kommunens andel af planens kulstofrige jord, vægtet med kommunens landbrugstæthed (kun dyrket kulstofjord tæller fuldt).",
                    "skov": "Skovmålet (250.000 ha) fordelt efter kommunens andel af landets landbrugsareal.",
                },
                "disclaimer": (
                    "Der findes ingen officiel kommunal fordeling af målene. Ansvaret er en faglig "
                    "fordeling af MARS-planernes mål efter hvor landbrugsjorden og den kulstofrige "
                    "jord ligger — ikke en politisk forpligtelse."
                ),
            },
            "national": {
                "kvaelstofMaalT": n_goal,
                "lavbundMaalHa": lavbund_goal,
                "skovMaalHa": skov_goal,
                "lavbundPotentialeHa": round(l_total, 1),
                "kulstofrigJordHa": round(nat_kul, 1),
                "landbrugHa": round(farm_total, 1),
            },
            "byKommune": by_kommune,
        },
    )
    return {"kommuner": len(by_kommune), "planer": np_}


def main() -> int:
    t0 = time.time()
    records = build(refresh_dst="--refresh-dst" in sys.argv)
    duration = time.time() - t0
    log_etl_run(
        source="kommune-ansvar",
        endpoints=["mars/geometries", "dst/AREALDK", "wfs2-miljoegis/natur:kulstof2022"],
        records=records,
        status="ok",
        notes="Per-kommune ansvar for kvælstof, lavbund og skov",
        duration_seconds=duration,
    )
    print(f"✓ Kommune-ansvar bygget ({records['kommuner']} kommuner) på {duration:.0f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
