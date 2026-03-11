#!/bin/bash
# prepare_map_data.sh — Run on your local machine (not in the Cowork VM)
# Prepares TopoJSON map files for the frontend
#
# Prerequisites:
#   npm install -g topojson-server topojson-simplify topojson-client
#   npm install -g mapshaper    (recommended — much better simplification)
#   brew install gdal           (optional — for reprojecting MiljøGIS data)
#
# This script:
# 1. Fetches municipality boundaries from DAWA and simplifies to ~200-400 KB
# 2. Fetches coastal water catchment boundaries from MiljøGIS WFS (VP3 2025)
# 3. Fetches main catchment (hovedvandoplande) boundaries from MiljøGIS WFS
# 4. Converts all to TopoJSON, web-ready files in data/geo/

set -euo pipefail

# --- Tool checks ---
for cmd in geo2topo toposimplify topoquantize; do
    if ! command -v "$cmd" &> /dev/null; then
        echo "ERROR: $cmd not found."
        echo "Install: npm install -g topojson-server topojson-simplify topojson-client"
        exit 1
    fi
done

HAS_MAPSHAPER=false
if command -v mapshaper &> /dev/null; then
    HAS_MAPSHAPER=true
    echo "✅ mapshaper found — will use for high-quality simplification"
else
    echo "⚠️  mapshaper not found — using toposimplify (results will be larger)"
    echo "   Install for better results: npm install -g mapshaper"
fi

HAS_OGR2OGR=false
if command -v ogr2ogr &> /dev/null; then
    HAS_OGR2OGR=true
fi

OUTDIR="data/geo"
mkdir -p "$OUTDIR"

# ============================================================
# Step 1: Municipality boundaries
# ============================================================
echo ""
echo "=== Step 1: Fetch municipality boundaries ==="

# DAWA provides municipality boundaries with srid=4326 (WGS84)
# The full file is ~40-114 MB depending on detail level
if [ -f "data/dawa/kommuner.geojson" ]; then
    echo "Using existing data/dawa/kommuner.geojson"
    KOMMUNE_GEOJSON="data/dawa/kommuner.geojson"
elif [ -f "$OUTDIR/denmark-municipalities.geo.json" ]; then
    echo "Using existing $OUTDIR/denmark-municipalities.geo.json"
    KOMMUNE_GEOJSON="$OUTDIR/denmark-municipalities.geo.json"
else
    echo "Fetching from DAWA API (this may take a minute)..."
    curl -sL "https://api.dataforsyningen.dk/kommuner?format=geojson&srid=4326" \
        -o "$OUTDIR/kommuner-raw.geojson"
    KOMMUNE_GEOJSON="$OUTDIR/kommuner-raw.geojson"
fi

INPUT_SIZE=$(wc -c < "$KOMMUNE_GEOJSON")
echo "Input GeoJSON: $(( INPUT_SIZE / 1024 / 1024 )) MB"

echo "Converting municipalities to TopoJSON with simplification..."

if [ "$HAS_MAPSHAPER" = true ]; then
    # mapshaper has far better simplification — Visvalingam weighted area
    # with planar option for geographic coordinates.
    # Target: ~200-400 KB for 98 municipalities
    mapshaper "$KOMMUNE_GEOJSON" \
        -simplify dp 2% keep-shapes \
        -o format=topojson "$OUTDIR/denmark-municipalities.topo.json" \
        force 2>&1 | grep -v "^$"
else
    # Fallback: topojson pipeline (produces larger files, ~2-3 MB)
    geo2topo kommuner="$KOMMUNE_GEOJSON" \
        | toposimplify -p 0.000001 -f \
        | topoquantize 1e4 \
        > "$OUTDIR/denmark-municipalities.topo.json"
fi

SIZE=$(wc -c < "$OUTDIR/denmark-municipalities.topo.json")
echo "Municipality TopoJSON: $(( SIZE / 1024 )) KB"
if [ "$SIZE" -gt 500000 ]; then
    echo "⚠️  File is >500 KB. Consider installing mapshaper for better simplification."
fi

# ============================================================
# Step 2: MiljøGIS WFS endpoints
# ============================================================
echo ""
echo "=== Step 2: MiljøGIS WFS endpoints ==="

# MiljøGIS WFS has two key endpoints:
#   https://wfs2-miljoegis.mim.dk/vandprojekter/ows  — project-specific layers (7 layers)
#   https://wfs2-miljoegis.mim.dk/wfs/ows             — general endpoint (859+ layers)
#
# The general "wfs/ows" endpoint contains ALL namespaced layers including:
#   vp3_2endelig2025:  — VP3 final 2025 water plans (catchments, coastal waters)
#   vp2_2016:          — VP2 2016 water plans (coastal water bodies)
#   klima:, natur:, dai:  — various other themes
#
# Verified working layers (March 2026):
#   Catchments:        vp3_2endelig2025:vp3_2e2025_hovedoplande (23 features)
#   Coastal catchments: vp3_2endelig2025:vp3_2e2025_kystvand_opland_afg (108 features)
#   Coastal waters:    vp2_2016:theme-vp2_2016-kystvande (133 features)

WFS_GENERAL="https://wfs2-miljoegis.mim.dk/wfs/ows"

echo "Using verified WFS endpoint: $WFS_GENERAL"

# ============================================================
# Step 3: Fetch coastal water boundaries (kystvandområder)
# ============================================================
echo ""
echo "=== Step 3: Fetch coastal water boundaries ==="

COASTAL_FOUND=false

# Verified layer: VP3 final 2025 coastal water catchment boundaries
# 108 features — delineates coastal water catchment areas used in VP3 planning
COASTAL_LAYER="vp3_2endelig2025:vp3_2e2025_kystvand_opland_afg"

echo "Fetching coastal water catchment boundaries: $COASTAL_LAYER"
RESPONSE=$(curl -sL "${WFS_GENERAL}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${COASTAL_LAYER}&outputFormat=application/json&srsName=EPSG:25832" \
    -o "$OUTDIR/coastal-waters-raw.geojson" -w "%{http_code}" 2>/dev/null || echo "000")

if [ -f "$OUTDIR/coastal-waters-raw.geojson" ] && grep -q '"FeatureCollection"' "$OUTDIR/coastal-waters-raw.geojson" 2>/dev/null; then
    RAW_SIZE=$(wc -c < "$OUTDIR/coastal-waters-raw.geojson")
    FEAT_COUNT=$(grep -o '"Feature"' "$OUTDIR/coastal-waters-raw.geojson" | wc -l || echo "?")
    echo "  ✅ ${FEAT_COUNT} features — $(( RAW_SIZE / 1024 )) KB raw GeoJSON"
    COASTAL_FOUND=true
else
    echo "  ❌ Failed to fetch $COASTAL_LAYER (HTTP $RESPONSE)"
    echo "     Trying fallback: VP2 2016 coastal water bodies..."

    # Fallback: VP2 2016 coastal water bodies (133 features, ecological status data)
    COASTAL_LAYER="vp2_2016:theme-vp2_2016-kystvande"
    curl -sL "${WFS_GENERAL}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${COASTAL_LAYER}&outputFormat=application/json&srsName=EPSG:25832" \
        -o "$OUTDIR/coastal-waters-raw.geojson" 2>/dev/null || true

    if [ -f "$OUTDIR/coastal-waters-raw.geojson" ] && grep -q '"FeatureCollection"' "$OUTDIR/coastal-waters-raw.geojson" 2>/dev/null; then
        RAW_SIZE=$(wc -c < "$OUTDIR/coastal-waters-raw.geojson")
        FEAT_COUNT=$(grep -o '"Feature"' "$OUTDIR/coastal-waters-raw.geojson" | wc -l || echo "?")
        echo "  ✅ Fallback OK: ${FEAT_COUNT} features — $(( RAW_SIZE / 1024 )) KB"
        COASTAL_FOUND=true
    else
        echo "  ❌ Fallback also failed"
    fi
fi

if [ "$COASTAL_FOUND" = true ]; then
    echo "Converting coastal waters to TopoJSON..."
    if [ "$HAS_OGR2OGR" = true ]; then
        # MiljøGIS uses EPSG:25832 (Danish UTM) — reproject to WGS84
        ogr2ogr -f GeoJSON -s_srs EPSG:25832 -t_srs EPSG:4326 \
            "$OUTDIR/coastal-waters-4326.geojson" \
            "$OUTDIR/coastal-waters-raw.geojson"

        if [ "$HAS_MAPSHAPER" = true ]; then
            mapshaper "$OUTDIR/coastal-waters-4326.geojson" \
                -simplify dp 5% keep-shapes \
                -o format=topojson "$OUTDIR/coastal-waters.topo.json" \
                force 2>&1 | grep -v "^$"
        else
            geo2topo kystvand="$OUTDIR/coastal-waters-4326.geojson" \
                | toposimplify -p 0.01 -f \
                | topoquantize 1e5 \
                > "$OUTDIR/coastal-waters.topo.json"
        fi

        SIZE=$(wc -c < "$OUTDIR/coastal-waters.topo.json")
        echo "Coastal waters TopoJSON: $(( SIZE / 1024 )) KB"
    else
        echo "⚠️  ogr2ogr not found. Install GDAL for coordinate reprojection:"
        echo "   brew install gdal  (macOS)"
        echo "   apt install gdal-bin  (Ubuntu)"
        echo "   Saved raw GeoJSON (EPSG:25832) — reprojection needed before use"
    fi
else
    echo "⚠️  Could not fetch coastal water boundaries."
    echo "   Check manually: https://miljoegis.mim.dk/"
    echo "   Expected layer: vp3_2endelig2025:vp3_2e2025_kystvand_opland_afg"
fi

# ============================================================
# Step 4: Fetch catchment boundaries (vandoplande)
# ============================================================
echo ""
echo "=== Step 4: Fetch catchment boundaries (vandoplande) ==="

CATCHMENT_FOUND=false

# Verified layer: VP3 final 2025 main catchment areas (hovedvandoplande)
# 23 features — the main drainage basins used in water planning
CATCHMENT_LAYER="vp3_2endelig2025:vp3_2e2025_hovedoplande"

echo "Fetching main catchment boundaries: $CATCHMENT_LAYER"
RESPONSE=$(curl -sL "${WFS_GENERAL}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${CATCHMENT_LAYER}&outputFormat=application/json&srsName=EPSG:25832" \
    -o "$OUTDIR/catchments-raw.geojson" -w "%{http_code}" 2>/dev/null || echo "000")

if [ -f "$OUTDIR/catchments-raw.geojson" ] && grep -q '"FeatureCollection"' "$OUTDIR/catchments-raw.geojson" 2>/dev/null; then
    RAW_SIZE=$(wc -c < "$OUTDIR/catchments-raw.geojson")
    FEAT_COUNT=$(grep -o '"Feature"' "$OUTDIR/catchments-raw.geojson" | wc -l || echo "?")
    echo "  ✅ ${FEAT_COUNT} features — $(( RAW_SIZE / 1024 )) KB raw GeoJSON"
    CATCHMENT_FOUND=true
else
    echo "  ❌ Failed to fetch $CATCHMENT_LAYER (HTTP $RESPONSE)"
fi

if [ "$CATCHMENT_FOUND" = true ]; then
    echo "Converting catchments to TopoJSON..."
    if [ "$HAS_OGR2OGR" = true ]; then
        ogr2ogr -f GeoJSON -s_srs EPSG:25832 -t_srs EPSG:4326 \
            "$OUTDIR/catchments-4326.geojson" \
            "$OUTDIR/catchments-raw.geojson"

        if [ "$HAS_MAPSHAPER" = true ]; then
            mapshaper "$OUTDIR/catchments-4326.geojson" \
                -simplify dp 5% keep-shapes \
                -o format=topojson "$OUTDIR/catchments.topo.json" \
                force 2>&1 | grep -v "^$"
        else
            geo2topo vandoplande="$OUTDIR/catchments-4326.geojson" \
                | toposimplify -p 0.01 -f \
                | topoquantize 1e5 \
                > "$OUTDIR/catchments.topo.json"
        fi

        SIZE=$(wc -c < "$OUTDIR/catchments.topo.json")
        echo "Catchments TopoJSON: $(( SIZE / 1024 )) KB"
    else
        echo "⚠️  ogr2ogr not found — saved raw GeoJSON (needs reprojection)"
    fi
else
    echo "⚠️  Could not fetch catchment boundaries."
    echo "   Check manually: https://miljoegis.mim.dk/"
    echo "   Expected layer: vp3_2endelig2025:vp3_2e2025_hovedoplande"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo "=== Summary ==="
echo "Files in $OUTDIR:"
ls -lh "$OUTDIR" | grep -v "^total"
echo ""

echo "Next steps:"
if [ ! "$HAS_MAPSHAPER" = true ]; then
    echo "  → npm install -g mapshaper   (for ~10x better simplification)"
fi
if [ ! "$HAS_OGR2OGR" = true ]; then
    echo "  → brew install gdal          (for coordinate reprojection)"
fi
if [ "$COASTAL_FOUND" = false ]; then
    echo "  → Coastal water boundaries failed. Check WFS endpoint manually."
fi
if [ "$CATCHMENT_FOUND" = false ]; then
    echo "  → Catchment boundaries failed. Check WFS endpoint manually."
fi
echo "  → The TopoJSON files in $OUTDIR are ready for the frontend"
echo ""
echo "WFS endpoint used: $WFS_GENERAL"
echo "Layers:"
echo "  Coastal: vp3_2endelig2025:vp3_2e2025_kystvand_opland_afg (108 catchments)"
echo "  Catchments: vp3_2endelig2025:vp3_2e2025_hovedoplande (23 basins)"
