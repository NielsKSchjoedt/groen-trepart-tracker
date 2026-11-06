#!/usr/bin/env python3
"""
ETL: Kommune boundaries and metadata (DAGI via official live sources, archive fallback).

The filename is historical: the boundaries used to come from DAWA
(api.dataforsyningen.dk), which was shut down in 2026 (every endpoint answers
HTTP 410 Gone). The output files keep their DAWA-era paths and schema so that
nothing downstream changes:

  data/dawa/kommuner.json          — metadata (kode, navn, region, bbox, visueltcenter)
  data/dawa/regioner.json          — region metadata (static)
  data/dawa/kommuner.csv           — kode|navn|region|visual centre (static helper)
  data/dawa/kommuner.geojson.xz    — full EPSG:25832 boundaries, xz-compressed, in git
  data/dawa/kommuner.geojson       — decompressed working copy (gitignored, ~110 MB)
  data/dawa/summary.json           — provenance of this run (source, fetched_at, changes)

Sources, tried in order (all serve the same DAGI kommune geometry):

  1. Datafordeleren DAGI WFS (`dagi_v001:kommuneinddeling`) — the canonical source.
     Only tried when the environment variable DATAFORDELER_API_KEY is set (free key
     from datafordeler.dk). URL and layer can be overridden with
     DATAFORDELER_DAGI_WFS_URL / DATAFORDELER_DAGI_TYPENAME.
  2. Plandata.dk GeoServer WFS (`pdk:theme_pdk_kommuneplan_oversigt_vedtaget_v`) —
     open, no key. 98 kommuner; Christiansø (0411) is not in this layer.
  3. The committed archive (last DAWA fetch 2026-09-11) — always the fallback.

The live source is compared kommune by kommune with the archive. A kommune whose
geometry is unchanged (same rings, every vertex within GEOMETRY_TOLERANCE_M) keeps
the archive geometry and the archive's bbox/visueltcenter, so an unchanged run
rewrites nothing but summary.json. Only when a boundary or name actually changed
are the archive, kommuner.json and kommuner.csv rewritten; bbox and visual centre
are then computed for the changed kommuner only, the way DAWA did: bbox as the
WGS84 envelope of the UTM bbox corners (matches the archive to < 1e-6°), visual
centre as the pole of inaccessibility of the largest polygon (median 4 m from
DAWA's own value). Region membership
is static and always taken from the archive; Christiansø always comes from the
archive unless the live source includes it.

Python stdlib only.
"""

from __future__ import annotations

import csv
import heapq
import io
import json
import lzma
import math
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from etl_log import log_etl_run

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_DIR = REPO_ROOT / "data" / "dawa"

META_PATH = DATA_DIR / "kommuner.json"
CSV_PATH = DATA_DIR / "kommuner.csv"
REGION_PATH = DATA_DIR / "regioner.json"
GEO_PATH = DATA_DIR / "kommuner.geojson"
GEO_ARCHIVE = DATA_DIR / "kommuner.geojson.xz"
SUMMARY_PATH = DATA_DIR / "summary.json"

EXPECTED_KOMMUNER = 99  # 98 kommuner + Christiansø (0411), as DAWA returned them
GEOMETRY_TOLERANCE_M = 0.01  # sources differ only by float noise (< 1 mm)
TIMEOUT_S = 120

USER_AGENT = (
    "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; "
    "open-source environmental monitor)"
)

DATAFORDELER_URL = os.environ.get(
    "DATAFORDELER_DAGI_WFS_URL", "https://wfs.datafordeler.dk/DAGI/DAGI_WFS/1.0.0/WFS"
)
DATAFORDELER_TYPENAME = os.environ.get("DATAFORDELER_DAGI_TYPENAME", "dagi_v001:kommuneinddeling")
PLANDATA_URL = "https://geoserver.plandata.dk/geoserver/ows"
PLANDATA_TYPENAME = "pdk:theme_pdk_kommuneplan_oversigt_vedtaget_v"

ARCHIVE_SOURCE = "archive (last DAWA fetch 2026-09-11)"


class SourceError(Exception):
    """A live source could not deliver a complete, valid kommune layer."""


# ---------------------------------------------------------------------------
# Live sources
# ---------------------------------------------------------------------------

def _get_json(url: str, params: dict, label: str) -> dict:
    """GET a WFS GeoJSON response. Raises SourceError with a readable reason."""
    full = f"{url}?{urlencode(params)}"
    shown = full.replace(params.get("apikey", "\0"), "***") if params.get("apikey") else full
    print(f"  {label}: GET {shown}")
    req = Request(full, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(req, timeout=TIMEOUT_S) as resp:
            body = resp.read()
    except HTTPError as e:
        detail = ""
        try:
            raw = e.read(2000).decode("utf-8", "replace")
            try:  # Datafordeler answers application/problem+json
                prob = json.loads(raw)
                detail = f"{prob.get('errorCode', '')} {prob.get('detail', '')}".strip()
            except ValueError:
                detail = raw[:200]
        except Exception:  # pragma: no cover - best effort
            pass
        raise SourceError(f"HTTP {e.code} {e.reason}: {detail}".rstrip(": ")) from e
    except (URLError, TimeoutError, OSError) as e:
        raise SourceError(f"network error: {e}") from e
    try:
        return json.loads(body)
    except ValueError as e:
        raise SourceError(f"response is not JSON (starts with {body[:80]!r})") from e


def _first(props: dict, *names: str):
    for n in names:
        if props.get(n) not in (None, ""):
            return props[n]
    return None


def parse_features(fc: dict, code_fields: tuple[str, ...], name_fields: tuple[str, ...]) -> dict[str, dict]:
    """
    Turn a WFS FeatureCollection into {kode: {"navn": str, "geometry": dict}}.

    Codes are normalised to DAWA's 4-digit string ("101" / 101 → "0101").
    Raises SourceError on missing codes or duplicate kommuner.
    """
    out: dict[str, dict] = {}
    for feat in fc.get("features") or []:
        props = feat.get("properties") or {}
        code = _first(props, *code_fields)
        geom = feat.get("geometry")
        if code is None or not geom:
            raise SourceError(f"feature without kommune code or geometry: {props}")
        kode = str(int(code)).zfill(4)
        if kode in out:
            raise SourceError(f"duplicate kommune {kode} in response")
        if geom.get("type") not in ("Polygon", "MultiPolygon"):
            raise SourceError(f"kommune {kode} has unsupported geometry {geom.get('type')}")
        out[kode] = {"navn": str(_first(props, *name_fields) or "").strip(), "geometry": geom}
    return out


def fetch_datafordeler(api_key: str) -> dict[str, dict]:
    """Datafordeleren DAGI WFS (needs a free API key)."""
    fc = _get_json(
        DATAFORDELER_URL,
        {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeNames": DATAFORDELER_TYPENAME,
            "outputFormat": "application/json",
            "srsName": "EPSG:25832",
            "apikey": api_key,
        },
        "Datafordeler DAGI",
    )
    return parse_features(fc, ("kommunekode", "kode", "komnr"), ("navn", "kommunenavn"))


def fetch_plandata() -> dict[str, dict]:
    """Plandata.dk GeoServer WFS (open). Same DAGI geometry; no Christiansø."""
    fc = _get_json(
        PLANDATA_URL,
        {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeNames": PLANDATA_TYPENAME,
            "outputFormat": "application/json",
            "srsName": "EPSG:25832",
            "propertyName": "komnr,kommunenavn,geometri",
        },
        "Plandata",
    )
    return parse_features(fc, ("komnr",), ("kommunenavn",))


# ---------------------------------------------------------------------------
# Geometry helpers (stdlib)
# ---------------------------------------------------------------------------

def _polygons(geom: dict) -> list[list[list[list[float]]]]:
    return geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]


def geometry_equal(a: dict, b: dict, tol: float = GEOMETRY_TOLERANCE_M) -> bool:
    """Same ring structure and every vertex within `tol` metres."""
    pa, pb = _polygons(a), _polygons(b)
    if [len(p) for p in pa] != [len(p) for p in pb]:
        return False
    for poly_a, poly_b in zip(pa, pb):
        for ra, rb in zip(poly_a, poly_b):
            if len(ra) != len(rb):
                return False
            for (xa, ya, *_), (xb, yb, *_) in zip(ra, rb):
                if abs(xa - xb) > tol or abs(ya - yb) > tol:
                    return False
    return True


def ring_area(ring: list[list[float]]) -> float:
    """Signed shoelace area (planar units²)."""
    s = 0.0
    for i in range(len(ring) - 1):
        s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return s / 2.0


def geometry_area(geom: dict) -> float:
    total = 0.0
    for poly in _polygons(geom):
        for i, ring in enumerate(poly):
            a = abs(ring_area(ring))
            total += a if i == 0 else -a
    return total


def geometry_bbox(geom: dict) -> list[float]:
    xs, ys = [], []
    for poly in _polygons(geom):
        for x, y, *_ in poly[0]:
            xs.append(x)
            ys.append(y)
    return [min(xs), min(ys), max(xs), max(ys)]


def _point_to_polygon_distance(x: float, y: float, poly: list[list[list[float]]]) -> float:
    """Signed distance from point to polygon outline (positive inside)."""
    inside = False
    min_d2 = math.inf
    for ring in poly:
        n = len(ring)
        j = n - 1
        for i in range(n):
            ax, ay = ring[i][0], ring[i][1]
            bx, by = ring[j][0], ring[j][1]
            if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
                inside = not inside
            dx, dy = bx - ax, by - ay
            if dx or dy:
                t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
                px, py = ax + t * dx, ay + t * dy
            else:
                px, py = ax, ay
            d2 = (x - px) ** 2 + (y - py) ** 2
            if d2 < min_d2:
                min_d2 = d2
            j = i
    return (1 if inside else -1) * math.sqrt(min_d2)


def polylabel(poly: list[list[list[float]]], precision: float = 10.0) -> tuple[float, float]:
    """
    Pole of inaccessibility (Mapbox "polylabel"): the interior point farthest
    from the outline. A visual centre that is always inside the polygon.
    """
    minx, miny, maxx, maxy = geometry_bbox({"type": "Polygon", "coordinates": poly})
    size = min(maxx - minx, maxy - miny)
    if size == 0:
        return (minx, miny)
    h = size / 2
    heap: list = []
    counter = 0

    def push(cx: float, cy: float, half: float) -> None:
        nonlocal counter
        d = _point_to_polygon_distance(cx, cy, poly)
        heapq.heappush(heap, (-(d + half * math.sqrt(2)), counter, cx, cy, half, d))
        counter += 1

    x = minx
    while x < maxx:
        y = miny
        while y < maxy:
            push(x + h, y + h, h)
            y += size
        x += size

    # Seed with the area centroid of the outer ring.
    ring = poly[0]
    a = ring_area(ring)
    if a:
        cx = sum((ring[i][0] + ring[i + 1][0]) * (ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1])
                 for i in range(len(ring) - 1)) / (6 * a)
        cy = sum((ring[i][1] + ring[i + 1][1]) * (ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1])
                 for i in range(len(ring) - 1)) / (6 * a)
    else:
        cx, cy = ring[0][0], ring[0][1]
    best = (cx, cy, _point_to_polygon_distance(cx, cy, poly))
    bx, by = minx + (maxx - minx) / 2, miny + (maxy - miny) / 2
    d = _point_to_polygon_distance(bx, by, poly)
    if d > best[2]:
        best = (bx, by, d)

    while heap:
        neg_max, _, cx, cy, half, d = heapq.heappop(heap)
        if d > best[2]:
            best = (cx, cy, d)
        if -neg_max - best[2] <= precision:
            continue
        half /= 2
        for ox in (-half, half):
            for oy in (-half, half):
                push(cx + ox, cy + oy, half)
    return (best[0], best[1])


def visual_centre(geom: dict) -> tuple[float, float]:
    """Pole of inaccessibility of the largest polygon (EPSG:25832 metres)."""
    largest = max(_polygons(geom), key=lambda p: abs(ring_area(p[0])))
    return polylabel(largest)


def utm32n_to_wgs84(easting: float, northing: float) -> tuple[float, float]:
    """EPSG:25832 → WGS84 lon/lat (series expansion, sub-metre in Denmark)."""
    k0, a, f = 0.9996, 6378137.0, 1 / 298.257223563
    e2 = 2 * f - f * f
    ep2 = e2 / (1 - e2)
    x = easting - 500000.0
    mu = northing / k0 / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
            + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
            + (151 * e1 ** 3 / 96) * math.sin(6 * mu)
            + (1097 * e1 ** 4 / 512) * math.sin(8 * mu))
    n1 = a / math.sqrt(1 - e2 * math.sin(phi1) ** 2)
    t1 = math.tan(phi1) ** 2
    c1 = ep2 * math.cos(phi1) ** 2
    r1 = a * (1 - e2) / (1 - e2 * math.sin(phi1) ** 2) ** 1.5
    d = x / (n1 * k0)
    lat = phi1 - (n1 * math.tan(phi1) / r1) * (
        d ** 2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6 / 720
    )
    lon = math.radians(9.0) + (
        d - (1 + 2 * t1 + c1) * d ** 3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5 / 120
    ) / math.cos(phi1)
    return (math.degrees(lon), math.degrees(lat))


def wgs84_bbox(geom: dict) -> list[float]:
    """
    DAWA-style bbox [minLon, minLat, maxLon, maxLat] (8 decimals): the WGS84
    envelope of the four corners of the EPSG:25832 bbox. This reproduces the
    archived DAWA values to < 1e-6 degrees for all 99 kommuner.
    """
    x0, y0, x1, y1 = geometry_bbox(geom)
    pts = [utm32n_to_wgs84(x, y) for x, y in ((x0, y0), (x0, y1), (x1, y0), (x1, y1))]
    return [round(min(p[0] for p in pts), 8), round(min(p[1] for p in pts), 8),
            round(max(p[0] for p in pts), 8), round(max(p[1] for p in pts), 8)]


# ---------------------------------------------------------------------------
# Archive I/O
# ---------------------------------------------------------------------------

def load_archive_geojson() -> dict:
    with lzma.open(GEO_ARCHIVE, "rb") as f:
        return json.load(f)


def restore_working_copy() -> None:
    """(Re)write the working copy from the archive so it never drifts (e.g. a stale CI cache)."""
    t0 = time.monotonic()
    tmp = GEO_PATH.with_suffix(".geojson.tmp")
    with lzma.open(GEO_ARCHIVE, "rb") as src, open(tmp, "wb") as dst:
        while chunk := src.read(1 << 20):
            dst.write(chunk)
    tmp.replace(GEO_PATH)
    print(f"  Restored {GEO_PATH.name} from {GEO_ARCHIVE.name} ({time.monotonic() - t0:.1f}s)")


# ---------------------------------------------------------------------------
# Merge live → archive
# ---------------------------------------------------------------------------

def merge_live(archive_fc: dict, meta: list[dict], live: dict[str, dict], fetched_at: str) -> list[dict]:
    """
    Apply a live layer onto the archive (in place). Returns a list of changes
    ({kode, navn, geometry_changed, name_changed, area_change_pct}); empty when
    nothing changed. Raises SourceError when the live layer is unusable.
    """
    feats = {f["properties"]["kode"]: f for f in archive_fc["features"]}
    meta_by = {m["kode"]: m for m in meta}

    unknown = sorted(set(live) - set(feats))
    if unknown:
        # A new kommune code means a kommune reform: region and DAWA fields
        # cannot be derived safely — keep the archive and say so loudly.
        raise SourceError(f"unknown kommune codes {unknown} (kommune reform?) — needs manual update")
    missing = sorted(set(feats) - set(live) - {"0411"})
    if missing:
        raise SourceError(f"live layer is missing kommuner {missing}")
    no_meta = sorted(set(live) - set(meta_by))
    if no_meta:
        raise SourceError(f"kommuner {no_meta} missing from kommuner.json")
    # All validation is done above: nothing below raises, so a failed source
    # never leaves the archive half-modified.

    changes = []
    for kode, rec in sorted(live.items()):
        feat, m = feats[kode], meta_by[kode]
        geom_changed = not geometry_equal(feat["geometry"], rec["geometry"])
        name_changed = bool(rec["navn"]) and rec["navn"] != feat["properties"]["navn"]
        if not (geom_changed or name_changed):
            continue
        change = {"kode": kode, "navn": rec["navn"] or feat["properties"]["navn"],
                  "geometry_changed": geom_changed, "name_changed": name_changed}
        if name_changed:
            change["previous_navn"] = feat["properties"]["navn"]
            feat["properties"]["navn"] = rec["navn"]
            m["navn"] = rec["navn"]
        if geom_changed:
            old_area = geometry_area(feat["geometry"])
            new_geom = {"type": rec["geometry"]["type"], "coordinates": rec["geometry"]["coordinates"]}
            change["area_change_pct"] = round((geometry_area(new_geom) - old_area) / old_area * 100, 6)
            feat["geometry"] = new_geom
            feat["bbox"] = [round(v, 3) for v in geometry_bbox(new_geom)]
            cx, cy = visual_centre(new_geom)
            feat["properties"]["visueltcenter_x"] = round(cx, 3)
            feat["properties"]["visueltcenter_y"] = round(cy, 3)
            lon, lat = utm32n_to_wgs84(cx, cy)
            m["bbox"] = wgs84_bbox(new_geom)
            m["visueltcenter"] = [round(lon, 8), round(lat, 8)]
            feat["properties"]["geo_ændret"] = fetched_at
            m["geo_ændret"] = fetched_at
        feat["properties"]["ændret"] = fetched_at
        m["ændret"] = fetched_at
        changes.append(change)
    return changes


def write_outputs(archive_fc: dict, meta: list[dict], changed: set[str]) -> None:
    """Rewrite archive, working copy, kommuner.json and kommuner.csv after a real change."""
    text = json.dumps(archive_fc, ensure_ascii=False, separators=(",", ":"))
    GEO_PATH.write_text(text, encoding="utf-8")
    with lzma.open(GEO_ARCHIVE.with_suffix(".xz.tmp"), "wb", preset=9) as f:
        f.write(text.encode("utf-8"))
    GEO_ARCHIVE.with_suffix(".xz.tmp").replace(GEO_ARCHIVE)
    META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    if CSV_PATH.exists():
        by = {m["kode"]: m for m in meta}
        rows = list(csv.DictReader(io.StringIO(CSV_PATH.read_text(encoding="utf-8")), delimiter="|"))
        # Only touch changed rows: the CSV's centre columns predate DAWA's
        # visueltcenter for many kommuner, and unchanged rows must stay as they are.
        for row in rows:
            m = by.get(row["kode"]) if row["kode"] in changed else None
            if m:
                row["navn"] = m["navn"]
                row["centerLon"], row["centerLat"] = (str(v) for v in m["visueltcenter"])
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()), delimiter="|", lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
        CSV_PATH.write_text(buf.getvalue(), encoding="utf-8")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    t0 = time.monotonic()
    now = datetime.now(timezone.utc)
    fetched_at = now.isoformat()
    print(f"Kommune boundaries (DAGI) — {now.strftime('%Y-%m-%d %H:%M:%S UTC')}")

    meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    archive_fc = load_archive_geojson()

    sources = []
    api_key = os.environ.get("DATAFORDELER_API_KEY", "").strip()
    if api_key:
        sources.append(("datafordeler", DATAFORDELER_URL, f"{DATAFORDELER_TYPENAME}", lambda: fetch_datafordeler(api_key)))
    else:
        print("  Datafordeler DAGI: skipped (DATAFORDELER_API_KEY not set)")
    sources.append(("plandata", PLANDATA_URL, PLANDATA_TYPENAME, fetch_plandata))

    used = None
    changes: list[dict] = []
    errors: list[str] = []
    live_codes: set[str] = set()
    for name, url, layer, fetch in sources:
        try:
            live = fetch()
            changes = merge_live(archive_fc, meta, live, fetched_at)
            used = (name, url, layer)
            live_codes = set(live)
            print(f"  ✓ {name}: {len(live)} kommuner, {len(changes)} changed vs. archive")
            break
        except SourceError as e:
            errors.append(f"{name}: {e}")
            print(f"  ✗ {name}: {e}")
            # merge_live raises before mutating anything, so the archive is intact.

    if changes:
        for c in changes:
            print(f"    changed {c['kode']} {c['navn']}: geometry={c['geometry_changed']} "
                  f"name={c['name_changed']} area={c.get('area_change_pct', 0)} %")
        write_outputs(archive_fc, meta, {c["kode"] for c in changes})
        print(f"  Rewrote {GEO_ARCHIVE.name}, {META_PATH.name}, {CSV_PATH.name}")
    else:
        restore_working_copy()

    feature_count = len(archive_fc.get("features", []))
    ok = len(meta) == EXPECTED_KOMMUNER and feature_count == EXPECTED_KOMMUNER
    print(f"  kommuner.json: {len(meta)} kommuner | kommuner.geojson: {feature_count} features")
    if not ok:
        print(f"  ✗ Expected {EXPECTED_KOMMUNER} of each — boundary inputs are incomplete")

    if used:
        source_name, source_url, source_layer = used
        verified_at = fetched_at
    else:
        source_name, source_url, source_layer = "archive", None, None
        verified_at = None
        print(f"  ⚠ No live source available — using {ARCHIVE_SOURCE}")

    summary = {
        "fetched_at": fetched_at,
        "source": source_name,
        "source_url": source_url,
        "source_layer": source_layer,
        "verified_against_live_at": verified_at,
        "archive": ARCHIVE_SOURCE,
        "live_kommuner": len(live_codes),
        "changed_kommuner": changes,
        "christiansoe_from_archive": "0411" not in live_codes,
        "source_errors": errors,
        "municipalities": len(meta),
        "geojson_features": feature_count,
        "coordinate_system": "EPSG:25832",
    }
    SUMMARY_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    log_etl_run(
        source="dawa",
        endpoints=[source_url] if source_url else [],
        records={"municipalities": len(meta), "geojson_features": feature_count, "changed": len(changes)},
        status=("ok" if used else "partial") if ok else "error",
        notes=(f"DAGI kommunegrænser via {source_name}; {len(changes)} ændret ift. arkiv"
               if used else f"Ingen live-kilde ({'; '.join(errors)}) — arkiv brugt"),
        duration_seconds=time.monotonic() - t0,
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
