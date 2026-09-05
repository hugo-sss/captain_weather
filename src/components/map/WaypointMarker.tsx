import { useMemo } from 'react';
import L from 'leaflet';
import { Marker, Tooltip } from 'react-leaflet';
import type { RiskFlag } from '@/types/domain.ts';
import { RISK_HEX, ACCENT } from '@/lib/risk-colors.ts';

type Props = {
  lat: number; lon: number; sequence: number; name: string | null; isAnchorage?: boolean; risk?: RiskFlag | null; selected?: boolean;
  draggable?: boolean; onDrag?: (lat: number, lon: number) => void; onClick?: () => void;
};

export function WaypointMarker({ lat, lon, sequence, name, isAnchorage, risk, selected, draggable, onDrag, onClick }: Props) {
  const icon = useMemo(() => {
    const colour = risk ? RISK_HEX[risk] : ACCENT;
    const ring = selected ? `box-shadow:0 0 0 3px ${colour}55;` : '';
    const shape = isAnchorage ? 'border-radius:4px;' : 'border-radius:50%;';
    return L.divIcon({
      className: '',
      html: `<div style="width:22px;height:22px;${shape}background:#111A2E;border:2px solid ${colour};color:#E6EDF7;font:600 11px 'JetBrains Mono',monospace;display:flex;align-items:center;justify-content:center;${ring}">${sequence}</div>`,
      iconSize: [22, 22], iconAnchor: [11, 11],
    });
  }, [risk, selected, isAnchorage, sequence]);
  return (
    <Marker
      position={[lat, lon]} icon={icon} draggable={draggable}
      eventHandlers={{ dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); onDrag?.(ll.lat, ll.lng); }, click: () => onClick?.() }}
    >
      <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>{sequence}. {name ?? 'Waypoint'}{isAnchorage ? ' (anchorage)' : ''}</Tooltip>
    </Marker>
  );
}
