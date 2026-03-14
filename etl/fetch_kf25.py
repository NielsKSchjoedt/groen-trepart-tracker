#!/usr/bin/env python3
"""
ETL: Download KF25 (Klimastatus og -fremskrivning 2025) Excel data files.

Downloads official emissions data from the Danish Ministry of Climate,
Energy and Utilities (KEFM). These files contain Denmark's national
greenhouse gas inventory and projections through 2050.

Source: https://www.kefm.dk/klima/klimastatus-og-fremskrivning/klimastatus-og-fremskrivning-2025

Output: data/kf25/*.xlsx
  - kf25-crf-tabeller.xlsx:    CRF emissions tables by gas (CO2, CH4, N2O, etc.)
  - kf25-tal-bag-figurer.xlsx: Data behind report figures
  - kf25-lulucf-dataark.xlsx:  LULUCF sector detail (forests, cropland, wetlands)
  - kf25-landbrug-dataark.xlsx: Agriculture sector detail (livestock, manure, soils)
  - kf25-crf-ets-esr.xlsx:     CRF split by ETS/ESR/Other
"""

import argparse
import sys
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = REPO_ROOT / "data" / "kf25"

USER_AGENT = "TrepartTracker/0.1 (https://github.com/NielsKSchjoedt/groen-trepart-tracker; open-source environmental monitor)"
TIMEOUT_SECONDS = 30

# KF25 data file URLs (from kefm.dk, last verified June 2025)
KF25_FILES = {
    "kf25-crf-tabeller.xlsx": "https://www.kefm.dk/Media/638815967289285807/KF25%20CRF-tabeller.xlsx",
    "kf25-tal-bag-figurer.xlsx": "https://www.kefm.dk/Media/638917226727686793/KF25%20Tal%20bag%20figurer%2008-25.xlsx",
    "kf25-lulucf-dataark.xlsx": "https://www.kefm.dk/Media/638815969858642768/KF25%20LULUCF%20-%20dataark.xlsx",
    "kf25-landbrug-dataark.xlsx": "https://www.kefm.dk/Media/638851527196975653/KF25_Landbrug_Dataark%20opdateret%20den%2010-06-2025.xlsx",
    "kf25-crf-ets-esr.xlsx": "https://www.kefm.dk/Media/638815967206212526/KF25%20CRF-tabeller%20ETS-ESR-vrige.xlsx",
}


def download_file(url: str, dest: Path) -> bool:
    """Download a file from URL. Returns True on success."""
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            data = response.read()
            with open(dest, "wb") as f:
                f.write(data)
            return True
    except (HTTPError, URLError) as e:
        print(f"  ✗ Failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Download KF25 climate data from KEFM")
    parser.add_argument("--force", action="store_true", help="Re-download all files, ignoring existing")
    args = parser.parse_args()

    t0 = time.monotonic()
    print("KF25 Data Download — Klimastatus og -fremskrivning 2025")
    print(f"  Source: kefm.dk")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    skipped = 0
    errors = 0

    for filename, url in KF25_FILES.items():
        dest = OUTPUT_DIR / filename

        if dest.exists() and not args.force:
            size_kb = dest.stat().st_size / 1024
            print(f"  ✓ {filename} already exists ({size_kb:.0f} KB)")
            skipped += 1
            continue

        print(f"  Downloading {filename}...")
        if download_file(url, dest):
            size_kb = dest.stat().st_size / 1024
            print(f"  ✓ {filename} ({size_kb:.0f} KB)")
            downloaded += 1
        else:
            errors += 1

    elapsed = time.monotonic() - t0
    print(f"\n  Done: {downloaded} downloaded, {skipped} cached, {errors} errors ({elapsed:.1f}s)")

    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
