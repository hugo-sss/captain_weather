import { useMemo } from 'react';
import L from 'leaflet';
import { Marker, Tooltip } from 'react-leaflet';
import type { RiskFlag } from '@/types/domain.ts';
import { RISK_HEX, ACCENT } from '@/lib/risk-colors.ts';

type Props = {
  lat: number; lon: number; sequence: number; name: string | null; isAnchorage?: boolean; risk?: RiskFlag | null; selected?: boolean;
  draggable?: boolean; onDrag?: (lat: number, lon: number) => void; onClick?: () => void;
};

/** Numbered pin: round for a waypoint, square for an anchorage, coloured by risk once a run exists. */
export function WaypointMarker({ lat, lon, sequence, name, isAnchorage, risk, selected, draggable, onDrag, onClick }: Props) {
  const icon = useMemo(() => {
    const colour = risk ? RISK_HEX[risk] : ACCENT;
    const ring = selected ? `box-shadow:0 0 0 4px ${colour}40, 0 2px 8px rgba(0,0,0,0.5);` : 'box-shadow:0 2px 8px rgba(0,0,0,0.5);';
    const shape = isAnchorage ? 'border-radius:5px;' : 'border-radius:50%;';
    const size = selected ? 26 : 22;
    return L.divIcon({
      className: '',
      html: `<div style="width:${size}px;height:${size}px;${shape}background:#111A2E;border:2px solid ${colour};color:#E6EDF7;font:600 11px 'JetBrains Mono',ui-monospace,monospace;display:flex;align-items:center;justify-content:center;${ring}transition:box-shadow 120ms ease">${sequence}</div>`,
      iconSize: [size, size], iconAnchor: [size / 2, size / 2],
    });
  }, [risk, selected, isAnchorage, sequence]);
  return (
    <Marker
      position={[lat, lon]} icon={icon} draggable={draggable}
      eventHandlers={{ dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); onDrag?.(ll.lat, ll.lng); }, click: () => onClick?.() }}
    >
      <Tooltip direction="top" offset={[0, -12]} opacity={1}>{sequence}. {name ?? 'Waypoint'}{isAnchorage ? ' (anchorage)' : ''}</Tooltip>
    </Marker>
  );
}
