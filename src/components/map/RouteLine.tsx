import { Polyline, Tooltip } from 'react-leaflet';
import type { RiskFlag } from '@/types/domain.ts';
import { RISK_HEX, ACCENT } from '@/lib/risk-colors.ts';
import type { RouteSegment } from '@/lib/leg-profile.ts';

export type RoutePoint = { lat: number; lon: number; risk?: RiskFlag | null };

/**
 * Route polyline from app state. Each leg may carry its own risk colour (waypoint flag), or, when `segments`
 * are supplied, the line is split between consecutive along-leg points and coloured by each point's flag.
 * `unknown` stretches are dashed in the muted token so "no data" never looks like green.
 */
export function RouteLine({ points, colourByRisk = false, segments }: { points: RoutePoint[]; colourByRisk?: boolean; segments?: RouteSegment[] | null }) {
  if (segments && segments.length) {
    return (
      <>
        {segments.map((s, i) => (
          <Polyline key={i} positions={s.positions} pathOptions={{ color: s.risk ? RISK_HEX[s.risk] : ACCENT, weight: s.risk === 'unknown' ? 2.5 : 3.5, opacity: 0.95, dashArray: s.risk === 'unknown' ? '4 6' : undefined, lineCap: 'butt' }}>
            {s.label && <Tooltip sticky>{s.label}{s.risk ? ` · ${s.risk}` : ''}</Tooltip>}
          </Polyline>
        ))}
      </>
    );
  }
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
