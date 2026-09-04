import { TileLayer } from 'react-leaflet';

/** OpenSeaMap seamark tiles: crowdsourced, not official (PRD Feature 7). NOAA ENC GeoJSON overlay lands in Phase 2. */
export function OpenSeaMapLayer({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <TileLayer url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png" attribution='OpenSeaMap contributors (crowdsourced, not official)' opacity={0.9} maxZoom={18} />;
}

export function BaseTiles() {
  return <TileLayer className="osm-dark" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' maxZoom={19} />;
}
