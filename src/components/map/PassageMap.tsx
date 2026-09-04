import { useEffect } from 'react';
import { MapContainer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { BaseTiles, OpenSeaMapLayer } from './ChartOverlays.tsx';
import { RouteLine, type RoutePoint } from './RouteLine.tsx';
import { WaypointMarker } from './WaypointMarker.tsx';
import type { RiskFlag } from '@/types/domain.ts';

export type MapWaypoint = { id: string; sequence: number; name: string | null; lat: number; lon: number; is_anchorage: boolean; risk?: RiskFlag | null };

type Props = {
  waypoints: MapWaypoint[];
  editable?: boolean;
  selectedId?: string | null;
  showOpenSeaMap: boolean;
  colourByRisk?: boolean;
  onAddPin?: (lat: number, lon: number) => void;
  onMovePin?: (id: string, lat: number, lon: number) => void;
  onSelect?: (id: string) => void;
  className?: string;
};

function FitBounds({ waypoints }: { waypoints: MapWaypoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (waypoints.length === 0) return;
    if (waypoints.length === 1) { map.setView([waypoints[0].lat, waypoints[0].lon], 9); return; }
    map.fitBounds(L.latLngBounds(waypoints.map((w) => [w.lat, w.lon])), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints.length]);
  return null;
}

function ClickToAdd({ enabled, onAdd }: { enabled: boolean; onAdd?: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => { if (enabled) onAdd?.(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function GeomanControls({ enabled }: { enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    map.pm.addControls({ position: 'topleft', drawMarker: false, drawCircleMarker: false, drawPolyline: false, drawRectangle: false, drawPolygon: false, drawCircle: false, drawText: false, editMode: false, dragMode: false, cutPolygon: false, removalMode: false, rotateMode: false });
    return () => { map.pm.removeControls(); };
  }, [map, enabled]);
  return null;
}

export function PassageMap({ waypoints, editable = false, selectedId, showOpenSeaMap, colourByRisk, onAddPin, onMovePin, onSelect, className }: Props) {
  const centre: [number, number] = waypoints.length ? [waypoints[0].lat, waypoints[0].lon] : [7.8, 98.4];
  const route: RoutePoint[] = waypoints.map((w) => ({ lat: w.lat, lon: w.lon, risk: w.risk }));
  return (
    <MapContainer center={centre} zoom={8} className={className ?? 'h-full w-full'} zoomControl={true} attributionControl={true}>
      <BaseTiles />
      <OpenSeaMapLayer visible={showOpenSeaMap} />
      <RouteLine points={route} colourByRisk={colourByRisk} />
      {waypoints.map((w) => (
        <WaypointMarker key={w.id} lat={w.lat} lon={w.lon} sequence={w.sequence} name={w.name} isAnchorage={w.is_anchorage} risk={w.risk} selected={w.id === selectedId}
          draggable={editable} onDrag={(lat, lon) => onMovePin?.(w.id, lat, lon)} onClick={() => onSelect?.(w.id)} />
      ))}
      <FitBounds waypoints={waypoints} />
      <ClickToAdd enabled={editable} onAdd={onAddPin} />
      <GeomanControls enabled={editable} />
    </MapContainer>
  );
}
