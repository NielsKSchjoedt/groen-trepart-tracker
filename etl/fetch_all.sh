#!/bin/bash
# Fetch all data sources for the Trepart Tracker.
# Run via: mise run fetch-data
# Or via GitHub Actions on schedule.
#
# All fetchers use Python stdlib only — except build_co2_data.py which needs openpyxl.

set -euo pipefail
cd "$(dirname "$0")"

echo "=== Den Grønne Trepart — Data Fetch (inkl. biodiversitet) ==="
echo "$(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo

FAILED=0

echo "--- 1/12: MARS API (projects, plans, nitrogen data) ---"
python3 fetch_mars.py || { echo "⚠ MARS fetch failed"; FAILED=$((FAILED+1)); }

echo
echo "--- 2/12: DAWA API (municipalities, boundaries) ---"
python3 fetch_dawa.py || { echo "⚠ DAWA fetch failed"; FAILED=$((FAILED+1)); }

echo
echo "--- 3/12: MiljøGIS WFS (project geometries) ---"
python3 fetch_miljoegis.py || { echo "⚠ MiljøGIS fetch failed"; FAILED=$((FAILED+1)); }

echo
echo "--- 4/12: Danmarks Statistik (land use, forest, subsidies) ---"
python3 fetch_dst.py || { echo "⚠ DST fetch failed"; FAILED=$((FAILED+1)); }

echo
echo "--- 5/12: VanDa (monitoring stations) ---"
python3 fetch_vanda.py || { echo "⚠ VanDa fetch failed"; FAILED=$((FAILED+1)); }

echo
echo "--- 6/12: Natura 2000 protected areas (MiljøGIS WFS) ---"
python3 fetch_natura2000.py || { echo "⚠ Natura 2000 fetch failed"; FAILED=$((FAILED+1)); }

echo
echo "--- 7/12: §3 protected nature types (MiljøGIS WFS) ---"
python3 fetch_section3.py || { echo "⚠ §3 nature fetch failed"; FAILED=$((FAILED+1)); }

echo
echo "--- 8/12: Forest data — fredskov + skovkort (MiljøGIS WFS) ---"
python3 fetch_fredskov.py || { echo "⚠ Forest data fetch failed"; FAILED=$((FAILED+1)); }

echo
echo "--- 9/12: Klimaskovfonden (voluntary afforestation WFS) ---"
python3 fetch_klimaskovfonden.py || { echo "⚠ Klimaskovfonden fetch failed"; FAILED=$((FAILED+1)); }

echo
echo "--- 10/12: Naturstyrelsen skovrejsning (state afforestation WFS) ---"
python3 fetch_naturstyrelsen_skov.py || { echo "⚠ Naturstyrelsen skov fetch failed"; FAILED=$((FAILED+1)); }

echo
echo "--- 11/12: KF25 climate data (KEFM) ---"
python3 fetch_kf25.py || { echo "⚠ KF25 fetch failed"; FAILED=$((FAILED+1)); }

echo
echo "--- 12/12: Project geometries (MARS API) ---"
python3 fetch_geometries.py || { echo "⚠ Geometry fetch failed"; FAILED=$((FAILED+1)); }

echo
echo "--- 13/13: Klimaregnskab CO₂ per kommune (requires KLIMAREGNSKAB_API_KEY) ---"
python3 fetch_klimaregnskab.py || { echo "⚠ Klimaregnskab fetch failed (check KLIMAREGNSKAB_API_KEY)"; FAILED=$((FAILED+1)); }

echo
echo "--- 14/17: Klimarådet (URL check + JSON timestamp) ---"
python3 fetch_klimaraadet.py || { echo "⚠ Klimarådet fetch non-fatal"; }

echo
echo "--- 15/17: Arealdata — biodiversitet (WFS: KU-prioriteter, DCE valgfri) ---"
python3 fetch_arealdata_biodiversitet.py || { echo "⚠ Arealdata biodiversitet failed"; FAILED=$((FAILED+1)); }

echo
echo "--- 16/17: FVM Markkort — Vand, natur & skov 2026 ---"
python3 fetch_markkort_natur_projekter.py || { echo "⚠ FVM VNS 2026 failed"; FAILED=$((FAILED+1)); }

echo
echo "--- Building dashboard data ---"
python3 build_dashboard_data.py || { echo "⚠ Dashboard data build failed"; FAILED=$((FAILED+1)); }

echo
echo "--- Building CO₂ emissions data ---"
python3 build_co2_data.py || { echo "⚠ CO₂ data build failed"; FAILED=$((FAILED+1)); }

echo
echo "--- Building Klimaregnskab per-kommune data ---"
python3 build_klimaregnskab_data.py || { echo "⚠ Klimaregnskab build failed"; FAILED=$((FAILED+1)); }

echo
echo "=== Done — ${FAILED} failures ==="
if [ "$FAILED" -gt 0 ]; then
    echo "Some fetchers failed. Check output above for details."
fi
