#!/usr/bin/env python3
"""
ETL: Fetch Klimaskovfonden (Climate Forest Fund) project data via WFS.

Klimaskovfonden maintains a WFS endpoint with polygon geometries for all their
afforestation and lowland projects. This is a critical supplementary data source
for the Afforestation pillar — MARS only tracks ~2,400 ha of afforestation
through its water quality project system, while Klimaskovfonden tracks ~2,300 ha
of *additional* voluntary afforestation projects nationwide.

WFS endpoint: https://test.admin.gc2.io/ows/klimaskovfonden/public/
Feature types:
  - klimaskovfonden:public.klimaskovfondens_projekter (current, live)
  - klimaskovfonden:public.klimaskovfondens_projekter_april_2025 (snapshot)
  - klimaskovfonden:public.klimaskovfondens_projekter_marts_2025 (snapshot)

Each feature has:
  - the_geom: MultiPolygon (EPSG:4326)
  - sagsnummer: Case number (e.g. "2024-99")
  - aargang: Batch/year (e.g. "2024-5")
  - projekttyp: "Skovrejsning" (afforestation) or "Lavbund" (lowland)

Area is computed from polygon geometry (Shoelace formula on projected coords).
"""

import json
import math
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from urllib.parse import quote

from etl_log import log_etl_run

# Configuration
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_DIR = REPO_ROOT / "data" / "klimaskovfonden"

WFS_BASE = "https://test.admin.gc2.io/ows/klimaskovfonden/public/"
LAYER = "klimaskovfonden:public.klimaskovfondens_projekter"
DAWA_REVERSE_URL = "https://api.dataforsyningen.dk/kommuner/reverse"
USER_AGENT = "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; open-source environmental monitor)"
TIMEOUT_SECONDS = 60
DAWA_TIMEOUT_SECONDS = 10


def fetch_gml(max_features: int = 500) -> str:
    """Fetch all features as GML2 (the format this WFS reliably supports)."""
    url = (
        f"{WFS_BASE}?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature"
        f"&TYPENAMES={LAYER}&MAXFEATURES={max_features}&OUTPUTFORMAT=GML2"
    )
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
        return response.read().decode("utf-8")


def fetch_hit_count() -> int:
    """Get total feature count."""
    url = (
        f"{WFS_BASE}?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature"
        f"&TYPENAMES={LAYER}&RESULTTYPE=hits"
    )
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
        raw = response.read().decode("utf-8")
        # Parse numberOfFeatures from the response
        import re
        match = re.search(r'numberOfFeatures="(\d+)"', raw)
        return int(match.group(1)) if match else 0


def parse_gml_coords(text: str) -> list[tuple[float, float]]:
    """Parse GML coordinate pairs 'lat,lon lat,lon ...' → [(lon, lat), ...]"""
    pairs = text.strip().split()
    return [(float(p.split(",")[1]), float(p.split(",")[0])) for p in pairs]


def polygon_area_ha(coords: list[tuple[float, float]]) -> float:
    """Approximate area in hectares using Shoelace formula on WGS84 coords."""
    if len(coords) < 3:
        return 0
    avg_lat = sum(c[1] for c in coords) / len(coords)
    cos_lat = math.cos(math.radians(avg_lat))

    # Project to meters
    pts = [(lon * cos_lat * 111319.5, lat * 111319.5) for lon, lat in coords]

    # Shoelace
    n = len(pts)
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += pts[i][0] * pts[j][1]
        area -= pts[j][0] * pts[i][1]
    return abs(area) / 2.0 / 10_000  # m² → ha


def compute_centroid(coords: list[tuple[float, float]]) -> tuple[float, float]:
    """Compute centroid of a polygon ring."""
    if not coords:
        return (0, 0)
    avg_lon = sum(c[0] for c in coords) / len(coords)
    avg_lat = sum(c[1] for c in coords) / len(coords)
    return (round(avg_lon, 6), round(avg_lat, 6))


def reverse_geocode_kommune(lon: float, lat: float) -> str | None:
    """
    Resolve a WGS84 point to a Danish municipality name via DAWA reverse geocoding.

    Returns the municipality name (e.g. "Vejle Kommune") or None on failure.
    Uses Dataforsyningen's free, unauthenticated API.

    Example call:
        reverse_geocode_kommune(9.358, 55.733)  # → "Kolding Kommune"
    """
    url = f"{DAWA_REVERSE_URL}?x={lon}&y={lat}&srid=4326"
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=DAWA_TIMEOUT_SECONDS) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("navn")
    except Exception:
        return None


def reverse_geocode_batch(features: list[dict]) -> dict[str, str]:
    """
    Batch reverse-geocode all feature centroids to municipality names.

    Deduplicates nearby points (rounded to 2 decimal places) to minimize API calls.
    Returns a mapping of sagsnummer → kommune name.

    @param features - List of parsed feature dicts with 'centroid' [lon, lat]
    @returns Dict mapping sagsnummer to municipality name
    """
    cache: dict[str, str | None] = {}
    result: dict[str, str] = {}
    total = len(features)

    for i, feat in enumerate(features):
        lon, lat = feat["centroid"]
        if lon == 0 and lat == 0:
            continue

        cache_key = f"{lon:.2f},{lat:.2f}"
        if cache_key not in cache:
            kommune = reverse_geocode_kommune(lon, lat)
            cache[cache_key] = kommune
            time.sleep(0.05)

        if cache[cache_key]:
            result[feat["sagsnummer"]] = cache[cache_key]

        if (i + 1) % 50 == 0:
            print(f"    geocoded {i + 1}/{total}...")

    return result


def parse_features(gml_text: str) -> list[dict]:
    """Parse GML features into structured dicts with area, centroid, and year."""
    root = ET.fromstring(gml_text)
    ns = {
        "gml": "http://www.opengis.net/gml",
        "ksf": "https://test.admin.gc2.io",
    }

    features = []
    for member in root.findall(".//gml:featureMember", ns):
        proj = member[0]

        sagsnr_el = proj.find("ksf:sagsnummer", ns)
        aargang_el = proj.find("ksf:aargang", ns)
        typ_el = proj.find("ksf:projekttyp", ns)

        sagsnummer = sagsnr_el.text if sagsnr_el is not None else ""
        aargang = aargang_el.text if aargang_el is not None else ""
        projekttyp = typ_el.text if typ_el is not None else ""

        # Compute area and centroid from all polygon rings
        total_ha = 0.0
        all_coords: list[tuple[float, float]] = []
        for ring in proj.findall(
            ".//gml:outerBoundaryIs/gml:LinearRing/gml:coordinates", ns
        ):
            coords = parse_gml_coords(ring.text)
            total_ha += polygon_area_ha(coords)
            all_coords.extend(coords)

        centroid = compute_centroid(all_coords) if all_coords else (0, 0)

        # Extract year from aargang (e.g. "2024-5" → 2024)
        year = None
        if aargang and "-" in aargang:
            try:
                year = int(aargang.split("-")[0])
            except ValueError:
                pass

        features.append({
            "sagsnummer": sagsnummer,
            "aargang": aargang,
            "year": year,
            "projekttyp": projekttyp,
            "areaHa": round(total_ha, 2),
            "centroid": list(centroid),  # [lon, lat]
        })

    return features


def main():
    start_time = time.time()
    print(f"Klimaskovfonden WFS ETL — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Endpoint: {WFS_BASE}")
    print(f"Layer: {LAYER}")
    print(f"Output: {DATA_DIR}")
    print()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    errors = []

    # Step 1: Get feature count
    print("Counting features...")
    try:
        total_count = fetch_hit_count()
        print(f"  ✓ {total_count} features")
    except Exception as e:
        print(f"  ✗ Error: {e}")
        errors.append(f"hit_count: {e}")
        total_count = 0

    # Step 2: Fetch all features
    print("Fetching all features as GML...")
    try:
        gml_text = fetch_gml(max_features=500)
        print(f"  ✓ {len(gml_text):,} bytes")
    except Exception as e:
        print(f"  ✗ Error: {e}")
        errors.append(f"fetch: {e}")
        gml_text = None

    if not gml_text:
        print("No data fetched — aborting.")
        return 1

    # Step 3: Parse features
    print("Parsing features...")
    features = parse_features(gml_text)
    print(f"  ✓ {len(features)} features parsed")

    # Step 4: Reverse-geocode centroids → municipality names via DAWA
    print("Reverse-geocoding centroids to municipalities (DAWA)...")
    try:
        kommune_map = reverse_geocode_batch(features)
        for feat in features:
            feat["kommune"] = kommune_map.get(feat["sagsnummer"])
        matched = sum(1 for f in features if f.get("kommune"))
        print(f"  ✓ {matched}/{len(features)} matched to a municipality")
    except Exception as e:
        print(f"  ✗ Geocoding failed: {e} — continuing without municipality data")
        errors.append(f"geocoding: {e}")
        for feat in features:
            feat["kommune"] = None

    # Step 5: Compute statistics
    total_area_ha = sum(f["areaHa"] for f in features)
    by_type: dict[str, dict] = {}
    by_year: dict[str, dict] = {}

    for f in features:
        typ = f["projekttyp"] or "Ukendt"
        if typ not in by_type:
            by_type[typ] = {"count": 0, "areaHa": 0}
        by_type[typ]["count"] += 1
        by_type[typ]["areaHa"] = round(by_type[typ]["areaHa"] + f["areaHa"], 2)

        yr = f["aargang"] or "Ukendt"
        if yr not in by_year:
            by_year[yr] = {"count": 0, "areaHa": 0}
        by_year[yr]["count"] += 1
        by_year[yr]["areaHa"] = round(by_year[yr]["areaHa"] + f["areaHa"], 2)

    afforestation_ha = by_type.get("Skovrejsning", {}).get("areaHa", 0)
    lowland_ha = by_type.get("Lavbund", {}).get("areaHa", 0)

    # Step 6: Build summary
    summary = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "name": "Klimaskovfonden (Den Danske Klimaskovfond)",
            "description": "Voluntary afforestation and lowland projects tracked by the Danish Climate Forest Fund. Project polygon geometries via WFS.",
            "wfs_base": WFS_BASE,
            "layer": LAYER,
            "registry_url": "https://klimaskovfonden.dk/vores-standard/register",
            "coordinate_system": "EPSG:4326",
        },
        "totals": {
            "feature_count": len(features),
            "total_area_ha": round(total_area_ha, 1),
            "afforestation_ha": round(afforestation_ha, 1),
            "afforestation_count": by_type.get("Skovrejsning", {}).get("count", 0),
            "lowland_ha": round(lowland_ha, 1),
            "lowland_count": by_type.get("Lavbund", {}).get("count", 0),
        },
        "by_type": by_type,
        "by_year": dict(sorted(by_year.items())),
        "note": "Area computed from WGS84 polygon geometry using Shoelace formula. "
                "May differ slightly from official registry figures. "
                "Klimaskovfonden's Power BI registry reports 249 projects / 2,871 ha — "
                "the WFS layer may lag behind the registry.",
    }

    summary_path = DATA_DIR / "summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # Step 7: Save project list (without full geometry — just centroids, areas, and kommune)
    projects_path = DATA_DIR / "projects.json"
    with open(projects_path, "w", encoding="utf-8") as f:
        json.dump(features, f, ensure_ascii=False, indent=2)

    # Print headline
    print()
    print("=" * 60)
    print("KLIMASKOVFONDEN — HEADLINE")
    print("=" * 60)
    print(f"  Total projects: {len(features)}")
    print(f"  Total area:     {total_area_ha:.1f} ha")
    print(f"  Skovrejsning:   {by_type.get('Skovrejsning', {}).get('count', 0)} projects, {afforestation_ha:.1f} ha")
    print(f"  Lavbund:        {by_type.get('Lavbund', {}).get('count', 0)} projects, {lowland_ha:.1f} ha")
    print()
    print("By year/batch:")
    for yr, stats in sorted(by_year.items()):
        print(f"  {yr}: {stats['count']} projects, {stats['areaHa']:.1f} ha")
    print()

    duration = time.time() - start_time
    log_etl_run(
        source="klimaskovfonden",
        endpoints=[WFS_BASE],
        records={"projects": len(features)},
        status="ok" if not errors else "partial",
        notes=f"{len(features)} projects, {total_area_ha:.1f} ha total ({afforestation_ha:.1f} ha afforestation)",
        duration_seconds=duration,
    )

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
