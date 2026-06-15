"""
WFS 2.0 GeoJSON utilities (stdlib only). Used by Arealdata + FVM fetchers.
"""
from __future__ import annotations

import json
import math
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections.abc import Iterator
from typing import Any

USER_AGENT = "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; open-source environmental monitor)"
DEFAULT_TIMEOUT = 120


def http_get(
    url: str,
    *,
    timeout: float = DEFAULT_TIMEOUT,
    retries: int = 3,
    backoff: float = 2.0,
) -> bytes:
    """GET with retries on 5xx/timeout."""
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = e
            code = getattr(e, "code", None)
            if code is not None and int(code) < 500 and int(code) != 408:
                raise
            if attempt < retries - 1:
                time.sleep(backoff * (2**attempt))
    assert last_err is not None
    raise last_err


def wfs_hits_count(wfs_base: str, type_name: str, srs: str) -> int:
    """WFS 2.0 resultType=hits — parse numberMatched from GML/JSON."""
    q = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": type_name,
        "resultType": "hits",
        "outputFormat": "application/gml+xml",
    }
    if srs:
        q["srsName"] = srs
    url = wfs_base + "?" + urllib.parse.urlencode(q, safe=":")
    raw = http_get(url).decode("utf-8", errors="replace")
    m = re.search(r'numberMatched="(\d+)"', raw) or re.search(
        r'numberOfFeatures="(\d+)"', raw
    )
    if m:
        return int(m.group(1))
    # JSON hit response
    if raw.strip().startswith("{"):
        d = json.loads(raw)
        if "numberMatched" in d:
            return int(d["numberMatched"])
    raise RuntimeError(f"Could not parse hits count from: {raw[:500]}")


def wfs_paginate_geojson_pages(
    wfs_base: str,
    type_name: str,
    *,
    page_size: int = 2000,
    sort_by: str = "cNavn",
    srs: str = "urn:ogc:def:crs:EPSG::4326",
) -> Iterator[dict[str, Any]]:
    """
    Yields one GeoJSON FeatureCollection dict per page (raw from server).
    sort_by: attribute name for stable ordering (namespace-free local name if needed).
    """
    total = wfs_hits_count(wfs_base, type_name, srs)
    for start in range(0, total, page_size):
        q: dict[str, str] = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeNames": type_name,
            "outputFormat": "application/json",
            "startIndex": str(start),
            "count": str(page_size),
            "srsName": srs,
        }
        if sort_by:
            q["sortBy"] = sort_by
        url = wfs_base + "?" + urllib.parse.urlencode(q, safe=":")
        rawb = http_get(url)
        try:
            text = rawb.decode("utf-8")
        except UnicodeDecodeError:
            text = rawb.decode("iso-8859-1", errors="replace")
        page = json.loads(text)
        if page.get("type") != "FeatureCollection":
            raise RuntimeError(f"Unexpected WFS page type: {page.get('type')}")
        yield page


def assert_dk_wgs84_feature_collection(fc: dict[str, Any], *, n_sample: int = 3) -> None:
    """Assert sample coordinates look like lon/lat in Denmark."""
    feats = fc.get("features") or []
    for f in feats[:n_sample]:
        g = f.get("geometry")
        if not g:
            continue
        c = g.get("coordinates")
        sample = c
        while sample and isinstance(sample[0], list):
            sample = sample[0]
        if not sample or len(sample) < 2:
            continue
        lon, lat = float(sample[0]), float(sample[1])
        if not (7 < lon < 16 and 54 < lat < 58):
            raise ValueError(
                f"axis-swap or bad SRS: lon={lon}, lat={lat} — check srsName and GeoServer config"
            )


def ring_area_ha_degrees(ring: list[list[float]], lat0: float) -> float:
    """
    Shoelace area in m² using degree coords × approximate metric scale at lat0, → ha.
    """
    if len(ring) < 3:
        return 0.0
    lat_rad = math.radians(lat0)
    mx = 111_320.0 * math.cos(lat_rad)
    my = 110_540.0
    a = 0.0
    for i in range(len(ring) - 1):
        x0, y0 = ring[i][0] * mx, ring[i][1] * my
        x1, y1 = ring[i + 1][0] * mx, ring[i + 1][1] * my
        a += x0 * y1 - x1 * y0
    return abs(a) * 0.5 / 10_000.0


def feature_area_ha(feat: dict[str, Any]) -> float:
    """Rough polygon / multipolygon area (outer ring only)."""
    g = feat.get("geometry")
    if not g:
        return 0.0
    t = g.get("type")
    coords = g.get("coordinates")
    if not coords:
        return 0.0
    if t == "Polygon":
        rings = [coords[0]]
    elif t == "MultiPolygon":
        rings = [poly[0] for poly in coords if poly]
    else:
        return 0.0
    s = 0.0
    for ring in rings:
        if not ring:
            continue
        lats = [p[1] for p in ring if len(p) >= 2]
        lat0 = sum(lats) / len(lats) if lats else 56.0
        s += ring_area_ha_degrees([list(map(float, p[:2])) for p in ring], lat0)
    return round(s, 4)


def write_geojson_feature_collection_streaming(
    path: str,
    feature_iter: Iterator[dict[str, Any]],
    *,
    total_hint: int | None = None,
) -> int:
    """
    Write a FeatureCollection to JSON without holding all features in memory.
    Yields each feature from iterator (Feature dicts).
    """
    n = 0
    with open(path, "w", encoding="utf-8") as out:
        out.write('{"type":"FeatureCollection","features":[\n')
        first = True
        for feat in feature_iter:
            if not first:
                out.write(",\n")
            first = False
            out.write(json.dumps(feat, ensure_ascii=False, separators=(",", ":")))
            n += 1
        out.write("\n]}\n")
    return n
