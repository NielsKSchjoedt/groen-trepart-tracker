#!/usr/bin/env python3
"""
ETL: Fetch per-municipality CO₂ data from Klimaregnskabet API.

API: https://klimaregnskabet.dk/klimaregnskabet-api
Endpoint: GET https://klimaregnskabet.dk/api/municipality-data
Params:   municipality (int), year (2018-2023), type ("Nøgletal")
Auth:     x-api-key header

Fetches the "Nøgletal" datatype for all 98 municipalities × 6 years (588 calls).
Nøgletal provides 58 rows per call covering:
  - Samlet CO₂-udledning (Ton CO₂e, Ton CO₂e/indb., Ton CO₂e/km²) per sector
  - VE-el selvforsyningsgrad (%)
  - Samlet energiforbrug (TJ)

Sectors: Affaldsdeponi, Energi, Kemiske processer, Landbrug, Samlet, Spildevand, Transport

Output: data/klimaregnskab/noegletal_raw.json
        data/klimaregnskab/summary.json

Requires: KLIMAREGNSKAB_API_KEY environment variable (or .env file in repo root)
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DATA_DIR = REPO_ROOT / "data" / "klimaregnskab"

# Try to load .env from repo root (for local development)
env_file = REPO_ROOT / ".env"
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

API_KEY = os.environ.get("KLIMAREGNSKAB_API_KEY", "").strip()
BASE_URL = "https://klimaregnskabet.dk/api/municipality-data"
YEARS = [2018, 2019, 2020, 2021, 2022, 2023]
TYPE_NOEGLETAL = "Nøgletal"

USER_AGENT = "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; open-source environmental monitor)"
TIMEOUT_SECONDS = 30
SLEEP_BETWEEN_REQUESTS = 0.15  # 150 ms to be a polite API consumer


def fetch_municipality_year(municipality_code: int, year: int) -> list | None:
    """Fetch Nøgletal for a single municipality + year. Returns data array or None."""
    params = f"municipality={municipality_code}&year={year}&type=N%C3%B8gletal"
    url = f"{BASE_URL}?{params}"
    req = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "x-api-key": API_KEY,
        },
    )
    try:
        with urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            raw = resp.read()
            body = json.loads(raw)
            return body.get("data", [])
    except HTTPError as e:
        print(f"    ✗ HTTP {e.code}: municipality={municipality_code} year={year} — {e.reason}")
        return None
    except URLError as e:
        print(f"    ✗ Connection error: municipality={municipality_code} year={year} — {e.reason}")
        return None
    except json.JSONDecodeError as e:
        print(f"    ✗ Invalid JSON: municipality={municipality_code} year={year} — {e}")
        return None


def load_municipality_codes() -> list[dict]:
    """Load municipality list from DAWA data. Returns list of {kode, navn}."""
    dawa_path = REPO_ROOT / "data" / "dawa" / "kommuner.json"
    if not dawa_path.exists():
        print(f"  ✗ DAWA kommuner.json not found at {dawa_path}")
        print("    Run: python3 etl/fetch_dawa.py")
        sys.exit(1)
    with open(dawa_path) as f:
        raw = json.load(f)
    # Filter out Christiansø (0411) — not a real municipality
    return [
        {"kode": km["kode"], "navn": km["navn"], "api_code": int(km["kode"])}
        for km in raw
        if km.get("kode") and km["kode"] != "0411"
    ]


def probe_next_year(kommuner: list[dict]) -> int | None:
    """
    Check if data exists for the year after YEARS[-1] by probing a single
    municipality. Returns the new year if data is available, None otherwise.

    @param kommuner - List of municipality dicts with 'api_code'
    @returns The new year (e.g. 2024) if data exists, None otherwise
    """
    next_year = YEARS[-1] + 1
    test_code = kommuner[0]["api_code"]
    rows = fetch_municipality_year(test_code, next_year)
    if rows and len(rows) > 0:
        return next_year
    return None


def cached_years(raw_path: Path) -> set[int]:
    """Return the set of years present in the cached raw data file."""
    if not raw_path.exists():
        return set()
    try:
        with open(raw_path) as f:
            data = json.load(f)
        years = set()
        for entry in data:
            for yd in entry.get("years_data", []):
                years.add(yd["year"])
        return years
    except (json.JSONDecodeError, KeyError):
        return set()


def main():
    t0 = time.monotonic()
    print(f"Klimaregnskab ETL — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"Output: {DATA_DIR}")
    print()

    if not API_KEY:
        print("⚠ KLIMAREGNSKAB_API_KEY not set.")
        print("  Set it in .env (copy from .env.example) or as an environment variable.")
        print("  Skipping Klimaregnskab fetch.")
        sys.exit(0)

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    kommuner = load_municipality_codes()
    raw_path = DATA_DIR / "noegletal_raw.json"
    existing_years = cached_years(raw_path)
    force = os.environ.get("FORCE_KLIMAREGNSKAB", "").strip().lower() in ("1", "true", "yes")

    if existing_years >= set(YEARS) and not force:
        print(f"  Cache hit: {raw_path.name} has data for {sorted(existing_years)}")
        print(f"  Probing for new year ({YEARS[-1] + 1})...")
        new_year = probe_next_year(kommuner)
        if new_year:
            print(f"  ✓ New year {new_year} detected — adding to fetch list")
            YEARS.append(new_year)
        else:
            print(f"  No new year available — skipping full fetch ({time.monotonic() - t0:.1f}s)")
            return 0

    print(f"Municipalities to fetch: {len(kommuner)}")
    print(f"Years: {YEARS}")
    total_calls = len(kommuner) * len(YEARS)
    print(f"Total API calls: {total_calls}")
    print()

    all_results = []
    errors = []
    n = 0

    for km in kommuner:
        kode = km["kode"]
        navn = km["navn"]
        api_code = km["api_code"]
        kommune_rows = []

        for year in YEARS:
            n += 1
            if n % 50 == 1:
                pct = (n - 1) / total_calls * 100
                elapsed = time.monotonic() - t0
                print(f"  Progress: {n}/{total_calls} ({pct:.0f}%) — elapsed {elapsed:.0f}s")

            rows = fetch_municipality_year(api_code, year)
            if rows is not None:
                kommune_rows.append({"year": year, "rows": rows})
            else:
                errors.append(f"{kode}/{year}")

            if n < total_calls:
                time.sleep(SLEEP_BETWEEN_REQUESTS)

        all_results.append({
            "kommuneKode": kode,
            "kommuneNavn": navn,
            "years_data": kommune_rows,
        })

    print()
    print(f"Fetch complete — {total_calls - len(errors)} OK, {len(errors)} errors")

    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"  noegletal_raw.json: {raw_path.stat().st_size:,} bytes")

    summary = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "type": TYPE_NOEGLETAL,
        "years": YEARS,
        "municipalities_fetched": len(kommuner),
        "total_calls": total_calls,
        "errors": len(errors),
        "error_list": errors[:20],
        "duration_seconds": round(time.monotonic() - t0, 1),
    }
    with open(DATA_DIR / "summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    if errors:
        print(f"\n  ⚠ Failed calls: {', '.join(errors[:10])}{'...' if len(errors) > 10 else ''}")

    print(f"\n  Total time: {time.monotonic() - t0:.0f}s")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
