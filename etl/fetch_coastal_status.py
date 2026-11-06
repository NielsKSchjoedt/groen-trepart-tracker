#!/usr/bin/env python3
"""
ETL: Fetch coastal water ecological status from the final revisited VP3 (MiljøGIS WFS).

Fetches the aggregated marine status layer of the final, revisited river basin
management plans 2021-2027 ("Vandområdeplanerne 2021-2027 efter genbesøget",
VP3-II, adopted by BEK nr. 1670 af 8. december 2025). The layer contains the
official ecological and chemical status for all 109 Danish coastal waters
under the EU Water Framework Directive.

Until November 2026 this script read the original VP3 status layer
(vp3tilstand2021:vp3tilstand2021_marin_samlet). Same 109 water bodies and
names, but the assessment was updated in the revisit: 0 coastal waters are now
in good ecological status (was 5), mainly because "nationalt specifikke
stoffer" (national environmental quality standards for specific pollutants)
now fail in 89 of 109.

Endpoint: wfs2-miljoegis.mim.dk/vp3_2endelig2025/ows
Layer:    vp3_2endelig2025:vp3_2e2025_marin_samlet (123 features)
          - 109 Kystvand (coastal waters) ← our target
          -  14 Territorialt farvand (territorial waters)

Output: public/data/coastal-water-status.json
Format: {
  "source": "Miljøstyrelsen — Vandområdeplanerne 2021-2027 efter genbesøget (VP3-II), endelig december 2025",
  "sourceUrl": "...",
  "fetchedAt": "...",
  "summary": {
    "total": 109,
    "ecologicalStatus": {"Ringe": 51, ...},
    "ecologicalStatusExclNationalSubstances": {"God": 6, ...},
    "chemicalStatus": {...}
  },
  "waters": {
    "Roskilde Fjord, ydre": {
      "ovId": "DKCOAST1",
      "mstId": 1,
      "district": "Sjælland",
      "mainCatchment": "Isefjord og Roskilde Fjord",
      "areaKm2": 729.15,
      "waterType": "FjLSa-T17",
      "ecologicalStatus": "Ringe",       // aggregated (official)
      "ecologicalStatusExclNationalSubstances": "Ringe",  // derived, see below
      "ecologicalGoal": "God",            // target
      "chemicalStatus": "Ikke-god",
      "chemicalGoal": "God",
      "vandplandataUrl": "https://vandplandata.dk/.../DKCOAST1",
      "exemptionsUrl": "https://vandplandata.dk/.../DKCOAST1/undtagelser",
      "subIndicators": {
        "phytoplankton": "Ringe",
        "angiosperms": "Ringe",
        "benthicFauna": "Moderat",
        "nationalSubstances": "Ikke-god",
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
WFS_BASE = "https://wfs2-miljoegis.mim.dk/vp3_2endelig2025/ows"
LAYER = "vp3_2endelig2025:vp3_2e2025_marin_samlet"
PLAN_NAME = "Vandområdeplanerne 2021-2027 efter genbesøget (VP3-II), endelig december 2025"
PLAN_LEGAL_BASIS = "BEK nr. 1670 af 8. december 2025"
SOURCE_LABEL = f"Miljøstyrelsen — {PLAN_NAME}"
SOURCE_URL = "https://vandplandata.dk/vp3_2endelig2025"

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
    "til_oko_ms",    # Nationalt specifikke stoffer
    "til_oko_il",    # Iltforhold (oxygen conditions)
    "til_oko_ly",    # Lysforhold (light conditions)
    "ov_mal_kem",    # Mål for kemisk tilstand
    "na_kun_stm",    # Naturlig/kunstig/stærkt modificeret
    "link",          # vandplandata.dk page for the water body
    "link_aarsag",   # vandplandata.dk page on exemptions (undtagelser)
    # Not used: til_oko_ma / til_oko_af (macroalgae) no longer exist in the
    # revisited layer — they were "Ukendt" for all 109 in the 2021 layer anyway.
    # ov_oko_4_4n is not exposed: its meaning is not documented in the service.
])

# Quality elements that make up the official ecological status, minus
# "nationalt specifikke stoffer" (til_oko_ms). Used to derive the
# "excluding national specific substances" view that Miljøstyrelsen's own
# fact sheet reports (6 of 109 in good status for VP3-II).
ECO_ELEMENTS_EXCL_NATIONAL_SUBSTANCES = (
    "til_oko_fy", "til_oko_an", "til_oko_bb", "til_oko_il", "til_oko_ly",
)


def simplify_status(raw: str | None) -> str:
    """Convert verbose Danish status strings to short labels."""
    if not raw:
        return "Ukendt"
    raw = raw.strip()
    # Map "Dårlig økologisk tilstand" / "Dårligt økologisk potentiale" → "Dårlig", etc.
    for prefix in ["God", "Moderat", "Ringe", "Dårlig", "Høj"]:
        if raw.startswith(prefix):
            return prefix
    # Heavily modified water bodies: "Maksimalt økologisk potentiale" ≙ høj.
    if raw.startswith("Maksimalt"):
        return "Høj"
    # Supporting elements (ilt): "Understøtter god økologisk tilstand".
    if raw.startswith("Understøtter god"):
        return "God"
    if raw.startswith("Ikke-god"):
        return "Ikke-god"
    if "Ikke relevant" in raw:
        return "Ikke relevant"
    if "Ikke anvendelig" in raw:
        return "Ikke relevant"
    if raw.startswith("Ukendt"):
        return "Ukendt"
    return raw


def status_to_rank(status: str) -> int:
    """Numeric rank for sorting: 1 (best) to 5 (worst), 0 = unknown/irrelevant."""
    return {
        "Høj": 1, "God": 2, "Moderat": 3, "Ringe": 4, "Dårlig": 5,
        "Ikke-god": 5, "Ukendt": 0, "Ikke relevant": 0,
    }.get(status, 0)


def worst_status(statuses: list[str]) -> str:
    """One-out-all-out: the worst graded status wins; ungraded values are ignored."""
    graded = [st for st in statuses if status_to_rank(st) > 0 and st != "Ikke-god"]
    if not graded:
        return "Ukendt"
    return max(graded, key=status_to_rank)


def status_excl_national_substances(props: dict) -> str:
    """Ecological status recomputed without "nationalt specifikke stoffer".

    No WFS field carries this number; it is derived as worst-of the biological
    and supporting quality elements. For VP3-II it yields exactly the 6 coastal
    waters that Miljøstyrelsen's fact sheet reports as good when national
    specific substances are not counted.
    """
    return worst_status([simplify_status(props.get(k)) for k in ECO_ELEMENTS_EXCL_NATIONAL_SUBSTANCES])


def main():
    print("=" * 60)
    print("  Coastal Water Ecological Status — VP3-II (2025) WFS Fetch")
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
        chem_goal = simplify_status(p.get("ov_mal_kem"))
        eco_excl = status_excl_national_substances(p)

        mst_id = p.get("mst_id")
        try:
            mst_id = int(mst_id) if mst_id is not None else 0
        except (TypeError, ValueError):
            mst_id = 0

        waters[name] = {
            "ovId": p.get("ov_id", ""),
            "mstId": mst_id,
            "district": p.get("distr_na", ""),
            "mainCatchment": p.get("ho_na", ""),
            "areaKm2": round(p.get("ov_stoe", 0), 2),
            "waterType": p.get("ov_typ", ""),
            "natureStatus": p.get("na_kun_stm", ""),
            "ecologicalStatus": eco_status,
            "ecologicalStatusRank": status_to_rank(eco_status),
            "ecologicalStatusExclNationalSubstances": eco_excl,
            "ecologicalGoal": eco_goal,
            "chemicalStatus": chem_status,
            "chemicalGoal": chem_goal,
            "vandplandataUrl": p.get("link") or None,
            "exemptionsUrl": p.get("link_aarsag") or None,
            "subIndicators": {
                "phytoplankton": simplify_status(p.get("til_oko_fy")),
                "angiosperms": simplify_status(p.get("til_oko_an")),
                "benthicFauna": simplify_status(p.get("til_oko_bb")),
                "nationalSubstances": simplify_status(p.get("til_oko_ms")),
                "oxygenConditions": simplify_status(p.get("til_oko_il")),
                "lightConditions": simplify_status(p.get("til_oko_ly")),
            },
        }

    # Summary statistics
    eco_counts = Counter(w["ecologicalStatus"] for w in waters.values())
    eco_excl_counts = Counter(w["ecologicalStatusExclNationalSubstances"] for w in waters.values())
    chem_counts = Counter(w["chemicalStatus"] for w in waters.values())

    output = {
        "source": SOURCE_LABEL,
        "sourceUrl": SOURCE_URL,
        "plan": {
            "name": PLAN_NAME,
            "shortName": "VP3-II",
            "legalBasis": PLAN_LEGAL_BASIS,
            "wfsEndpoint": WFS_BASE,
            "wfsLayer": LAYER,
        },
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total": len(waters),
            "ecologicalStatus": dict(eco_counts.most_common()),
            "ecologicalStatusExclNationalSubstances": dict(eco_excl_counts.most_common()),
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
    print(f"    Ecological excl. national substances: {dict(eco_excl_counts.most_common())}")
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
