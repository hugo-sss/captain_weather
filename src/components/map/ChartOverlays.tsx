import { TileLayer } from 'react-leaflet';

/** OpenSeaMap seamark tiles: crowdsourced, not official (PRD Feature 7). NOAA ENC GeoJSON overlay lands in Phase 2. */
export function OpenSeaMapLayer({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <TileLayer url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png" attribution='OpenSeaMap contributors (crowdsourced, not official)' opacity={0.9} maxZoom={18} />;
}

export function BaseTiles() {
  // CARTO dark basemap: a native dark tileset (no invert filter needed) and far more
  // tolerant of hotlinking than tile.openstreetmap.org, which refuses many app requests.
  return <TileLayer subdomains="abcd" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors &copy; CARTO' maxZoom={20} />;
}
