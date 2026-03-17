#!/usr/bin/env python3
"""
ETL: Transform raw Klimaregnskab API data into dashboard-ready JSON.

Reads:  data/klimaregnskab/noegletal_raw.json
Writes: public/data/klimaregnskab-by-kommune.json
        data/klimaregnskab/by_kommune.json  (ETL reference copy)

Output shape per municipality:
  {
    "kommuneKode": "0101",
    "kommuneNavn": "København",
    "years": [2018, 2019, 2020, 2021, 2022, 2023],
    "samletUdledning":   [...],  // Ton CO₂e (total, Scope 1+2)
    "udledningPrCapita": [...],  // Ton CO₂e/indb.
    "sektorer": {
      "energi":    [...],        // Energi (el, fjernvarme, brændsler)
      "transport": [...],        // Transport
      "landbrug":  [...],        // Landbrug
      "affald":    [...],        // Affaldsdeponi + Spildevand
      "industri":  [...]         // Kemiske processer
    },
    "veAndel": [...]             // VE-el selvforsyningsgrad (0-1 fraction)
  }

Sector mapping from API sektor field:
  "Energi"            → energi
  "Transport"         → transport
  "Landbrug"          → landbrug
  "Affaldsdeponi"     → affald (summed with Spildevand)
  "Spildevand"        → affald (summed with Affaldsdeponi)
  "Kemiske processer" → industri
  "Samlet"            → samletUdledning, udledningPrCapita

Note on duplicate "Samlet" rows: the API returns two "Samlet CO₂-udledning" rows
in Ton CO₂e. The lower value uses the standard accounting boundary (Scope 1+2).
We take the minimum to avoid double-counting.
"""

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

INPUT_PATH = REPO_ROOT / "data" / "klimaregnskab" / "noegletal_raw.json"
OUTPUT_DIR = REPO_ROOT / "public" / "data"
ETL_OUTPUT_DIR = REPO_ROOT / "data" / "klimaregnskab"

YEARS = [2018, 2019, 2020, 2021, 2022, 2023]

# Sector mapping: API sektor → output key
# Affaldsdeponi and Spildevand are summed into "affald"
SEKTOR_MAP = {
    "Energi": "energi",
    "Transport": "transport",
    "Landbrug": "landbrug",
    "Affaldsdeponi": "affald",
    "Spildevand": "affald",
    "Kemiske processer": "industri",
}

SEKTORER = ["energi", "transport", "landbrug", "affald", "industri"]


def extract_year_values(rows: list, year: int) -> dict:
    """
    Extract the key metric values from a single municipality/year response.

    Returns a dict with samletUdledning, udledningPrCapita, sektorer, veAndel.
    """
    # Filter rows for this type
    co2_ton = {}    # sektor → value in Ton CO₂e
    co2_capita = [] # Samlet → Ton CO₂e/indb. values (may be duplicates)
    ve_andel = None

    for row in rows:
        sektor = row.get("sektor", "")
        rtype = row.get("type", "")
        enhed = row.get("enhed", "")
        value = row.get("værdi") or 0.0

        if rtype == "Samlet CO2-udledning":
            if enhed == "Ton CO2e":
                # Accumulate per sector; for "Samlet" keep the minimum (avoids duplicate rows)
                if sektor == "Samlet":
                    co2_ton.setdefault("Samlet", [])
                    co2_ton["Samlet"].append(value)
                elif sektor in SEKTOR_MAP:
                    co2_ton.setdefault(sektor, 0.0)
                    co2_ton[sektor] = co2_ton[sektor] + value
            elif enhed == "Ton CO2e/indb." and sektor == "Samlet":
                co2_capita.append(value)

        elif "VE" in (rtype or "") and enhed == "%":
            ve_andel = value

    # samletUdledning: min of Samlet rows (lower = standard scope boundary)
    samlet_list = co2_ton.get("Samlet", [0.0])
    samlet = min(samlet_list) if samlet_list else 0.0

    # udledningPrCapita: min of capita rows
    capita = min(co2_capita) if co2_capita else 0.0

    # Sector values
    sektorer = {}
    for api_sektor, out_key in SEKTOR_MAP.items():
        v = co2_ton.get(api_sektor, 0.0)
        sektorer[out_key] = sektorer.get(out_key, 0.0) + v

    return {
        "samletUdledning": round(samlet, 1),
        "udledningPrCapita": round(capita, 3),
        "sektorer": {k: round(sektorer.get(k, 0.0), 1) for k in SEKTORER},
        "veAndel": round(ve_andel, 4) if ve_andel is not None else 0.0,
    }


def build_kommune_record(raw: dict) -> dict:
    """Transform one municipality's raw data into the output shape."""
    kode = raw["kommuneKode"]
    navn = raw["kommuneNavn"]
    years_data = raw.get("years_data", [])

    # Index by year
    by_year = {entry["year"]: entry["rows"] for entry in years_data}

    samlet_series = []
    capita_series = []
    ve_series = []
    sektor_series = {k: [] for k in SEKTORER}

    for year in YEARS:
        rows = by_year.get(year, [])
        vals = extract_year_values(rows, year)
        samlet_series.append(vals["samletUdledning"])
        capita_series.append(vals["udledningPrCapita"])
        ve_series.append(vals["veAndel"])
        for k in SEKTORER:
            sektor_series[k].append(vals["sektorer"][k])

    return {
        "kommuneKode": kode,
        "kommuneNavn": navn,
        "years": YEARS,
        "samletUdledning": samlet_series,
        "udledningPrCapita": capita_series,
        "sektorer": sektor_series,
        "veAndel": ve_series,
    }


def main():
    t0 = time.monotonic()
    print("Klimaregnskab Build — transforming raw data to dashboard format")

    if not INPUT_PATH.exists():
        print(f"  ✗ Raw data not found: {INPUT_PATH}")
        print("  Run: python3 etl/fetch_klimaregnskab.py")
        sys.exit(1)

    print(f"  Reading {INPUT_PATH.name} ({INPUT_PATH.stat().st_size:,} bytes)...")
    with open(INPUT_PATH, encoding="utf-8") as f:
        raw_list = json.load(f)

    print(f"  Municipalities in raw data: {len(raw_list)}")

    kommuner_out = []
    for raw in raw_list:
        kommuner_out.append(build_kommune_record(raw))

    # Sort alphabetically by name for deterministic output
    kommuner_out.sort(key=lambda x: x["kommuneNavn"])

    # Latest year for summary statistics
    latest_year = YEARS[-1]
    latest_idx = YEARS.index(latest_year)
    total_samlet = sum(k["samletUdledning"][latest_idx] for k in kommuner_out)

    output = {
        "source": "Energi- og CO₂-regnskabet, Energistyrelsen",
        "sourceUrl": "https://klimaregnskabet.dk",
        "attribution": "Kilde: Energi- og CO₂-regnskabet, Energistyrelsen / klimaregnskabet.dk",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "latestYear": latest_year,
        "years": YEARS,
        "nationalTotal": {
            "year": latest_year,
            "samletUdledningTon": round(total_samlet, 0),
        },
        "kommuner": kommuner_out,
    }

    # Write to both public/data/ (frontend) and data/klimaregnskab/ (ETL reference)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ETL_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    out_paths = [
        OUTPUT_DIR / "klimaregnskab-by-kommune.json",
        ETL_OUTPUT_DIR / "by_kommune.json",
    ]
    for p in out_paths:
        with open(p, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, separators=(",", ":"))
        print(f"  ✓ Wrote {p} ({p.stat().st_size:,} bytes)")

    # Quick validation
    with_data = sum(1 for k in kommuner_out if k["samletUdledning"][latest_idx] > 0)
    print(f"\n  === Summary ({latest_year}) ===")
    print(f"  Municipalities with CO₂ data:  {with_data}/{len(kommuner_out)}")
    print(f"  National total CO₂:            {total_samlet:,.0f} ton CO₂e")
    sorted_by_capita = sorted(kommuner_out, key=lambda k: k["udledningPrCapita"][latest_idx], reverse=True)
    print(f"  Highest per capita:  {sorted_by_capita[0]['kommuneNavn']} ({sorted_by_capita[0]['udledningPrCapita'][latest_idx]:.2f} ton/indb.)")
    print(f"  Lowest per capita:   {sorted_by_capita[-1]['kommuneNavn']} ({sorted_by_capita[-1]['udledningPrCapita'][latest_idx]:.2f} ton/indb.)")
    print(f"\n  Duration: {time.monotonic() - t0:.1f}s")


if __name__ == "__main__":
    main()
