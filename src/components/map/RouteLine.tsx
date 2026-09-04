import { Polyline } from 'react-leaflet';
import type { RiskFlag } from '@/types/domain.ts';
import { RISK_HEX, ACCENT } from '@/lib/risk-colors.ts';

export type RoutePoint = { lat: number; lon: number; risk?: RiskFlag | null };

/** Route polyline from app state. Each leg may carry its own risk colour. */
export function RouteLine({ points, colourByRisk = false }: { points: RoutePoint[]; colourByRisk?: boolean }) {
  if (points.length < 2) return null;
  if (!colourByRisk) return <Polyline positions={points.map((p) => [p.lat, p.lon])} pathOptions={{ color: ACCENT, weight: 2.5, opacity: 0.9 }} />;
  return (
    <>
      {points.slice(1).map((p, i) => (
        <Polyline key={i} positions={[[points[i].lat, points[i].lon], [p.lat, p.lon]]} pathOptions={{ color: p.risk ? RISK_HEX[p.risk] : ACCENT, weight: 3, opacity: 0.95 }} />
      ))}
    </>
  );
}
