#!/usr/bin/env python3
"""
Fetch Naturstyrelsen state afforestation project data from MiljøGIS WFS.

Data sources:
  1. WFS layer `skovdrift:Naturstyrelsens arealoversigt` — 996 polygon features
     covering all NST-managed forest areas with precise geometry and area.
  2. Known skovrejsning project name list from naturstyrelsen.dk/ny-natur/skovrejsning/

The MARS database has an "NST Skovrejsning" subsidy scheme defined but with
0 projects registered — Naturstyrelsen hasn't entered their data there yet.
This fetcher bridges that gap by matching the website project list against
the WFS geodata layer.

Output:
  data/naturstyrelsen-skov/projects.json  — matched project features
  data/naturstyrelsen-skov/summary.json   — totals and metadata
"""

import json
import math
import os
import sys
import time
import urllib.request
from datetime import datetime
from urllib.request import urlopen, Request

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'naturstyrelsen-skov')

DAWA_REVERSE_URL = "https://api.dataforsyningen.dk/kommuner/reverse"
DAWA_TIMEOUT_SECONDS = 10
USER_AGENT = "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; open-source environmental monitor)"

WFS_URL = (
    "https://wfs2-miljoegis.mim.dk/skovdrift/ows"
    "?service=WFS&version=1.0.0&request=GetFeature"
    "&typeName=skovdrift:Naturstyrelsens%20arealoversigt"
    "&maxFeatures=1000&outputFormat=application/json"
)

# ---------------------------------------------------------------------------
# Known skovrejsning projects from naturstyrelsen.dk
# Each entry: (display name, search terms to match in skovnavn, status, url)
# ---------------------------------------------------------------------------

KNOWN_PROJECTS = [
    # -----------------------------------------------------------------------
    # Igangværende projekter (29 on the page, minus 1 sub-page = 28 unique)
    # Source: https://naturstyrelsen.dk/ny-natur/skovrejsning/skovrejsningsprojekter/
    # -----------------------------------------------------------------------
    ("Arden Skov", ["arden"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/arden-skov"),
    ("Bynær skov ved Brovst", ["brovst"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/bynaer-skov-ved-brovst"),
    ("Drastrup Skov", ["drastrup"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/drastrup-skov"),
    ("Elmelund Skov 2016-2026", ["elmelund"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/elmelund-skov-2016-2026"),
    ("Eriksborg Skov", ["eriksborg"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/eriksborg-skov"),
    ("Geding Skov", ["geding"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/geding-skov"),
    ("Greve Skov", ["greve skov"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/greve-skov"),
    ("Gulddysse Skov", ["gulddysse"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/gulddysse-skov"),
    ("Gørløse Skov", ["gørløse", "goerloese"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/goerloese-skov"),
    ("Himmelev Skov", ["himmelev"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/himmelev-skov"),
    ("Højballe Skov", ["højballe", "hoejballe"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/hoejballe-skov"),
    ("Hørup Skov", ["hørup", "hoerup"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/hoerup-skov"),
    ("Lundager Skov", ["lundager"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/lundager-skov"),
    ("Nordmandsskoven", ["nordmand"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/nordmandsskoven"),
    ("Nørager Skov", ["nørager", "noerager"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/noerager-skov"),
    ("Oksbøl Skov, Nordals", ["oksbøl", "oksbol"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/oksboel-skov-nordals"),
    ("Poulstrup Skov", ["poulstrup"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/poulstrup-skov"),
    ("Rugballegård Skov", ["rugballeg"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/rugballegaard-skov"),
    ("Slotved Skov", ["slotved"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/slotved-skov"),
    ("Skovrejsning ved Brovst", ["brovst"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/skovrejsning-ved-brovst"),
    ("Skovrejsning ved Himmelev", ["himmelev"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/skovrejsning-ved-himmelev"),
    ("Skovrejsning ved Højby og Lindved", ["højby", "lindved", "hoejby"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/skovrejsning-ved-hoejby-og-lindved"),
    ("Skovrejsning ved Svendborg", ["svendborg"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/skovrejsning-ved-svendborg"),
    ("Solhøj Fælled", ["solhøj", "solhoej"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/solhoej-faelled"),
    ("True Skov for alle", ["true skov"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/true-skov-for-alle"),
    ("Tune Skov", ["tune skov"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/tune-skov"),
    ("Æbelholt Skov", ["æbelholt", "aebelholt"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/aebelholt-skov"),
    ("Aabybro-Biersted skovrejsning", ["aabybro", "biersted"], "ongoing", "https://naturstyrelsen.dk/ny-natur/skovrejsning/aabybro-biersted-skovrejsning"),
    # Note: "True Skov for alle - målsætninger" is a sub-page, not a separate project

    # -----------------------------------------------------------------------
    # Gennemførte projekter (18 projects)
    # -----------------------------------------------------------------------
    ("Anebjerg Skov", ["anebjerg"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/anebjerg-skov"),
    ("Bærmoseskov og Himmerigskov", ["bærmose", "himmerig", "baermose"], "completed", "https://naturstyrelsen.dk/find-et-naturomraade/naturguider/soehoejlandet-og-oestjylland/himmerigskov-og-baermoseskov"),
    ("Elmelund Skov 2001-2015", ["elmelund"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/elmelund-skov-2001-2015"),
    ("Glumsø — ny statsskov", ["glumsø", "glumso"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/glumsoe-ny-statsskov"),
    ("Harte Skov", ["harte"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/harte-skov"),
    ("Hoppes Skov", ["hoppes", "hoppeshuse"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/hoppes-skov"),
    ("Hvinningdal Skov", ["hvinningdal"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/hvinningdal-skov"),
    ("Højbjerg — natur- og skovrejsning", ["højbjerg", "hoejbjerg"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/hoejbjerg"),
    ("Højbjerg Skov — ved Korsør", ["korsør", "korsoer", "højbjerg skov"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/hoejbjerg-skov-korsoer"),
    ("Løvbakke Skov og Vinderup Skov", ["løvbakke", "vinderup", "loevbakke"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/loevbakke-skov"),
    ("Nakskov — natur- og skovrejsning", ["nakskov"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/nakskov"),
    ("Næstved — natur- og skovrejsning", ["næstved", "naestved"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/naestved"),
    ("Sebberup Skov", ["sebberup"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/sebberup-skov"),
    ("Skælskør — ny statsskov", ["skælskør", "skaelskoer"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/skaelskoer"),
    ("Snubbekorsskoven", ["snubbek"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/snubbekorsskoven"),
    ("Sperrestrup Skov — ved Ølstykke", ["sperrestrup", "ølstykke"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/sperrestrup-skov"),
    ("True Skov — skovrejsning", ["true skov"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/true-skov-skovrejsning"),
    ("Aaby Skoven — ny skov ved Aabybro", ["aaby skov", "aaby_skov"], "completed", "https://naturstyrelsen.dk/ny-natur/skovrejsning/aaby-skoven"),
]


# ---------------------------------------------------------------------------
# DAWA reverse geocoding: WGS84 centroid → municipality name
# ---------------------------------------------------------------------------

def reverse_geocode_kommune(lon: float, lat: float) -> str | None:
    """
    Resolve a WGS84 point to a Danish municipality name via DAWA reverse geocoding.

    Returns the municipality name (e.g. "Vejle") or None on failure.
    Uses Dataforsyningen's free, unauthenticated API.

    @param lon - Longitude in WGS84
    @param lat - Latitude in WGS84
    @returns Municipality name or None

    @example reverse_geocode_kommune(9.358, 55.733)  # → "Kolding"
    """
    url = f"{DAWA_REVERSE_URL}?x={lon}&y={lat}&srid=4326"
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=DAWA_TIMEOUT_SECONDS) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("navn")
    except Exception:
        return None


def geocode_projects(projects: list[dict]) -> list[dict]:
    """
    Add a `kommune` field to each project that has a centroid via DAWA reverse geocoding.

    Projects without a centroid receive `kommune: null`. Results are cached by
    rounded coordinates to avoid duplicate API calls for nearby projects.

    @param projects - List of matched project dicts with optional 'centroid' [lon, lat]
    @returns The same list with 'kommune' field added to each entry

    @example geocode_projects([{"name": "Arden Skov", "centroid": [9.87, 56.78], ...}])
    """
    cache: dict[str, str | None] = {}
    total = sum(1 for p in projects if p.get("centroid"))

    geocoded = 0
    for proj in projects:
        centroid = proj.get("centroid")
        if not centroid:
            proj["kommune"] = None
            continue

        lon, lat = centroid
        cache_key = f"{lon:.2f},{lat:.2f}"

        if cache_key not in cache:
            cache[cache_key] = reverse_geocode_kommune(lon, lat)
            time.sleep(0.05)

        proj["kommune"] = cache[cache_key]
        geocoded += 1
        if geocoded % 10 == 0:
            print(f"    geocoded {geocoded}/{total}...")

    return projects


# ---------------------------------------------------------------------------
# Coordinate transform: EPSG:25832 (UTM32N) → WGS84
# ---------------------------------------------------------------------------

def utm32n_to_wgs84(easting: float, northing: float) -> tuple[float, float]:
    """
    Approximate conversion from EPSG:25832 (ETRS89 / UTM zone 32N)
    to WGS84 (lon, lat). Uses the inverse UTM equations.
    Accuracy: ~1m for Denmark, which is fine for map display.
    """
    # UTM zone 32N parameters
    k0 = 0.9996
    a = 6378137.0           # WGS84 semi-major
    f = 1 / 298.257223563   # WGS84 flattening
    e = math.sqrt(2 * f - f * f)
    e2 = e * e
    e_prime2 = e2 / (1 - e2)

    x = easting - 500000.0  # remove false easting
    y = northing

    M = y / k0
    mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))

    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
            + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
            + (151 * e1 ** 3 / 96) * math.sin(6 * mu))

    N1 = a / math.sqrt(1 - e2 * math.sin(phi1) ** 2)
    T1 = math.tan(phi1) ** 2
    C1 = e_prime2 * math.cos(phi1) ** 2
    R1 = a * (1 - e2) / (1 - e2 * math.sin(phi1) ** 2) ** 1.5
    D = x / (N1 * k0)

    lat = phi1 - (N1 * math.tan(phi1) / R1) * (
        D ** 2 / 2
        - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * e_prime2) * D ** 4 / 24
        + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2
           - 252 * e_prime2 - 3 * C1 ** 2) * D ** 6 / 720
    )

    lon_central = math.radians(9.0)  # zone 32N central meridian
    lon = lon_central + (
        D
        - (1 + 2 * T1 + C1) * D ** 3 / 6
        + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2
           + 8 * e_prime2 + 24 * T1 ** 2) * D ** 5 / 120
    ) / math.cos(phi1)

    return (math.degrees(lon), math.degrees(lat))


def polygon_centroid_utm(coords: list) -> tuple[float, float]:
    """Compute centroid of a polygon from UTM coordinates.
    For MultiPolygon, uses the first ring of the first polygon."""
    # Handle MultiPolygon nesting
    if coords and isinstance(coords[0], list) and isinstance(coords[0][0], list) and isinstance(coords[0][0][0], list):
        # MultiPolygon: [polygon1, polygon2, ...] where each polygon is [ring1, ring2, ...]
        # Use the largest polygon by vertex count
        best = max(coords, key=lambda poly: len(poly[0]) if poly else 0)
        ring = best[0]
    elif coords and isinstance(coords[0], list) and isinstance(coords[0][0], list):
        # Polygon: [ring1, ring2, ...]
        ring = coords[0]
    else:
        ring = coords

    if not ring:
        return (0, 0)

    # Simple average centroid (good enough for display)
    n = len(ring)
    cx = sum(p[0] for p in ring) / n
    cy = sum(p[1] for p in ring) / n
    return (cx, cy)


# ---------------------------------------------------------------------------
# WFS fetch
# ---------------------------------------------------------------------------

def fetch_wfs() -> list[dict]:
    """Fetch all features from the NST arealoversigt WFS layer."""
    print(f"Fetching NST arealoversigt from WFS...")
    req = urllib.request.Request(WFS_URL, headers={
        'User-Agent': 'GroenTrepartTracker/1.0',
        'Accept': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())

    features = data.get('features', [])
    print(f"  Received {len(features)} features (total: {data.get('totalFeatures', '?')})")
    return features


# ---------------------------------------------------------------------------
# Name matching
# ---------------------------------------------------------------------------

def fix_wfs_encoding(text: str) -> str:
    """
    Repair double-encoded UTF-8 strings from the MiljøGIS WFS.

    The skovdrift WFS layer stores Danish characters as UTF-8 bytes but the
    GeoServer JSON serializer re-interprets them as Latin-1 code points,
    producing mojibake like 'SÃ¸hÃ¸jlandet' instead of 'Søhøjlandet'.

    The fix: encode back to Latin-1 (reversing the wrong interpretation),
    then decode as UTF-8 (the actual encoding).

    @param text: Potentially double-encoded string from WFS
    @returns: Correctly decoded string, or the original if repair fails
    @example fix_wfs_encoding('SÃ¸hÃ¸jlandet')  # => 'Søhøjlandet'
    @example fix_wfs_encoding('Himmerland')        # => 'Himmerland' (no-op)
    """
    if not text:
        return text
    try:
        return text.encode('latin-1').decode('utf-8')
    except (UnicodeDecodeError, UnicodeEncodeError):
        return text


def normalize_name(name: str) -> str:
    """Normalize a name for fuzzy matching."""
    if not name:
        return ''
    name = fix_wfs_encoding(name)
    return name.lower().strip()


def match_features(features: list[dict]) -> list[dict]:
    """Match WFS features against known skovrejsning project names."""
    matched = []
    used_feature_ids = set()

    for display_name, search_terms, status, url in KNOWN_PROJECTS:
        best_match = None
        best_area = 0

        for feat in features:
            fid = feat.get('id', '')
            if fid in used_feature_ids:
                continue

            props = feat.get('properties', {})
            skovnavn = normalize_name(props.get('skovnavn', ''))

            for term in search_terms:
                if term.lower() in skovnavn:
                    area = props.get('areal', 0)
                    # Prefer the largest matching feature (avoid small sub-plots)
                    if area > best_area:
                        best_match = feat
                        best_area = area
                    break

        if best_match:
            fid = best_match.get('id', '')
            used_feature_ids.add(fid)
            props = best_match.get('properties', {})
            geo = best_match.get('geometry', {})

            # Compute centroid in UTM, convert to WGS84
            coords = geo.get('coordinates', [])
            utm_centroid = polygon_centroid_utm(coords)
            wgs84_centroid = utm32n_to_wgs84(utm_centroid[0], utm_centroid[1])

            matched.append({
                'name': display_name,
                'wfsSkovnavn': fix_wfs_encoding(props.get('skovnavn', '')),
                'district': fix_wfs_encoding(props.get('distnavn', '')),
                'districtCode': props.get('distkode', ''),
                'areaHa': round(props.get('areal', 0), 2),
                'status': status,
                'url': url,
                'centroid': [round(wgs84_centroid[0], 6), round(wgs84_centroid[1], 6)],
                'wfsId': fid,
            })
            print(f"  ✓ {display_name}: {props.get('areal', 0):.1f} ha ({props.get('distnavn', '?')})")
        else:
            print(f"  ✗ {display_name}: not found in WFS")
            # Still include it but without geometry data
            matched.append({
                'name': display_name,
                'wfsSkovnavn': None,
                'district': None,
                'districtCode': None,
                'areaHa': None,
                'status': status,
                'url': url,
                'centroid': None,
                'wfsId': None,
                'kommune': None,
            })

    return matched


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    features = fetch_wfs()
    projects = match_features(features)

    print(f"\nReverse-geocoding {sum(1 for p in projects if p.get('centroid'))} project centroids via DAWA...")
    projects = geocode_projects(projects)

    matched_projects = [p for p in projects if p['areaHa'] is not None]
    unmatched = [p for p in projects if p['areaHa'] is None]
    ongoing = [p for p in matched_projects if p['status'] == 'ongoing']
    completed = [p for p in matched_projects if p['status'] == 'completed']

    summary = {
        'source': 'MiljøGIS WFS — Naturstyrelsens arealoversigt',
        'sourceUrl': 'https://wfs2-miljoegis.mim.dk/skovdrift/ows',
        'layer': 'skovdrift:Naturstyrelsens arealoversigt',
        'coordinateSystem': 'EPSG:25832 (UTM32N) → converted to WGS84',
        'projectListSource': 'https://naturstyrelsen.dk/ny-natur/skovrejsning/skovrejsningsprojekter/',
        'fetchedAt': datetime.utcnow().isoformat() + 'Z',
        'note': (
            'MARS has an "NST Skovrejsning" subsidy scheme with 0 projects registered. '
            'This fetcher bridges the gap by matching known project names from '
            'Naturstyrelsen website against the MiljøGIS WFS geodata layer. '
            'Area figures are actual managed forest extent from WFS polygon geometry.'
        ),
        'totals': {
            'totalKnownProjects': len(projects),
            'matchedInWfs': len(matched_projects),
            'unmatchedInWfs': len(unmatched),
            'geocodedCount': sum(1 for p in projects if p.get('kommune')),
            'ongoingCount': len(ongoing),
            'completedCount': len(completed),
            'ongoingAreaHa': round(sum(p['areaHa'] for p in ongoing), 1),
            'completedAreaHa': round(sum(p['areaHa'] for p in completed), 1),
            'totalAreaHa': round(sum(p['areaHa'] for p in matched_projects), 1),
        },
        'wfsLayerTotalFeatures': len(features),
        'wfsLayerTotalAreaHa': round(sum(
            f.get('properties', {}).get('areal', 0) for f in features
        ), 0),
    }

    # Write outputs
    with open(os.path.join(OUT_DIR, 'projects.json'), 'w') as f:
        json.dump(projects, f, indent=2, ensure_ascii=False)

    with open(os.path.join(OUT_DIR, 'summary.json'), 'w') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print(f"Naturstyrelsen state afforestation (WFS-matched):")
    print(f"  Known projects:   {len(projects)} ({len(matched_projects)} matched in WFS)")
    print(f"  Ongoing:          {len(ongoing)} projects ({summary['totals']['ongoingAreaHa']} ha)")
    print(f"  Completed:        {len(completed)} projects ({summary['totals']['completedAreaHa']} ha)")
    print(f"  Total:            {len(matched_projects)} projects ({summary['totals']['totalAreaHa']} ha)")
    if unmatched:
        print(f"  Not in WFS:       {', '.join(p['name'] for p in unmatched)}")
    print(f"  WFS layer total:  {len(features)} forests ({summary['wfsLayerTotalAreaHa']:.0f} ha)")
    print(f"  Output:           {OUT_DIR}/")


if __name__ == '__main__':
    main()
