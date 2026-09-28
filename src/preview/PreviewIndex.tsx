// Dev-only gallery: the primitives and shared components in the states they need to prove, on fixture data.
// Reached only through the DEV-guarded /preview route (see routes.tsx).
import { Anchor, Route, Sparkles } from 'lucide-react';
import type { BriefingRow, AnchorageConditionsRow, WaypointConditionsRow, WaypointRow } from '@/types/domain.ts';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { Segmented } from '@/components/ui/segmented.tsx';
import { Section } from '@/components/ui/section.tsx';
import { Stat } from '@/components/ui/stat.tsx';
import { EmptyState } from '@/components/ui/empty-state.tsx';
import { DropdownMenu } from '@/components/ui/dropdown-menu.tsx';
import { StatusBadge } from '@/components/ui/badge.tsx';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton.tsx';
import { RiskDot, RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { DisagreementBadge } from '@/components/dashboard/DisagreementBadge.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { FieldCard } from '@/components/dashboard/FieldCard.tsx';
import { DirArrow, TideGlyph, TowardArrow, WindBand } from '@/components/dashboard/WindBand.tsx';
import { BandChart } from '@/components/dashboard/BandChart.tsx';
import { TideSwellChart } from '@/components/dashboard/TideSwellChart.tsx';
import { TideChart } from '@/components/dashboard/TideChart.tsx';
import { LegProfile } from '@/components/dashboard/LegProfile.tsx';
import { WindRose } from '@/components/anchorage/WindRose.tsx';
import { BriefingCard } from '@/components/briefing/BriefingCard.tsx';
import { MaterialChangesBanner, type MaterialChange } from '@/components/briefing/MaterialChangesBanner.tsx';
import { DisclaimerBar } from '@/components/map/DisclaimerBar.tsx';
import { StayWindowView } from '@/components/anchorage/StayWindowView.tsx';
import { SquallBadge } from '@/components/dashboard/SquallBadge.tsx';
import { GustSourceChip } from '@/components/dashboard/GustSourceChip.tsx';
import { DepthSourceChip } from '@/components/dashboard/DepthSourceChip.tsx';
import { AlertCard } from '@/components/notifications/AlertCard.tsx';
import { LegList } from '@/components/passage/LegList.tsx';
import { groupLegConditions } from '@/lib/leg-profile.ts';
import { windRose } from '../../supabase/functions/_shared/departure-windows.ts';
import type { LegConditionsRow, NotificationRow } from '@/types/domain.ts';
import * as fx from './fixtures.ts';

const conds = fx.waypoint_conditions.filter((c) => c.run_id === 'run-2') as unknown as WaypointConditionsRow[];
const wps = fx.waypoints.filter((w) => w.passage_id === 'p1') as unknown as WaypointRow[];
const legs = groupLegConditions(fx.leg_conditions as unknown as LegConditionsRow[], wps);
const NOW_MS = Date.now();
const briefing = fx.passage_briefings[0] as unknown as BriefingRow;
const anch = fx.anchorage_conditions[1] as unknown as AnchorageConditionsRow;
const atmosTarget = fx.ingest_targets.find((t) => t.layer === 'atmospheric' && Number(t.id) === 113) ?? fx.ingest_targets.find((t) => t.layer === 'atmospheric')!;
const primary = fx.forecast_atmospheric.filter((r) => r.target_id === atmosTarget.id && r.source === 'google_weathernext2_ensemble');
const cmpBy = new Map(fx.forecast_atmospheric.filter((r) => r.target_id === atmosTarget.id && r.source === 'ncep_gfs_global').map((r) => [r.forecast_time, r]));
const bandPoints = primary.map((r) => ({ t: Date.parse(String(r.forecast_time)), time: String(r.forecast_time), p10: r.wind_p10_kn as number, p50: r.wind_p50_kn as number, p90: r.wind_p90_kn as number, gust90: r.gust_p90_kn as number, dir: r.wind_dir_mean_deg as number, cmp: (cmpBy.get(r.forecast_time)?.wind_p50_kn as number) ?? null, cmpDir: null }));
const tidal = fx.forecast_tidal.filter((r) => r.target_id === 104);
const swellBy = new Map(fx.forecast_marine.filter((r) => r.target_id === 103).map((r) => [Date.parse(String(r.forecast_time)), r.swell_height_m as number]));
const tidePoints = tidal.map((r) => { const t = Date.parse(String(r.forecast_time)); const tide = r.tide_height_m as number; const swell = swellBy.get(t) ?? null; return { t, tide, swell, ukc: Math.round((8 + tide - 2.6 - (swell ?? 0) / 2) * 100) / 100 }; });
const roseHours = Array.from({ length: 36 }, (_, h) => ({ dir_deg: 235 + 25 * Math.sin(h / 5) + (h % 7) * 3, speed_kn: 11 + 6 * Math.sin(h / 6) }));
const byWp = new Map(conds.map((c) => [c.waypoint_id, c]));
const legInto = new Map(legs.map((l) => [l.toId, l]));

export default function PreviewIndex() {
  const noop = () => undefined;
  return (
    <div className="p-4 md:p-6 space-y-10 max-w-6xl">
      <div>
        <h1 className="t-page">Component gallery</h1>
        <p className="t-caption mt-1">Dev only. Screens: <a className="text-accent" href="/passages/p1">Passage (underway)</a> · <a className="text-accent" href="/passages/p4">Passage (not checked)</a> · <a className="text-accent" href="/passages/p1/table">Full table</a> · <a className="text-accent" href="/passages/p1/comparison">Compare models</a> · <a className="text-accent" href="/passages/p1/anchorage/wp5">Anchorage</a> · <a className="text-accent" href="/passages/p1/edit">Builder</a> · <a className="text-accent" href="/vessels/v1">Vessel</a> · <a className="text-accent" href="/passages">Passages</a> · <a className="text-accent" href="/alerts">Alerts</a> · <a className="text-accent" href="/settings">Settings</a></p>
      </div>

      <Section title="Tokens">
        <div className="flex flex-wrap gap-2">
          {[['bg-0', '#0B1220'], ['bg-1', '#111A2E'], ['bg-elev', '#131D33'], ['bg-2', '#182338'], ['border', '#23304A'], ['text-1', '#E6EDF7'], ['text-2', '#9AA8C0'], ['text-3', '#66748F'], ['accent', '#2DD4BF'], ['green', '#34D399'], ['amber', '#FBBF24'], ['red', '#F87171'], ['violet', '#A78BFA']].map(([n, hex]) => (
            <div key={n} className="w-24"><div className="h-10 rounded-lg border border-border-soft" style={{ background: hex }} /><div className="label mt-1">{n}</div><div className="num text-[11px] text-text-2">{hex}</div></div>
          ))}
        </div>
      </Section>

      <Section title="Type scale">
        <div className="space-y-1">
          <div className="t-page">Page title 24 / 600</div>
          <div className="t-section">Section title 16 / 600</div>
          <div className="t-card">Card title 14 / 600</div>
          <div>Body 14 / 400, line height 1.55. Aurora Borealis departs Thu 4 Sep, 12:58 local.</div>
          <div className="t-caption">Caption 12 / 400 in text-2</div>
          <div className="label">Label 12 / 500 in text-3, sentence case</div>
          <div className="num text-[16px]">12 to 18 kn · 1.6 m at 7 s · 245° (mono only for numbers)</div>
        </div>
      </Section>

      <Section title="Buttons, segmented, menu, inputs">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Check conditions</Button><Button loading>Checking</Button><Button variant="secondary">Regenerate</Button><Button variant="ghost">Cancel</Button><Button variant="destructive">Delete</Button>
          <Button size="sm">Small</Button><Button size="sm" variant="secondary">Small secondary</Button>
          <Segmented label="Detail" value="simple" onChange={noop} options={[{ value: 'simple', label: 'Simple' }, { value: 'detailed', label: 'Detailed' }]} />
          <DropdownMenu label="More" items={[{ label: 'Edit route' }, { label: 'Start passage', hint: 'Marks it underway.' }, { kind: 'divider' }, { kind: 'heading', label: 'Advanced' }, { label: 'Refresh forecast data' }, { label: 'Delete', danger: true }]} />
          <div className="w-40"><Label>Cruise speed (kn)</Label><Input type="number" defaultValue={12} /></div>
          <label className="flex items-center gap-2 text-[13px]">Comparison <Switch defaultChecked /></label>
        </div>
      </Section>

      <Section title="Stats">
        <div className="card p-5 grid grid-cols-2 md:grid-cols-4 gap-5">
          <Stat label="Departure" value="Thu 4 Sep, 12:58" sub="Local, actual" />
          <Stat label="Wind" value="16 to 23 kn from the west" sub="Up to 32 kn mid-leg" hint="Likely (median) to high-end (90th percentile) of the ensemble." />
          <Stat label="Worst stretch" value="Ko Ha" aside={<RiskPill flag="red" size="sm" />} sub="this afternoon, gusts to 38 kn" />
          <Stat label="Sea" value={null} reason="No marine grid point within 55 km" />
        </div>
      </Section>

      <Section title="Pills, dots, chips">
        <div className="flex flex-wrap items-center gap-3">
          <RiskPill flag="green" /><RiskPill flag="amber" reasons={['wind p90 22 kn > 0.75 x max_wind 25 kn']} /><RiskPill flag="red" reasons={['gust p90 38 kn > max_gust 35 kn']} /><RiskPill flag="unknown" /><RiskPill flag="amber" size="sm" />
          <RiskDot flag="red" /><RiskDot flag="unknown" />
          <span className="text-text-3">|</span>
          <StatusBadge status="planned" /><StatusBadge status="active" /><StatusBadge status="completed" />
          <span className="text-text-3">|</span>
          <DisagreementBadge active speedDelta={9} dirDelta={35} primary="google_weathernext2_ensemble" comparison="ncep_gfs_global" /><DisagreementBadge active={false} showAgree />
          <span className="text-text-3">|</span>
          <ConfidenceDot level="high" withLabel /><ConfidenceDot level="moderate" withLabel triggers={['wide_ensemble_spread']} /><ConfidenceDot level="low" withLabel triggers={['no_data_marine']} />
          <span className="text-text-3">|</span>
          <SquallBadge risk="possible" capeJkg={640} precipPct={55} /><SquallBadge risk="likely" capeJkg={1350} precipPct={70} />
          <span className="num text-sm">29 kn <GustSourceChip source="google_weathernext2_ensemble" /></span><span className="num text-sm">38 kn <GustSourceChip source="estimated_x1.3" /></span>
          <DepthSourceChip source="gebco" />
        </div>
      </Section>

      <Section title="Empty state">
        <EmptyState icon={Route} title="No passages yet" body="Drop pins on the weather map or import a GPX file to plan the first one." action={<Button>New passage</Button>} />
      </Section>

      <Section title="Field cards (Detailed mode)">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <FieldCard label="Wind p50 / p90" value="23 / 31" unit="kn" />
          <FieldCard label="Tide (station)" value={0.62} unit="m LAT" sub="ebb · station TH-0421" />
          <FieldCard label="Wave / period" value={null} reason="no marine grid point within 55 km" />
          <FieldCard label="Under-keel clearance" value={20.0} unit="m" sub="charted+tide+swell" />
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-3">
          <WindBand p10={8} p50={12} p90={16} limit={25} /><WindBand p10={16} p50={23} p90={31} limit={25} /><WindBand p10={null} p50={null} p90={null} />
          <DirArrow deg={245} spread={18} /><TowardArrow deg={35} />
          <span className="num text-sm">1.42 m <TideGlyph state="flood" /> 0.62 m <TideGlyph state="ebb" /></span>
        </div>
      </Section>

      <Section title="Leg list (plain English)">
        <div className="max-w-xl"><LegList passageId="p1" waypoints={wps} byWp={byWp} legInto={legInto} selectedId={wps[3].id} onSelect={noop} utcOffsetMin={420} detail="simple" underway onArrived={noop} totalNm={70.4} /></div>
      </Section>

      <Section title="Charts">
        <BandChart title="Wind at the waypoint over time" points={bandPoints} limitKn={25} etaIso={String(wps[3].eta)} comparisonLabel="NOAA GFS" />
        <TideSwellChart title="Tide and swell" points={tidePoints} minUkcM={1.0} datum="LAT" etaIso={String(wps[4].eta)} stayEndIso={String(wps[4].planned_departure_from_here)} />
        <TideChart title="Tide at Ao Kantiang" series={tidePoints.map((p) => ({ t: p.t, height: p.tide }))} datum="LAT" nowMs={NOW_MS} etaMarks={[{ t: Date.parse(String(wps[4].eta)), label: '5. Ao Kantiang' }]} />
        <div className="card p-4">{legs[2] ? <LegProfile leg={legs[2]} maxWindKn={25} maxWaveM={2} utcOffsetMin={420} /> : null}</div>
        <div className="card p-4 inline-block"><WindRose bins={windRose(roseHours)} /></div>
      </Section>

      <Section title="Briefing card, changes banner, disclaimer">
        <BriefingCard briefing={briefing} busy={false} error={null} onGenerate={noop} canGenerate nowMs={NOW_MS} />
        <BriefingCard briefing={null} busy={false} error={null} onGenerate={noop} canGenerate={false} nowMs={NOW_MS} />
        <MaterialChangesBanner changes={briefing.material_changes as MaterialChange[]} meta="36 min ago" onDismiss={noop} />
        <DisclaimerBar />
      </Section>

      <Section title="Stay window summary (anchorage)">
        <StayWindowView a={anch} utcOffsetMin={420} />
      </Section>

      <Section title="Alerts">
        <div className="space-y-2 max-w-xl">{(fx.notifications as unknown as NotificationRow[]).slice(0, 2).map((n) => <AlertCard key={n.id} n={n} now={NOW_MS} onOpen={noop} />)}</div>
      </Section>

      <Section title="Loading skeletons">
        <div className="flex flex-wrap gap-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-9 w-24" /><Skeleton className="h-5 w-16 rounded-full" /></div>
        <div className="card overflow-hidden"><PageSkeleton variant="passage" /></div>
        <div className="flex gap-3 text-text-3"><Anchor className="h-4 w-4" /><Sparkles className="h-4 w-4" /></div>
      </Section>
    </div>
  );
}
