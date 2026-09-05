import { TileLayer } from 'react-leaflet';

/** OpenSeaMap seamark tiles: crowdsourced, not official (PRD Feature 7). NOAA ENC GeoJSON overlay lands in Phase 2. */
export function OpenSeaMapLayer({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <TileLayer url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png" attribution='OpenSeaMap contributors (crowdsourced, not official)' opacity={0.9} maxZoom={18} />;
}

export function BaseTiles() {
  // Esri Dark Gray Canvas: a native dark basemap that is still keyless. CARTO now
  // watermarks its free tiles ("API key required") and OSM's tile server refuses
  // many app requests, so this is the reliable no-key dark option. Note {z}/{y}/{x}.
  return <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" attribution='Tiles &copy; Esri' maxZoom={16} />;
}
