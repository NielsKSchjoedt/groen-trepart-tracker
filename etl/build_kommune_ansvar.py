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
  from the Miljøportal WMS at 50 m. Plans with no mapped carbon soil fall back
  to the farmland weight.
* Skov: the forest goal (250.000 ha) has no geographic split at all; new forest
  is planted on farmland, so ansvar = the kommune's share of national farmland.

Everything is rasterised onto one 50 m grid (EPSG:25832), so overlaps are pixel
counts: 1 px = 0,25 ha. That is far below the precision the allocation needs.

Output: kommune-ansvar.json (data/ + public/data/kommune-benchmark/).
Runs in the monthly spatial-overlay workflow (needs requirements-spatial.txt).
"""
from __future__ import annotations

import io
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SCRIPT_DIR = Path(__file__).resolve().parent
REPO = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

try:
    import geopandas as gpd
    import numpy as np
    from PIL import Image, ImageDraw
    from shapely import wkt as shapely_wkt
    from shapely.geometry import MultiPolygon, Polygon
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

METHOD_VERSION = "ansvar-v1"
EXCLUDED_KODER = {"0411"}
USER_AGENT = (
    "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; "
    "open-source environmental monitor)"
)
MARS_BASE = "https://mars.sgav.dk/api"
DST_BASE = "https://api.statbank.dk/v1"
KULSTOF_WMS = "https://miljoegis3.mim.dk/wms?servicename=vandprojekter_wms"
KULSTOF_LAYER = "theme-kulstofrige_lavbund_2022_kulstof2022_i0"

# 50 m grid over Denmark incl. Bornholm, in 100 km WMS tiles.
CELL_M = 50
TILE_M = 100_000
GRID_X0, GRID_Y0 = 440_000, 6_040_000
TILES_X, TILES_Y = 5, 4
PX_PER_TILE = TILE_M // CELL_M
WIDTH, HEIGHT = TILES_X * PX_PER_TILE, TILES_Y * PX_PER_TILE
HA_PER_PX = CELL_M * CELL_M / 10_000


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
    # Validity does not matter for rasterisation; buffer(0) chokes on some MARS rings.
    return shapely_wkt.loads(path.read_text(encoding="utf-8"))


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


def kulstof_mask() -> np.ndarray:
    """Boolean grid: True where the DCA 2022 kulstofkort marks carbon-rich soil."""
    mask = np.zeros((HEIGHT, WIDTH), dtype=bool)
    for ty in range(TILES_Y):
        for tx in range(TILES_X):
            x0 = GRID_X0 + tx * TILE_M
            y0 = GRID_Y0 + ty * TILE_M
            path = CACHE_DIR / "kulstof" / f"{x0}_{y0}.png"
            if not path.exists():
                url = (
                    f"{KULSTOF_WMS}&service=WMS&request=GetMap&layers={KULSTOF_LAYER}"
                    f"&styles=&format=image/png&transparent=true&version=1.3.0"
                    f"&width={PX_PER_TILE}&height={PX_PER_TILE}&crs={METRIC_CRS}"
                    f"&bbox={x0},{y0},{x0 + TILE_M},{y0 + TILE_M}"
                )
                data = _http_get(url, accept="image/png", timeout=180)
                if not data.startswith(b"\x89PNG"):
                    raise SystemExit(f"Kulstof WMS returned non-PNG for tile {x0},{y0}")
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
            alpha = np.asarray(Image.open(io.BytesIO(path.read_bytes())).convert("RGBA"))[:, :, 3]
            # Image row 0 is the tile's north edge; grid row 0 is the grid's north edge.
            row0 = (TILES_Y - 1 - ty) * PX_PER_TILE
            col0 = tx * PX_PER_TILE
            mask[row0 : row0 + PX_PER_TILE, col0 : col0 + PX_PER_TILE] = alpha > 0
    return mask


# --- Rasterisation ------------------------------------------------------------


def _to_px(coords) -> list[tuple[float, float]]:
    top = GRID_Y0 + TILES_Y * TILE_M
    return [((x - GRID_X0) / CELL_M, (top - y) / CELL_M) for x, y, *_ in coords]


def rasterise(geoms: list[Polygon | MultiPolygon]) -> np.ndarray:
    """Label grid: value i+1 where geoms[i] covers the cell centre, 0 elsewhere."""
    if len(geoms) > 254:
        raise ValueError("uint8 label grid holds at most 254 features")
    img = Image.new("L", (WIDTH, HEIGHT), 0)
    draw = ImageDraw.Draw(img)
    for i, geom in enumerate(geoms):
        polys = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
        for poly in polys:
            if poly.is_empty:
                continue
            draw.polygon(_to_px(poly.exterior.coords), fill=i + 1)
            for hole in poly.interiors:
                draw.polygon(_to_px(hole.coords), fill=0)
    return np.asarray(img)


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

    k_grid = rasterise(list(kommuner.geometry))
    p_grid = rasterise(plan_geoms)
    kulstof = kulstof_mask()

    nk, np_ = len(koder), len(plans)
    # Pixel counts per (kommune, plan) for all land and for carbon-rich soil.
    combo = k_grid.astype(np.int32) * (np_ + 1) + p_grid.astype(np.int32)
    size = (nk + 1) * (np_ + 1)
    area_px = np.bincount(combo.ravel(), minlength=size).reshape(nk + 1, np_ + 1)[1:, 1:]
    kul_px = np.bincount(combo[kulstof], minlength=size).reshape(nk + 1, np_ + 1)[1:, 1:]
    kommune_px = np.bincount(k_grid.ravel(), minlength=nk + 1)[1:]

    # Farmland in each (kommune, plan) overlap, assuming even density within a kommune.
    density = np.array([landbrug[k] for k in koder]) / np.maximum(kommune_px * HA_PER_PX, 1)
    farmland = area_px * HA_PER_PX * density[:, None]
    kulstof_ha = kul_px * HA_PER_PX
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
            if area_px[i, p] * HA_PER_PX >= 1
        ]
        by_kommune[kode] = {
            "kommuneNavn": navne[kode],
            "landbrugHa": landbrug[kode],
            "kulstofrigJordHa": round(float(kulstof_ha[i].sum()), 1),
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
                "gridCellM": CELL_M,
                "sources": [
                    "MARS: planernes kvælstofreduktionsmål og lavbundspotentiale (37 kystvandoplande)",
                    "Danmarks Statistik AREALDK: landbrugsafgrøder pr. kommune",
                    "DCA 2022 kulstofkort (Danmarks Miljøportal WMS): kulstofrige lavbundsjorder",
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
        endpoints=["mars/geometries", "dst/AREALDK", "miljoegis3/kulstof-wms"],
        records=records,
        status="ok",
        notes="Per-kommune ansvar for kvælstof, lavbund og skov",
        duration_seconds=duration,
    )
    print(f"✓ Kommune-ansvar bygget ({records['kommuner']} kommuner) på {duration:.0f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
