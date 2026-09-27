// Tide and depth at the selected waypoint: station tide by default, swell and under-keel clearance on a switch.
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { DetailLevel, VesselRow, WaypointConditionsRow, WaypointRow } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import type { TideSwellPoint } from '@/components/dashboard/TideSwellChart.tsx';
import type { IngestTargetRow } from '@/types/domain.ts';
import { TideChart, type EtaMark } from '@/components/dashboard/TideChart.tsx';
import { TideSwellChart } from '@/components/dashboard/TideSwellChart.tsx';
import { DepthSourceChip } from '@/components/dashboard/DepthSourceChip.tsx';
import { Section } from '@/components/ui/section.tsx';
import { Stat } from '@/components/ui/stat.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { tidePhrase } from '@/lib/plain.ts';
import { fmtNum } from '@/lib/units.ts';
import { ukcBasisText } from '@/lib/gebco.ts';

type Props = {
  passageId: string; selected: WaypointRow | null; selC: WaypointConditionsRow | null; vessel: VesselRow | null;
  tideSwell: { points: TideSwellPoint[]; datum: string | null; tidalTarget: IngestTargetRow | null };
  nowMs: number; etaMarks: EtaMark[]; etaIso: string | null; detail: DetailLevel;
  showSwell: boolean; onShowSwell: (v: boolean) => void;
  noRun?: boolean;
};

export function TideSection({ passageId, selected, selC, vessel, tideSwell, nowMs, etaMarks, etaIso, detail, showSwell, onShowSwell, noRun }: Props) {
  const tideOnly = tideSwell.points.map((p) => ({ t: p.t, height: p.tide }));
  const draft = num(vessel?.draft_m), depth = num(selected?.charted_depth_m), ukc = num(selC?.ukc_estimate_m), minUkc = num(vessel?.min_ukc_m);
  const ukcTone = ukc !== null && minUkc !== null ? (ukc < minUkc ? 'red' : ukc < minUkc * 1.5 ? 'amber' : 'default') : 'default';
  const hint = draft === null
    ? <span>Add the vessel draft to see clearance. <Link to={vessel ? `/vessels/${vessel.id}` : '/vessels'} className="text-accent hover:underline underline-offset-2 inline-flex items-center gap-0.5">Vessel settings <ArrowUpRight className="h-3 w-3" /></Link></span>
    : depth === null
      ? <span>Add a charted depth for this waypoint to see clearance. <Link to={`/passages/${passageId}/edit`} className="text-accent hover:underline underline-offset-2 inline-flex items-center gap-0.5">Edit route <ArrowUpRight className="h-3 w-3" /></Link></span>
      : null;
  return (
    <Section id="tide" title="Tide and depth" description={<span>Station tide{tideSwell.tidalTarget?.station_id && detail === 'detailed' ? ` (station ${tideSwell.tidalTarget.station_id})` : ''} at {selected?.name ?? 'the selected waypoint'}. Never a model sea level.</span>}
      actions={<label className="flex items-center gap-2 text-[13px] text-text-2 cursor-pointer"><span className="hidden sm:inline">Show swell and under-keel clearance</span><span className="sm:hidden">Swell and clearance</span> <Switch checked={showSwell} onCheckedChange={onShowSwell} aria-label="Show swell and under-keel clearance" /></label>}>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px] items-start">
        <div className="card p-4 md:p-5 min-w-0">
          {showSwell
            ? <TideSwellChart bare points={tideSwell.points} minUkcM={minUkc} datum={tideSwell.datum} etaIso={etaIso} stayEndIso={selected?.is_anchorage ? selected.planned_departure_from_here : null} />
            : <TideChart bare series={tideOnly} datum={tideSwell.datum} nowMs={nowMs} etaMarks={etaMarks} />}
        </div>
        <div className="card p-4 md:p-5 grid grid-cols-2 lg:grid-cols-1 gap-4">
          <Stat label="Tide at arrival" value={selC ? tidePhrase(selC.tide_height_m, selC.tide_datum, selC.tide_state) : null} reason={noRun ? 'Not checked yet' : 'No tide data for this waypoint'} hint="Height above the station datum at the ETA, and whether it is rising or falling." />
          <Stat label="Under-keel clearance" value={ukc !== null ? `${fmtNum(ukc, 1)} m` : null} tone={ukcTone} aside={<DepthSourceChip source={selected?.charted_depth_source} />} sub={ukc !== null ? (detail === 'detailed' ? ukcBasisText(selC?.ukc_basis, selected?.charted_depth_source) : `Charted depth plus tide, minus draft${selC?.ukc_basis === 'charted+tide+swell' ? ' and half the swell' : ''}${selected?.is_anchorage ? '' : ', with 0.3 m squat'}`) : undefined} reason={hint ?? 'Needs draft, charted depth and tide'} />
          <Stat label="Charted depth" value={depth !== null ? `${fmtNum(depth, 1)} m` : null} sub={selected?.charted_depth_source === 'gebco' ? 'GEBCO grid value, not a sounding' : selected?.charted_depth_source === 'user' ? 'Entered by hand' : undefined} reason="Not entered for this waypoint" />
        </div>
      </div>
    </Section>
  );
}
