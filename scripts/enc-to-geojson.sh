#!/usr/bin/env bash
# PRD §5.5: NOAA ENC S-57 -> GeoJSON -> chart_features. Runs on a Mac with GDAL when needed. Not scheduled.
# Usage: scripts/enc-to-geojson.sh US5FL11M [more cells...]   (cell names from https://charts.noaa.gov/ENCs/)
# Requires: gdal (ogr2ogr), psql with DATABASE_URL set to the app project (service role / postgres user).
set -euo pipefail
LAYERS="DEPARE DEPCNT SOUNDG OBSTRN WRECKS LIGHTS"
OUT="${ENC_OUT:-./enc-out}"; mkdir -p "$OUT"
for CELL in "$@"; do
  ZIP="$OUT/$CELL.zip"
  [ -f "$ZIP" ] || curl -fsSL "https://charts.noaa.gov/ENCs/$CELL.zip" -o "$ZIP"
  unzip -oq "$ZIP" -d "$OUT/$CELL"
  BASE=$(find "$OUT/$CELL" -name "*.000" | head -1)
  for L in $LAYERS; do
    OGR_S57_OPTIONS="SPLIT_MULTIPOINT=ON,UPDATES=APPLY,RETURN_PRIMITIVES=OFF" \
      ogr2ogr -f GeoJSON -t_srs EPSG:4326 "$OUT/$CELL.$L.geojson" "$BASE" "$L" 2>/dev/null || { echo "skip $CELL $L"; continue; }
    # depth: DRVAL1 (DEPARE), VALDCO (DEPCNT), Z of SOUNDG points, VALSOU (OBSTRN/WRECKS)
    python3 - "$OUT/$CELL.$L.geojson" "$CELL" "$L" <<'PY' | psql "$DATABASE_URL" -q -c "copy chart_features (source, cell_id, feature_type, geom, depth_m, properties) from stdin with (format csv)"
import json, sys, csv
path, cell, layer = sys.argv[1:4]
fc = json.load(open(path))
w = csv.writer(sys.stdout)
for f in fc.get('features', []):
    p = f.get('properties') or {}
    depth = p.get('DRVAL1') if layer == 'DEPARE' else p.get('VALDCO') if layer == 'DEPCNT' else p.get('VALSOU') if layer in ('OBSTRN', 'WRECKS') else None
    if layer == 'SOUNDG' and f['geometry']['type'] == 'Point' and len(f['geometry']['coordinates']) > 2:
        depth = f['geometry']['coordinates'][2]
    w.writerow(['noaa-enc', cell, layer, 'SRID=4326;' + json.dumps(f['geometry']) if False else json.dumps(f['geometry']), depth if depth is not None else '', json.dumps(p)])
PY
  done
done
echo "Loaded. Note: geom column expects GeoJSON via ST_GeomFromGeoJSON; if the copy above rejects raw GeoJSON, load into a staging table and cast with st_geomfromgeojson(geom)::geography."
