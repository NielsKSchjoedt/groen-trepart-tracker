#!/usr/bin/env python3
"""
ETL: Fetch actual coastal water body geometries from VP3 WFS.

This fetches the REAL water body polygons (not the land-based catchment areas)
from the VP3 tilstandsdata layer. These are the marine shapes that sit in the
water around Denmark — fjords, bays, belts, etc.

Endpoint: wfs2-miljoegis.mim.dk/vp3tilstand2021/ows
Layer:    vp3tilstand2021:vp3tilstand2021_marin_samlet

Output: public/data/water-bodies.geojson (EPSG:4326)
        — simplified GeoJSON ready for Leaflet overlay

We request CQL_FILTER=ov_type='Kystvand' to only get the 109 coastal waters,
excluding the 14 territorial waters.
"""

import json
import sys
import time
from pathlib import Path
from urllib.parse import urlencode

import requests

WFS_BASE = "https://wfs2-miljoegis.mim.dk/vp3tilstand2021/ows"
LAYER = "vp3tilstand2021:vp3tilstand2021_marin_samlet"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "public" / "data" / "water-bodies.geojson"

# First try WGS84 directly; fall back to native CRS + manual transform
PARAMS = {
    "service": "WFS",
    "version": "2.0.0",
    "request": "GetFeature",
    "typeNames": LAYER,
    "outputFormat": "application/json",
    "srsName": "EPSG:4326",
}


def simplify_coordinates(coords, precision=4):
    """Round coordinates to reduce file size (4 decimals ≈ 11m)."""
    if isinstance(coords[0], (int, float)):
        return [round(c, precision) for c in coords]
    return [simplify_coordinates(c, precision) for c in coords]


def simplify_geometry(geom, tolerance=0.002):
    """Simplify a GeoJSON geometry using Shapely's Douglas-Peucker algorithm.
    tolerance=0.002 ≈ ~220m in WGS84 at Danish latitudes — good for overview maps.
    """
    from shapely.geometry import shape, mapping
    shp = shape(geom)
    simplified = shp.simplify(tolerance, preserve_topology=True)
    return mapping(simplified)


def main():
    print(f"Fetching water body geometries from VP3 WFS...")
    print(f"  Layer: {LAYER}")
    print(f"  Filter: ov_type='Kystvand'")

    t0 = time.time()

    # Try WGS84 first
    url = f"{WFS_BASE}?{urlencode(PARAMS)}"
    try:
        resp = requests.get(url, timeout=120)
        resp.raise_for_status()
        needs_transform = False
    except requests.RequestException:
        # Fall back to native CRS (EPSG:25832)
        print("  ⚠️  WGS84 request failed, trying native CRS (EPSG:25832)...")
        params_native = {**PARAMS, "srsName": "EPSG:25832"}
        url = f"{WFS_BASE}?{urlencode(params_native)}"
        try:
            resp = requests.get(url, timeout=120)
            resp.raise_for_status()
            needs_transform = True
        except requests.RequestException as e:
            print(f"  ❌ Request failed: {e}", file=sys.stderr)
            sys.exit(1)

    elapsed = time.time() - t0
    data = resp.json()

    features = data.get("features", [])
    print(f"  ✅ {len(features)} features in {elapsed:.1f}s")

    if not features:
        print("  ❌ No features returned — check WFS endpoint", file=sys.stderr)
        sys.exit(1)

    # Transform from EPSG:25832 → WGS84 if needed
    transformer = None
    if needs_transform:
        try:
            from pyproj import Transformer
            transformer = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)
            print("  🔄 Transforming coordinates from EPSG:25832 → WGS84")
        except ImportError:
            print("  ❌ pyproj not installed. Run: pip install pyproj --break-system-packages", file=sys.stderr)
            sys.exit(1)

    def transform_coords(coords):
        """Recursively transform coordinates from UTM32 to WGS84."""
        if not transformer:
            return coords
        if isinstance(coords[0], (int, float)):
            lon, lat = transformer.transform(coords[0], coords[1])
            return [lon, lat]
        return [transform_coords(c) for c in coords]

    # Filter to only Kystvand (not Territorialt farvand) and build simplified GeoJSON
    out_features = []
    skipped = 0
    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry")
        if not geom:
            continue

        # Only include Kystvand (skip Territorialt farvand)
        ov_kat = props.get("ov_kat", "")
        if ov_kat != "Kystvand":
            skipped += 1
            continue

        # Transform coordinates if needed
        working_geom = geom.copy()
        if needs_transform:
            working_geom["coordinates"] = transform_coords(geom["coordinates"])

        # Simplify geometry to reduce file size, then round coordinates
        simplified = simplify_geometry(working_geom)
        simplified_geom = {
            "type": simplified["type"],
            "coordinates": simplify_coordinates(simplified["coordinates"]),
        }

        # Extract short ecological status from full text like "Ringe økologisk tilstand"
        raw_status = props.get("til_oko_sm", "")
        eco_status = (
            raw_status
            .replace(" økologisk tilstand", "")
            .replace(" økologisk potentiale", "")  # heavily modified water bodies use "potentiale"
            .replace("Dårligt", "Dårlig")          # normalize adjective form
            .replace("Ikke anvendelig", "Ukendt")
        ) if raw_status else "Ukendt"

        out_features.append({
            "type": "Feature",
            "properties": {
                "ov_navn": props.get("ov_navn", ""),
                "ov_id": props.get("ov_id", ""),
                "eco_status": eco_status,
            },
            "geometry": simplified_geom,
        })

    geojson = {
        "type": "FeatureCollection",
        "features": out_features,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(geojson, f, separators=(",", ":"))

    if skipped:
        print(f"  ℹ️  Skipped {skipped} non-Kystvand features (Territorialt farvand)")

    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"  📦 Wrote {len(out_features)} water body polygons → {OUTPUT_PATH.name} ({size_kb:.0f} KB)")

    # Status summary
    from collections import Counter
    statuses = Counter(f["properties"]["eco_status"] for f in out_features)
    print(f"  Ecological status breakdown: {dict(statuses.most_common())}")


if __name__ == "__main__":
    main()
