import type { WaypointConditionsRow, WaypointRow } from '@/types/domain.ts';
import { LegRow } from './LegRow.tsx';
import { LegCard } from './LegCard.tsx';

type Props = { waypoints: WaypointRow[]; conditions: WaypointConditionsRow[]; maxWindKn: number | null; selectedId: string | null; onSelect: (id: string) => void; showComparison: boolean; utcOffsetMin: number | null; passageId?: string };

const Th = ({ children, title }: { children?: React.ReactNode; title?: string }) => <th title={title} className="label text-left px-2 py-1.5 font-medium whitespace-nowrap">{children}</th>;

export function LegTable({ waypoints, conditions, maxWindKn, selectedId, onSelect, showComparison, utcOffsetMin, passageId }: Props) {
  const byWp = new Map(conditions.map((c) => [c.waypoint_id, c]));
  return (
    <>
    <div className="md:hidden p-3 space-y-2">
      {waypoints.map((wp) => <LegCard key={wp.id} wp={wp} c={byWp.get(wp.id) ?? null} selected={selectedId === wp.id} onSelect={() => onSelect(wp.id)} passageId={passageId} utcOffsetMin={utcOffsetMin} />)}
    </div>
    <div className="hidden md:block overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-border">
          <tr>
            <Th>#</Th><Th>Waypoint</Th><Th>ETA UTC / local</Th><Th title="ETA minus forecast init time">Lead</Th>
            <Th title="p10..p90 band, p50 tick, vessel limit in red">Wind band</Th><Th>p10/50/90 kn</Th><Th>Dir (from)</Th><Th>Gust p90</Th>
            <Th>Wave</Th><Th>Swell</Th><Th title="Tide height above the stated datum, from the tidal adapter">Tide</Th><Th title="Current speed and direction it sets TOWARD (SMOC, weak in straits)">Current</Th><Th title="Under-keel clearance estimate; hover for basis">UKC</Th>
            {showComparison && (<><Th>GFS wind</Th><Th>Δ vs primary</Th></>)}
            <Th>Models</Th><Th>Risk</Th><Th>Conf</Th><Th></Th>
          </tr>
        </thead>
        <tbody>
          {waypoints.map((wp) => (
            <LegRow key={wp.id} wp={wp} c={byWp.get(wp.id) ?? null} maxWindKn={maxWindKn} selected={selectedId === wp.id} onSelect={() => onSelect(wp.id)} showComparison={showComparison} utcOffsetMin={utcOffsetMin} passageId={passageId} />
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
