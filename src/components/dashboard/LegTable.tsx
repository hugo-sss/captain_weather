import type { WaypointConditionsRow, WaypointRow } from '@/types/domain.ts';
import { LegRow } from './LegRow.tsx';
import { LegCard } from './LegCard.tsx';
import { cn } from '@/lib/utils.ts';

type Props = { waypoints: WaypointRow[]; conditions: WaypointConditionsRow[]; maxWindKn: number | null; selectedId: string | null; onSelect: (id: string) => void; showComparison: boolean; utcOffsetMin: number | null; passageId?: string };

const Th = ({ children, title, className }: { children?: React.ReactNode; title?: string; className?: string }) => <th scope="col" title={title} className={className}>{children}</th>;
const Group = ({ children, span, className }: { children?: React.ReactNode; span: number; className?: string }) => <th scope="colgroup" colSpan={span} className={cn(className)}>{children}</th>;

/** The Professional table: every number, one row per leg. Collapses to stacked cards with the same fields below md. */
export function LegTable({ waypoints, conditions, maxWindKn, selectedId, onSelect, showComparison, utcOffsetMin, passageId }: Props) {
  const byWp = new Map(conditions.map((c) => [c.waypoint_id, c]));
  return (
    <>
      <div className="md:hidden p-3 space-y-2">
        {waypoints.map((wp) => <LegCard key={wp.id} wp={wp} c={byWp.get(wp.id) ?? null} selected={selectedId === wp.id} onSelect={() => onSelect(wp.id)} passageId={passageId} utcOffsetMin={utcOffsetMin} />)}
      </div>
      <div className="hidden md:block overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr className="groups">
              <Group span={4}>Leg</Group>
              <Group span={3}>Wind · primary ensemble</Group>
              <Group span={2}>Sea</Group>
              <Group span={3}>Tide · current · UKC</Group>
              {showComparison && <Group span={1} className="text-flag-violet/80">Comparison</Group>}
              <Group span={3}>Assessment</Group>
            </tr>
            <tr>
              <Th className="r">#</Th><Th>Waypoint</Th><Th>ETA UTC / local</Th><Th className="r" title="ETA minus forecast init time">Lead</Th>
              <Th title="p10 / p50 / p90 in knots; band on a 0..50 kn scale with the p50 tick and the vessel limit in red">p10 / p50 / p90 kn</Th><Th title="Mean direction the wind blows FROM, with ensemble spread on hover">Dir from</Th><Th className="r">Gust p90</Th>
              <Th title="Significant wave height and peak period">Wave</Th><Th title="Swell height and direction from">Swell</Th>
              <Th title="Tide height above the stated datum, from the tidal adapter">Tide</Th><Th title="Current speed and direction it sets TOWARD (SMOC, weak in straits)">Current</Th><Th className="r" title="Under-keel clearance estimate; hover for basis">UKC</Th>
              {showComparison && <Th title="Comparison model wind and its delta against the primary p50">GFS wind · Δ</Th>}
              <Th title="Primary vs comparison model agreement">Models</Th><Th>Risk</Th><Th className="text-center" title="Confidence per waypoint">Conf</Th>
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
