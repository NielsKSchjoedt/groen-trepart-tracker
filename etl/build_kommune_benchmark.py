#!/usr/bin/env python3
"""
Build municipality nature benchmarks (B1–B4 + S4.8 national simulation).

This is the monthly heavy GIS build. It uses GeoPandas/Shapely/Rtree from
`etl/requirements-spatial.txt` and keeps Marker_2026 / §3 data chunked per
municipality to avoid loading national layers into memory.
"""
from __future__ import annotations

import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

try:
    import geopandas as gpd
    from shapely.ops import unary_union
except ImportError as exc:  # pragma: no cover - user-facing failure path
    raise SystemExit(
        "Missing optional spatial dependencies. Run: mise run setup-spatial"
    ) from exc

from etl_log import log_etl_run
from spatial_overlay import DEFAULT_SOURCE_CRS, METRIC_CRS, SpatialIndex, repair_geometry

REPO = SCRIPT_DIR.parent
KOMMUNER_PATH = REPO / "data" / "dawa" / "kommuner.geojson"
BIODIV_DIR = REPO / "data" / "arealdata-biodiversitet"
MARKER_DIR = REPO / "data" / "markkort" / "marker-2026"
SECTION3_DIR = REPO / "data" / "section3" / "by-kommune"
SECTION3_SUMMARY = REPO / "data" / "section3" / "by-kommune-summary.json"
N2000_PATH = REPO / "data" / "natura2000" / "natura_2000_omraader.geojson"
DASHBOARD_DATA = REPO / "data" / "dashboard-summary.json"
OUT_DIR = REPO / "data" / "kommune-benchmark"
PUBLIC_OUT_DIR = REPO / "public" / "data" / "kommune-benchmark"
CACHE_DIR = REPO / "data" / "spatial-overlays" / "cache"

DCE_PATH = BIODIV_DIR / "dce-30-percent.geojson"
KU1_PATH = BIODIV_DIR / "ku-prio-1.geojson"
KU2_PATH = BIODIV_DIR / "ku-prio-2.geojson"

METHOD_VERSION = "sprint4-v1"
B4_METHOD_VERSION = "sprint5-v1"
# B4 defaults — adjust here when definitions change
B4_NATURVAERDI_PATH = DCE_PATH
B4_BESKYTTET_N2000_PATH = N2000_PATH
B4_BESKYTTET_SECTION3_DIR = SECTION3_DIR
SKOV_TARGET_HA = 250_000
LAVBUND_TARGET_HA = 140_000
EXCLUDED_DAWA_CODES = {"0411"}  # Christiansø is not one of Denmark's 98 municipalities.
MARINE_KEYWORDS = [
    "kattegat",
    "skagerrak",
    "storebælt",
    "lillebælt",
    "bælt",
    "øresund",
    "sund",
    "havet",
    "vadehav",
    "banke",
    "grund",
    "nordsøen",
    "north sea",
]


def file_hash(path: Path) -> str:
    """
    Compute a short content hash for cache invalidation.

    @param path - File to hash
    @returns First 16 chars of SHA256
    @example file_hash(Path("data/foo.geojson"))
    """

    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def require_files(paths: list[Path]) -> None:
    """
    Fail early with a helpful message if required input files are missing.

    @param paths - Required files
    @returns None
    @example require_files([DCE_PATH, KU1_PATH])
    """

    missing = [str(p) for p in paths if not p.exists()]
    if missing:
        raise SystemExit(
            "Missing Sprint 4 spatial inputs:\n"
            + "\n".join(f"  - {m}" for m in missing)
            + "\nRun: cd etl && python3 fetch_arealdata_biodiversitet.py --full-dce && python3 fetch_marker2026.py"
        )


def write_json_both(relative_name: str, data: dict[str, Any]) -> None:
    """
    Write one benchmark artifact to both data/ and public/data/.

    @param relative_name - File name under kommune-benchmark/
    @param data - JSON-serialisable payload
    @returns None
    @example write_json_both("b1.json", payload)
    """

    for base in (OUT_DIR, PUBLIC_OUT_DIR):
        base.mkdir(parents=True, exist_ok=True)
        (base / relative_name).write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )


def load_kommuner() -> gpd.GeoDataFrame:
    """
    Load DAWA municipalities as EPSG:4326 GeoDataFrame.

    @returns GeoDataFrame with columns `kode`, `navn`, geometry
    @example load_kommuner().to_crs("EPSG:25832")
    """

    gdf = gpd.read_file(KOMMUNER_PATH)
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:25832")
    gdf = gdf.to_crs(DEFAULT_SOURCE_CRS)
    gdf["kode"] = gdf["kode"].astype(str).str.zfill(4)
    gdf = gdf[~gdf["kode"].isin(EXCLUDED_DAWA_CODES)]
    gdf = gdf[["kode", "navn", "geometry"]].sort_values("kode").reset_index(drop=True)
    if len(gdf) != 98:
        print(f"WARNING: expected 98 municipalities, loaded {len(gdf)}")
    return gdf


def metric_geom(geom_4326: Any) -> Any:
    """Project a single EPSG:4326 Shapely geometry to EPSG:25832."""

    return repair_geometry(gpd.GeoSeries([geom_4326], crs=DEFAULT_SOURCE_CRS).to_crs(METRIC_CRS).iloc[0])


def layer_union(index: SpatialIndex) -> Any:
    """Return one repaired EPSG:25832 union geometry for a SpatialIndex."""

    return repair_geometry(unary_union(index.gdf.geometry.values))


def is_likely_marine_n2000(row: Any) -> bool:
    """
    Match the existing Natura 2000 name/area heuristic used in fetch_natura2000.

    @param row - GeoDataFrame row with `n2000_navn` and `shape_area`
    @returns True when the site is likely marine and should be excluded from B3
    @example is_likely_marine_n2000(row)
    """

    name = str(row.get("n2000_navn") or "").lower()
    area_m2 = float(row.get("shape_area") or row.geometry.area)
    return any(keyword in name for keyword in MARINE_KEYWORDS) and area_m2 > 100_000_000


def section3_manifest_hash() -> str:
    """
    Return a stable hash for the per-kommune §3 cache.

    Prefers the manifest hash written by fetch_section3_by_kommune.py; falls
    back to hashing individual files when the summary is absent.
    """

    if SECTION3_SUMMARY.exists():
        raw = json.loads(SECTION3_SUMMARY.read_text(encoding="utf-8"))
        if raw.get("manifestHash"):
            return str(raw["manifestHash"])
    if not SECTION3_DIR.exists():
        return "missing"
    parts: list[tuple[str, str]] = []
    for path in sorted(SECTION3_DIR.glob("*.geojson")):
        parts.append((path.stem, file_hash(path)))
    if not parts:
        return "missing"
    return hashlib.sha256(json.dumps(parts, sort_keys=True).encode()).hexdigest()[:16]


def load_section3_index_for_kommune(kode: str) -> SpatialIndex | None:
    """
    Load one municipality's §3 bbox file as a SpatialIndex.

    @param kode - 4-digit municipality code
    @returns SpatialIndex or None if file is absent/empty
    """

    path = SECTION3_DIR / f"{kode}.geojson"
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        fc = json.load(f)
    features = [feat for feat in fc.get("features", []) if feat.get("geometry")]
    if not features:
        return None
    return SpatialIndex.from_features(features, name=f"section3_{kode}")


def load_section3_index() -> SpatialIndex:
    """
    Load all per-kommune §3 bbox files into one SpatialIndex.

    Prefer `load_section3_index_for_kommune` in hot loops — this helper is only
    used when a national §3 union is genuinely required.
    """

    if not SECTION3_DIR.exists():
        raise SystemExit(
            f"Missing §3 per-kommune cache at {SECTION3_DIR}\n"
            "Run: cd etl && python3 fetch_section3_by_kommune.py"
        )
    features: list[dict[str, Any]] = []
    for path in sorted(SECTION3_DIR.glob("*.geojson")):
        with open(path, encoding="utf-8") as f:
            fc = json.load(f)
        for feat in fc.get("features", []):
            if feat.get("geometry"):
                features.append(feat)
    if not features:
        raise SystemExit(f"No §3 features found under {SECTION3_DIR}")
    return SpatialIndex.from_features(features, name="section3_by_kommune")


def geom_area_ha(geom: Any) -> float:
    """Return hectares for a metric EPSG:25832 geometry."""

    return round(geom.area / 10_000, 4) if geom is not None and not geom.is_empty else 0.0


def load_n2000_terrestrial_index() -> SpatialIndex:
    """
    Load Natura 2000 polygons, excluding likely marine sites.

    @returns SpatialIndex containing terrestrial Natura 2000 geometry
    @example load_n2000_terrestrial_index().intersect_area(kommune.geometry)
    """

    gdf = gpd.read_file(N2000_PATH)
    if gdf.crs is None:
        gdf = gdf.set_crs(METRIC_CRS)
    gdf_metric = gdf.to_crs(METRIC_CRS)
    terrestrial = gdf_metric[~gdf_metric.apply(is_likely_marine_n2000, axis=1)].copy()
    return SpatialIndex(terrestrial, name="natura2000_terrestrial", source_crs=METRIC_CRS)


def load_marker_index(kode: str) -> SpatialIndex | None:
    """
    Load one municipality's Marker_2026 bbox file as a SpatialIndex.

    @param kode - 4-digit municipality code
    @returns SpatialIndex or None if file is absent/empty
    @example load_marker_index("0851")
    """

    path = MARKER_DIR / f"{kode}.geojson"
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        fc = json.load(f)
    features = [feat for feat in fc.get("features", []) if feat.get("geometry")]
    if not features:
        return None
    return SpatialIndex.from_features(features, name=f"marker_{kode}")


def pct(part: float, total: float) -> float:
    """Return a rounded percentage, preserving zero when total is zero."""

    return round((part / total) * 100, 4) if total else 0.0


def load_actual_pipeline_by_kommune() -> dict[str, dict[str, float]]:
    """
    Load current actual MARS/supplement pipeline values per municipality.

    @returns `{kode: {actualSkovHa, actualLavbundHa}}`
    @example load_actual_pipeline_by_kommune()["0851"]["actualSkovHa"]
    """

    if not DASHBOARD_DATA.exists():
        return {}
    raw = json.loads(DASHBOARD_DATA.read_text(encoding="utf-8"))
    kommuner = raw.get("national", {}).get("byKommune", [])
    result: dict[str, dict[str, float]] = {}
    for row in kommuner:
        kode = str(row.get("kode") or "").zfill(4)
        if not kode:
            continue
        result[kode] = {
            "actualSkovHa": float(row.get("afforestationTotalHa") or row.get("afforestationMarsHa") or 0),
            "actualLavbundHa": float(row.get("extractionHa") or 0),
        }
    return result


def assert_close(label: str, value: float, expected: float, tolerance: float) -> None:
    """
    Raise a clear AssertionError when a sanity check is outside tolerance.

    @param label - Human-readable check name
    @param value - Actual value
    @param expected - Expected value
    @param tolerance - Absolute tolerance
    @returns None
    @example assert_close("sum pct", 99.99, 100, 0.1)
    """

    if abs(value - expected) > tolerance:
        raise AssertionError(f"{label}: got {value:.4f}, expected {expected:.4f} ± {tolerance}")


def build() -> dict[str, Any]:
    """
    Build all Sprint 4 benchmark artifacts.

    @returns Dict with record counts used for ETL logging
    @example build()["municipalities"]
    """

    require_files([KOMMUNER_PATH, DCE_PATH, KU1_PATH, KU2_PATH, N2000_PATH, B4_NATURVAERDI_PATH])
    if not SECTION3_DIR.exists() or not any(SECTION3_DIR.glob("*.geojson")):
        raise SystemExit(
            f"Missing §3 per-kommune cache at {SECTION3_DIR}\n"
            "Run: cd etl && python3 fetch_section3_by_kommune.py"
        )
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUT_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    generated_at = datetime.now(timezone.utc).isoformat()
    inputs = {
        "kommuner": file_hash(KOMMUNER_PATH),
        "dce30": file_hash(DCE_PATH),
        "kuPrio1": file_hash(KU1_PATH),
        "kuPrio2": file_hash(KU2_PATH),
        "natura2000": file_hash(N2000_PATH),
        "section3ByKommune": section3_manifest_hash(),
    }
    cache_key_base = hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()[:16]

    print("Loading municipalities and national layers...")
    kommuner = load_kommuner()
    kommuner_metric = kommuner.to_crs(METRIC_CRS)
    dce = SpatialIndex.from_geojson(DCE_PATH, name="dce_30_percent")
    ku1 = SpatialIndex.from_geojson(KU1_PATH, name="ku_prio_1")
    ku2 = SpatialIndex.from_geojson(KU2_PATH, name="ku_prio_2")
    n2000 = load_n2000_terrestrial_index()
    dce_union = layer_union(dce)
    ku1_union = layer_union(ku1)
    low_potential_union = repair_geometry(dce_union.difference(ku1_union))
    n2000_union = layer_union(n2000)
    actual_by_kommune = load_actual_pipeline_by_kommune()

    rows: dict[str, dict[str, Any]] = {}
    b1_by: dict[str, dict[str, Any]] = {}
    b2_by: dict[str, dict[str, Any]] = {}
    b3_by: dict[str, dict[str, Any]] = {}
    b4_by: dict[str, dict[str, Any]] = {}
    n = len(kommuner)
    for idx, row in kommuner.iterrows():
        kode = str(row["kode"]).zfill(4)
        navn = str(row["navn"])
        kommune_geom = row.geometry
        kommune_metric = kommuner_metric.iloc[idx].geometry
        marker_path = MARKER_DIR / f"{kode}.geojson"
        marker_hash = file_hash(marker_path) if marker_path.exists() else "missing"
        section3_path = SECTION3_DIR / f"{kode}.geojson"
        section3_hash = file_hash(section3_path) if section3_path.exists() else "missing"
        cache_key = hashlib.sha256(
            f"{cache_key_base}:{kode}:{marker_hash}:{section3_hash}".encode()
        ).hexdigest()[:16]
        cache_path = CACHE_DIR / f"{kode}.json"

        if cache_path.exists():
            cached = json.loads(cache_path.read_text(encoding="utf-8"))
            if cached.get("cacheKey") == cache_key:
                rows[kode] = cached["metrics"]
                print(f"  {idx + 1:02d}/{n} {kode} {navn}: cache")
                continue

        dce_result = dce.intersect_area(kommune_geom)
        ku1_result = ku1.intersect_area(kommune_geom)
        ku2_result = ku2.intersect_area(kommune_geom)
        n2000_result = n2000.intersect_area(kommune_geom)

        vaerdi_kommune = repair_geometry(dce_union.intersection(kommune_metric))
        n2000_kommune = repair_geometry(n2000_union.intersection(kommune_metric))
        section3 = load_section3_index_for_kommune(kode)
        if section3 is None:
            section3_kommune_union = None
        else:
            section3_kommune_union = layer_union(section3)
            section3_kommune_union = repair_geometry(section3_kommune_union.intersection(kommune_metric))
        parts = [g for g in (n2000_kommune, section3_kommune_union) if g is not None and not g.is_empty]
        beskyttet_kommune = repair_geometry(unary_union(parts)) if parts else repair_geometry(n2000_kommune)
        overlap_kommune = repair_geometry(vaerdi_kommune.intersection(beskyttet_kommune))
        naturvaerdi_ha = geom_area_ha(vaerdi_kommune)
        beskyttet_ha = geom_area_ha(beskyttet_kommune)
        overlap_ha = geom_area_ha(overlap_kommune)
        vaerdi_uden_ha = round(max(0.0, naturvaerdi_ha - overlap_ha), 4)
        pct_vaerdi_beskyttet = pct(overlap_ha, naturvaerdi_ha)

        marker = load_marker_index(kode)
        if marker is None:
            marker_total_ha = high_ha = low_ha = farmland_n2000_ha = 0.0
        else:
            marker_total_ha = marker.intersect_area(kommune_geom)["totalHa"]
            high_target = repair_geometry(ku1_union.intersection(kommune_metric))
            low_target = repair_geometry(low_potential_union.intersection(kommune_metric))
            n2000_target = repair_geometry(n2000_union.intersection(kommune_metric))
            high_ha = marker.intersect_area_metric(high_target)["totalHa"] if not high_target.is_empty else 0.0
            low_ha = marker.intersect_area_metric(low_target)["totalHa"] if not low_target.is_empty else 0.0
            farmland_n2000_ha = (
                marker.intersect_area_metric(n2000_target)["totalHa"] if not n2000_target.is_empty else 0.0
            )

        outside_ha = max(marker_total_ha - high_ha - low_ha, 0.0)
        n2000_total_ha = n2000_result["totalHa"]
        metrics = {
            "kommuneKode": kode,
            "kommuneNavn": navn,
            "b1": {
                "dce30Ha": dce_result["totalHa"],
                "kuPrio1Ha": ku1_result["totalHa"],
                "kuPrio2Ha": ku2_result["totalHa"],
            },
            "b2": {
                "markerTotalHa": round(marker_total_ha, 4),
                "hoejtPotentialeHa": round(high_ha, 4),
                "lavtPotentialeHa": round(low_ha, 4),
                "udenforPotentialeHa": round(outside_ha, 4),
            },
            "b3": {
                "n2000TotalHa": n2000_total_ha,
                "n2000ErLandbrugHa": round(farmland_n2000_ha, 4),
                "andelLandbrugIN2000Pct": pct(farmland_n2000_ha, n2000_total_ha) if n2000_total_ha else None,
            },
            "b4": {
                "naturvaerdiHa": naturvaerdi_ha,
                "beskyttetHa": beskyttet_ha,
                "overlapHa": overlap_ha,
                "vaerdiUdenBeskyttelseHa": vaerdi_uden_ha,
                "pctVaerdiBeskyttet": pct_vaerdi_beskyttet,
            },
        }
        rows[kode] = metrics
        cache_path.write_text(
            json.dumps({"cacheKey": cache_key, "inputs": inputs, "metrics": metrics}, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"  {idx + 1:02d}/{n} {kode} {navn}: built")

    total_dce = sum(v["b1"]["dce30Ha"] for v in rows.values())
    total_ku1 = sum(v["b1"]["kuPrio1Ha"] for v in rows.values())
    total_ku2 = sum(v["b1"]["kuPrio2Ha"] for v in rows.values())
    total_marker = sum(v["b2"]["markerTotalHa"] for v in rows.values())
    total_high = sum(v["b2"]["hoejtPotentialeHa"] for v in rows.values())
    total_low = sum(v["b2"]["lavtPotentialeHa"] for v in rows.values())
    total_outside = sum(v["b2"]["udenforPotentialeHa"] for v in rows.values())
    total_n2000 = sum(v["b3"]["n2000TotalHa"] for v in rows.values())
    total_n2000_farmland = sum(v["b3"]["n2000ErLandbrugHa"] for v in rows.values())
    total_naturvaerdi = sum(v["b4"]["naturvaerdiHa"] for v in rows.values())
    total_beskyttet = sum(v["b4"]["beskyttetHa"] for v in rows.values())
    total_overlap = sum(v["b4"]["overlapHa"] for v in rows.values())
    total_vaerdi_uden = sum(v["b4"]["vaerdiUdenBeskyttelseHa"] for v in rows.values())

    for kode, v in rows.items():
        b1_by[kode] = {
            "kommuneNavn": v["kommuneNavn"],
            "dce30Ha": v["b1"]["dce30Ha"],
            "dce30PctOfNational": pct(v["b1"]["dce30Ha"], total_dce),
            "kuPrio1Ha": v["b1"]["kuPrio1Ha"],
            "kuPrio1PctOfNational": pct(v["b1"]["kuPrio1Ha"], total_ku1),
            "kuPrio2Ha": v["b1"]["kuPrio2Ha"],
            "kuPrio2PctOfNational": pct(v["b1"]["kuPrio2Ha"], total_ku2),
        }
        b2 = v["b2"]
        b2_by[kode] = {
            "kommuneNavn": v["kommuneNavn"],
            **b2,
            "hoejtPotentialePct": pct(b2["hoejtPotentialeHa"], b2["markerTotalHa"]),
            "lavtPotentialePct": pct(b2["lavtPotentialeHa"], b2["markerTotalHa"]),
            "udenforPotentialePct": pct(b2["udenforPotentialeHa"], b2["markerTotalHa"]),
        }
        b3_by[kode] = {"kommuneNavn": v["kommuneNavn"], **v["b3"]}
        b4_by[kode] = {"kommuneNavn": v["kommuneNavn"], **v["b4"]}

    assert_close("B1 DCE kommune pct sum", sum(v["dce30PctOfNational"] for v in b1_by.values()), 100, 0.1)
    for kode, row in b2_by.items():
        assert_close(
            f"B2 category sum {kode}",
            row["hoejtPotentialeHa"] + row["lavtPotentialeHa"] + row["udenforPotentialeHa"],
            row["markerTotalHa"],
            max(row["markerTotalHa"] * 0.01, 0.05),
        )
    for kode, row in b3_by.items():
        val = row["andelLandbrugIN2000Pct"]
        if val is not None and not (0 <= val <= 100):
            raise AssertionError(f"B3 percentage out of bounds for {kode}: {val}")
    for kode, row in b4_by.items():
        overlap = row["overlapHa"]
        natur = row["naturvaerdiHa"]
        beskyttet = row["beskyttetHa"]
        limit = min(natur, beskyttet) + max(natur, beskyttet) * 0.01 + 0.05
        if overlap > limit:
            raise AssertionError(
                f"B4 overlap exceeds bounds for {kode}: overlap={overlap}, natur={natur}, beskyttet={beskyttet}"
            )
        if row["vaerdiUdenBeskyttelseHa"] < -0.01:
            raise AssertionError(f"B4 negative vaerdiUdenBeskyttelseHa for {kode}: {row['vaerdiUdenBeskyttelseHa']}")

    denmark_metric = repair_geometry(unary_union(kommuner_metric.geometry.values))
    national_natur_direct = geom_area_ha(repair_geometry(dce_union.intersection(denmark_metric)))
    assert_close(
        "B4 national naturvaerdi partition",
        total_naturvaerdi,
        national_natur_direct,
        max(national_natur_direct * 0.02, 10),
    )

    meta = {
        "generatedAt": generated_at,
        "methodVersion": METHOD_VERSION,
        "sourceLayers": [
            {"name": "DCE 30%", "path": str(DCE_PATH.relative_to(REPO)), "hash": inputs["dce30"]},
            {"name": "KU prio 1", "path": str(KU1_PATH.relative_to(REPO)), "hash": inputs["kuPrio1"]},
            {"name": "KU prio 2", "path": str(KU2_PATH.relative_to(REPO)), "hash": inputs["kuPrio2"]},
            {"name": "Marker 2026", "path": str(MARKER_DIR.relative_to(REPO))},
            {"name": "Natura 2000", "path": str(N2000_PATH.relative_to(REPO)), "hash": inputs["natura2000"]},
        ],
    }
    b1 = {
        "metadata": meta,
        "national": {"totalDce30Ha": round(total_dce, 4), "totalKuPrio1Ha": round(total_ku1, 4), "totalKuPrio2Ha": round(total_ku2, 4)},
        "byKommune": b1_by,
    }
    b2 = {
        "metadata": meta,
        "national": {
            "markerTotalHa": round(total_marker, 4),
            "hoejtPotentialeHa": round(total_high, 4),
            "lavtPotentialeHa": round(total_low, 4),
            "udenforPotentialeHa": round(total_outside, 4),
        },
        "byKommune": b2_by,
    }
    b3 = {
        "metadata": meta,
        "national": {
            "n2000TotalHa": round(total_n2000, 4),
            "n2000ErLandbrugHa": round(total_n2000_farmland, 4),
            "andelLandbrugIN2000Pct": pct(total_n2000_farmland, total_n2000),
        },
        "byKommune": b3_by,
    }
    b4 = {
        "methodVersion": B4_METHOD_VERSION,
        "generatedAt": generated_at,
        "sources": [
            {
                "name": "DCE 30%",
                "path": str(B4_NATURVAERDI_PATH.relative_to(REPO)),
                "hash": inputs["dce30"],
            },
            {
                "name": "Natura 2000",
                "path": str(B4_BESKYTTET_N2000_PATH.relative_to(REPO)),
                "hash": inputs["natura2000"],
            },
            {
                "name": "§3 bes_naturtyper",
                "path": str(B4_BESKYTTET_SECTION3_DIR.relative_to(REPO)),
                "hash": inputs["section3ByKommune"],
            },
        ],
        "disclaimer": (
            "§3 er tilstandsbeskyttelse (må ikke ændres uden dispensation), ikke en garanti for god "
            "naturtilstand. DCE 30 % er ét fagligt værdimål blandt flere. Arealer har §3-/Natura "
            "2000-status — ikke en vurdering af, om naturen er velbeskyttet."
        ),
        "national": {
            "naturvaerdiHa": round(total_naturvaerdi, 4),
            "beskyttetHa": round(total_beskyttet, 4),
            "overlapHa": round(total_overlap, 4),
            "vaerdiUdenBeskyttelseHa": round(total_vaerdi_uden, 4),
            "pctVaerdiBeskyttet": pct(total_overlap, total_naturvaerdi),
        },
        "byKommune": b4_by,
    }

    simulated_by: dict[str, Any] = {}
    for kode, row in b1_by.items():
        share = row["dce30PctOfNational"] / 100 if total_dce else 0
        actual = actual_by_kommune.get(kode, {"actualSkovHa": 0.0, "actualLavbundHa": 0.0})
        expected_skov = SKOV_TARGET_HA * share
        expected_lavbund = LAVBUND_TARGET_HA * share
        simulated_by[kode] = {
            "kommuneNavn": row["kommuneNavn"],
            "basis": "dce30PctOfNational",
            "dce30PctOfNational": row["dce30PctOfNational"],
            "simulatedSkovHa": round(expected_skov, 2),
            "actualSkovHa": round(actual["actualSkovHa"], 2),
            "skovDifferenceHa": round(expected_skov - actual["actualSkovHa"], 2),
            "simulatedLavbundHa": round(expected_lavbund, 2),
            "actualLavbundHa": round(actual["actualLavbundHa"], 2),
            "lavbundDifferenceHa": round(expected_lavbund - actual["actualLavbundHa"], 2),
        }
    assert_close("S4.8 simulated skov sum", sum(v["simulatedSkovHa"] for v in simulated_by.values()), SKOV_TARGET_HA, 10)
    assert_close("S4.8 simulated lavbund sum", sum(v["simulatedLavbundHa"] for v in simulated_by.values()), LAVBUND_TARGET_HA, 10)

    simulation = {
        "metadata": {
            **meta,
            "disclaimer": "Dette er en simulering af hvor naturindsatsen ville fordeles, hvis den blev allokeret proportionalt med dokumenteret naturpotentiale. Det er ikke en officiel kommunal fordeling.",
        },
        "national": {"skovTargetHa": SKOV_TARGET_HA, "lavbundTargetHa": LAVBUND_TARGET_HA},
        "byKommune": simulated_by,
    }

    write_json_both("b1-andel-nationalt-naturpotentiale.json", b1)
    write_json_both("b2-marker-i-naturpotentiale.json", b2)
    write_json_both("b3-n2000-er-landbrug.json", b3)
    write_json_both("b4-vaerdibeskyttelse.json", b4)
    write_json_both("national-fordeling-simulering.json", simulation)

    print("Top 3 B1 DCE:", sorted(b1_by.values(), key=lambda x: x["dce30PctOfNational"], reverse=True)[:3])
    print("Top 3 B2 high:", sorted(b2_by.values(), key=lambda x: x["hoejtPotentialePct"], reverse=True)[:3])
    print("Top 3 B3 farmland:", sorted(b3_by.values(), key=lambda x: x["andelLandbrugIN2000Pct"] or 0, reverse=True)[:3])
    print("Top 3 B4 protected:", sorted(b4_by.values(), key=lambda x: x["pctVaerdiBeskyttet"], reverse=True)[:3])
    return {"municipalities": len(rows), "b1": len(b1_by), "b2": len(b2_by), "b3": len(b3_by), "b4": len(b4_by)}


def main() -> int:
    """CLI entrypoint for the monthly Sprint 4 benchmark build."""

    t0 = time.time()
    records = build()
    duration = time.time() - t0
    log_etl_run(
        source="kommune-benchmark",
        endpoints=["local spatial overlay build"],
        records={k: int(v) for k, v in records.items()},
        status="ok",
        notes="Sprint 4 B1/B2/B3 + B4 værdi-beskyttelse + national fordelings-simulering",
        duration_seconds=duration,
    )
    print(f"✓ Kommune benchmark built in {duration:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
