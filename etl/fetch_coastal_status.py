#!/usr/bin/env python3
"""
ETL: Fetch coastal water ecological status from VP3 WFS (MiljøGIS).

Fetches the aggregated marine status layer (vp3tilstand2021_marin_samlet)
from Miljøstyrelsen's WFS service. This layer contains the official
ecological and chemical status for all 109 Danish coastal waters under
the EU Water Framework Directive (VP3 2021-2027).

Endpoint: wfs2-miljoegis.mim.dk/vp3tilstand2021/ows
Layer:    vp3tilstand2021:vp3tilstand2021_marin_samlet (123 features)
          - 109 Kystvand (coastal waters) ← our target
          -  14 Territorialt farvand (territorial waters)

Output: public/data/coastal-water-status.json
Format: {
  "source": "Miljøstyrelsen VP3 tilstandsdata 2021-2027",
  "sourceUrl": "...",
  "fetchedAt": "...",
  "summary": { "total": 109, "god": 5, "moderat": 24, ... },
  "waters": {
    "Roskilde Fjord, ydre": {
      "ovId": "DKCOAST1",
      "mstId": 59681,
      "district": "Sjælland",
      "mainCatchment": "Isefjord og Roskilde Fjord",
      "areaKm2": 729.15,
      "waterType": "FjLSa-T17",
      "ecologicalStatus": "Ringe",       // aggregated
      "ecologicalGoal": "God",            // target
      "chemicalStatus": "Ikke-god",
      "subIndicators": {
        "phytoplankton": "Ringe",
        "angiosperms": "Ringe",
        "benthicFauna": "Moderat",
        "macroalgae": "Ukendt",
        "nationalSubstances": "God",
        "oxygenConditions": "Ikke relevant",
        "lightConditions": "Ikke relevant"
      }
    },
    ...
  }
}
"""

import json
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

from etl_log import log_etl_run

# Configuration
WFS_BASE = "https://wfs2-miljoegis.mim.dk/vp3tilstand2021/ows"
LAYER = "vp3tilstand2021:vp3tilstand2021_marin_samlet"

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
OUTPUT_PATH = REPO_ROOT / "public" / "data" / "coastal-water-status.json"

USER_AGENT = "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; open-source environmental monitor)"
TIMEOUT = 60

# We only need properties, not geometries (we have those in the topo)
PROPERTIES = ",".join([
    "ov_navn", "ov_id", "mst_id", "ov_kat", "ov_stoe", "ov_typ",
    "distr_na", "ho_na",
    "til_oko_sm",    # Samlet økologisk tilstand (aggregated ecological status)
    "mal_oko_sm",    # Mål for samlet økologisk tilstand (goal)
    "ov_til_kem",    # Kemisk tilstand (chemical status)
    "til_oko_fy",    # Fytoplankton (phytoplankton)
    "til_oko_an",    # Angiospermer / ålegræs (seagrass)
    "til_oko_bb",    # Bundfauna (benthic fauna)
    "til_oko_ma",    # Makroalger (macroalgae)
    "til_oko_ms",    # Nationalt specifikke stoffer
    "til_oko_il",    # Iltforhold (oxygen conditions)
    "til_oko_ly",    # Lysforhold (light conditions)
    "til_oko_af",    # Algeafgrøder (phytobenthos)
    "til_oko_be",    # Bentiske invertebrater
    "na_kun_stm",    # Naturlig/kunstig/stærkt modificeret
])


def simplify_status(raw: str | None) -> str:
    """Convert verbose Danish status strings to short labels."""
    if not raw:
        return "Ukendt"
    raw = raw.strip()
    # Map "Dårlig økologisk tilstand" → "Dårlig", etc.
    for prefix in ["God", "Moderat", "Ringe", "Dårlig", "Høj"]:
        if raw.startswith(prefix):
            return prefix
    if raw.startswith("Ikke-god"):
        return "Ikke-god"
    if "Ikke relevant" in raw:
        return "Ikke relevant"
    if "Ikke anvendelig" in raw:
        return "Ikke relevant"
    if raw == "Ukendt":
        return "Ukendt"
    return raw


def status_to_rank(status: str) -> int:
    """Numeric rank for sorting: 1 (best) to 5 (worst), 0 = unknown/irrelevant."""
    return {
        "Høj": 1, "God": 2, "Moderat": 3, "Ringe": 4, "Dårlig": 5,
        "Ikke-god": 5, "Ukendt": 0, "Ikke relevant": 0,
    }.get(status, 0)


def main():
    print("=" * 60)
    print("  Coastal Water Ecological Status — VP3 WFS Fetch")
    print("=" * 60)

    # Build WFS request (properties only, no geometry)
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": LAYER,
        "outputFormat": "application/json",
        "count": "200",
        "propertyName": PROPERTIES,
    }
    url = f"{WFS_BASE}?{urlencode(params)}"
    print(f"\n  Fetching: {url[:100]}...")

    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(req, timeout=TIMEOUT) as response:
            raw = response.read()
            print(f"    ✓ {response.status} OK — {len(raw):,} bytes")
    except (HTTPError, URLError) as e:
        print(f"    ✗ Error: {e}")
        sys.exit(1)

    data = json.loads(raw)
    features = data.get("features", [])
    print(f"  Total features: {len(features)}")

    # Filter to Kystvand only (exclude Territorialt farvand)
    kystvande = [f for f in features if f["properties"].get("ov_kat") == "Kystvand"]
    territorial = [f for f in features if f["properties"].get("ov_kat") == "Territorialt farvand"]
    print(f"  Kystvand: {len(kystvande)}, Territorialt farvand: {len(territorial)}")

    # Build output
    waters = {}
    for feat in kystvande:
        p = feat["properties"]
        name = p.get("ov_navn", "")
        if not name:
            continue

        eco_status = simplify_status(p.get("til_oko_sm"))
        eco_goal = simplify_status(p.get("mal_oko_sm"))
        chem_status = simplify_status(p.get("ov_til_kem"))

        waters[name] = {
            "ovId": p.get("ov_id", ""),
            "mstId": p.get("mst_id", 0),
            "district": p.get("distr_na", ""),
            "mainCatchment": p.get("ho_na", ""),
            "areaKm2": round(p.get("ov_stoe", 0), 2),
            "waterType": p.get("ov_typ", ""),
            "natureStatus": p.get("na_kun_stm", ""),
            "ecologicalStatus": eco_status,
            "ecologicalStatusRank": status_to_rank(eco_status),
            "ecologicalGoal": eco_goal,
            "chemicalStatus": chem_status,
            "subIndicators": {
                "phytoplankton": simplify_status(p.get("til_oko_fy")),
                "angiosperms": simplify_status(p.get("til_oko_an")),
                "benthicFauna": simplify_status(p.get("til_oko_bb")),
                "macroalgae": simplify_status(p.get("til_oko_ma")),
                "nationalSubstances": simplify_status(p.get("til_oko_ms")),
                "oxygenConditions": simplify_status(p.get("til_oko_il")),
                "lightConditions": simplify_status(p.get("til_oko_ly")),
            },
        }

    # Summary statistics
    eco_counts = Counter(w["ecologicalStatus"] for w in waters.values())
    chem_counts = Counter(w["chemicalStatus"] for w in waters.values())

    output = {
        "source": "Miljøstyrelsen VP3 tilstandsdata 2021-2027",
        "sourceUrl": "https://mst.dk/erhverv/tilskud-miljoeviden-og-data/data-og-databaser/miljoegis-data-om-natur-og-miljoe-paa-webkort",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total": len(waters),
            "ecologicalStatus": dict(eco_counts.most_common()),
            "chemicalStatus": dict(chem_counts.most_common()),
        },
        "waters": waters,
    }

    # Write output
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n  ✓ Wrote {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size:,} bytes)")
    print(f"    {len(waters)} coastal waters with status data")
    print(f"    Ecological: {dict(eco_counts.most_common())}")
    print(f"    Chemical: {dict(chem_counts.most_common())}")

    log_etl_run(
        source="fetch_coastal_status",
        endpoints=[WFS_BASE],
        records={"kystvande": len(kystvande), "territorial": len(territorial)},
        notes=f"Ecological: {dict(eco_counts.most_common())}",
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
