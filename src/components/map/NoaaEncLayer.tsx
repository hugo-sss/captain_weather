// NOAA ENC overlay from pre-processed GeoJSON in chart_features (PRD §5.5, Feature 7). US waters only.
import { useEffect, useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import type { FeatureCollection } from 'geojson';
import { supabase } from '@/lib/supabase.ts';

const STYLE: Record<string, { color: string; weight: number; fillOpacity: number; dashArray?: string }> = {
  DEPARE: { color: '#0EA5E9', weight: 0.6, fillOpacity: 0.08 },
  DEPCNT: { color: '#66748F', weight: 0.8, fillOpacity: 0, dashArray: '3 3' },
  OBSTRN: { color: '#F87171', weight: 1.2, fillOpacity: 0.3 },
  WRECKS: { color: '#F87171', weight: 1.2, fillOpacity: 0.3 },
  LIGHTS: { color: '#FBBF24', weight: 1, fillOpacity: 0.6 },
  SOUNDG: { color: '#9AA8C0', weight: 0.5, fillOpacity: 0.5 },
};

/** Loads features whose bbox intersects the current view via PostGIS (chart_features_read policy). Empty until scripts/enc-to-geojson.sh has run. */
export function NoaaEncLayer({ visible, onStatus }: { visible: boolean; onStatus?: (s: string) => void }) {
  const map = useMap();
  const [fc, setFc] = useState<FeatureCollection | null>(null);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const load = async () => {
      await Promise.resolve();
      if (cancelled) return;
      const b = map.getBounds();
      if (map.getZoom() < 9) { onStatus?.('zoom in past level 9 for ENC features'); setFc(null); return; }
      const { data, error } = await supabase.rpc('chart_features_geojson', { min_lon: b.getWest(), min_lat: b.getSouth(), max_lon: b.getEast(), max_lat: b.getNorth(), max_rows: 4000 });
      if (cancelled) return;
      if (error) { onStatus?.(`ENC layer error: ${error.message}`); return; }
      const col = data as unknown as FeatureCollection | null;
      setFc(col && col.features?.length ? col : null);
      onStatus?.(col && col.features?.length ? `${col.features.length} ENC features (NOAA, not for navigation)` : 'no ENC features loaded for this area; run scripts/enc-to-geojson.sh');
    };
    void load();
    map.on('moveend', load);
    return () => { cancelled = true; map.off('moveend', load); };
  }, [visible, map, onStatus]);
  if (!visible || !fc) return null;
  return (
    <GeoJSON
      key={fc.features.length}
      data={fc}
      style={(f) => STYLE[String(f?.properties?.feature_type)] ?? { color: '#9AA8C0', weight: 0.8, fillOpacity: 0.1 }}
      pointToLayer={(f, latlng) => {
        const L = (window as unknown as { L: typeof import('leaflet') }).L;
        const s = STYLE[String(f.properties?.feature_type)] ?? STYLE.SOUNDG;
        return L.circleMarker(latlng, { radius: 3, color: s.color, weight: 1, fillOpacity: s.fillOpacity });
      }}
      onEachFeature={(f, layer) => {
        const p = f.properties ?? {};
        layer.bindTooltip(`${p.feature_type}${p.depth_m !== null && p.depth_m !== undefined ? ` ${p.depth_m} m` : ''} · ${p.cell_id ?? ''}`, { direction: 'top' });
      }}
    />
  );
}
