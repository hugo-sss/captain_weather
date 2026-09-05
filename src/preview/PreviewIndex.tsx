// Dev-only gallery: every shared component in every state it needs to prove, on fixture data.
// Reached only through the DEV-guarded /preview route (see routes.tsx).
import type { BriefingRow, AnchorageConditionsRow, WaypointConditionsRow, WaypointRow } from '@/types/domain.ts';
import { KpiStrip } from '@/components/dashboard/KpiStrip.tsx';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { DisagreementBadge } from '@/components/dashboard/DisagreementBadge.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { FieldCard } from '@/components/dashboard/FieldCard.tsx';
import { DirArrow, TideGlyph, TowardArrow, WindBand } from '@/components/dashboard/WindBand.tsx';
import { BandChart } from '@/components/dashboard/BandChart.tsx';
import { TideSwellChart } from '@/components/dashboard/TideSwellChart.tsx';
import { WindRose } from '@/components/anchorage/WindRose.tsx';
import { BriefingCard } from '@/components/briefing/BriefingCard.tsx';
import { MaterialChangesBanner, type MaterialChange } from '@/components/briefing/MaterialChangesBanner.tsx';
import { DisclaimerBar } from '@/components/map/DisclaimerBar.tsx';
import { LegCard } from '@/components/dashboard/LegCard.tsx';
import { StayWindowView } from '@/components/anchorage/StayWindowView.tsx';
import { DepartureWindows } from '@/components/dashboard/DepartureWindows.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { ModeTabs } from '@/components/dashboard/ModeTabs.tsx';
import { StatusBadge } from '@/components/ui/badge.tsx';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton.tsx';
import { MapHeaderStrip } from '@/components/map/MapHeaderStrip.tsx';
import { windRose } from '../../supabase/functions/_shared/departure-windows.ts';
import { SquallBadge } from '@/components/dashboard/SquallBadge.tsx';
import { GustSourceChip } from '@/components/dashboard/GustSourceChip.tsx';
import { DepthSourceChip } from '@/components/dashboard/DepthSourceChip.tsx';
import { LegAlongSummary } from '@/components/dashboard/LegAlongSummary.tsx';
import { LegProfile } from '@/components/dashboard/LegProfile.tsx';
import { TideChart } from '@/components/dashboard/TideChart.tsx';
import { NotificationItem } from '@/components/notifications/NotificationItem.tsx';
import { groupLegConditions } from '@/lib/leg-profile.ts';
import type { LegConditionsRow, NotificationRow } from '@/types/domain.ts';
import * as fx from './fixtures.ts';

const conds = fx.waypoint_conditions.filter((c) => c.run_id === 'run-2') as unknown as WaypointConditionsRow[];
const wps = fx.waypoints.filter((w) => w.passage_id === 'p1') as unknown as WaypointRow[];
const legs = groupLegConditions(fx.leg_conditions as unknown as LegConditionsRow[], wps);
const pointTide = fx.pointTideFixture(7.6, 98.6, 2);
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3"><h2 className="label">{title}</h2>{children}</section>;
}

export default function PreviewIndex() {
  const noop = () => undefined;
  return (
    <div className="p-4 md:p-6 space-y-8 max-w-6xl">
      <div>
        <h1 className="text-lg font-semibold">Component gallery</h1>
        <p className="text-xs text-text-3">Dev only. Screens: <a className="text-accent" href="/passages/p1">Professional</a> · <a className="text-accent" href="/passages/p1/simple">Simplified</a> · <a className="text-accent" href="/passages/p1/comparison">Comparison</a> · <a className="text-accent" href="/passages/p1/active">Monitor</a> · <a className="text-accent" href="/passages/p1/anchorage/wp5">Anchorage</a> · <a className="text-accent" href="/passages/p1/edit">Builder</a> · <a className="text-accent" href="/vessels/v1">Vessel</a> · <a className="text-accent" href="/passages">History</a></p>
      </div>

      <Section title="Tokens">
        <div className="flex flex-wrap gap-2">
          {[['bg-0', '#0B1220'], ['bg-1', '#111A2E'], ['bg-2', '#182338'], ['border', '#23304A'], ['text-1', '#E6EDF7'], ['text-2', '#9AA8C0'], ['text-3', '#66748F'], ['accent', '#2DD4BF'], ['green', '#34D399'], ['amber', '#FBBF24'], ['red', '#F87171'], ['violet', '#A78BFA']].map(([n, hex]) => (
            <div key={n} className="w-24"><div className="h-10 rounded-md border border-border" style={{ background: hex }} /><div className="label mt-1">{n}</div><div className="num text-[11px] text-text-2">{hex}</div></div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <div className="space-y-1">
          <div className="text-lg font-semibold">Phuket to Ko Lanta · heading 18 / 600</div>
          <div className="text-base">Body 16 · Aurora Borealis departs 09/04 06:00Z</div>
          <div className="text-sm text-text-2">Secondary 14 · SW monsoon, consider the inside of Ko Lanta if the swell builds</div>
          <div className="num text-lg">12 / 17 / 22 kn · 1.6 m 7 s · 245°</div>
          <div className="label">Label 11 uppercase 0.06em</div>
        </div>
      </Section>

      <Section title="KPI strip">
        <KpiStrip items={[
          { label: 'Distance', value: '62.4 nm', aside: '5 wps' },
          { label: 'Arrival', value: '09/06 04:10Z', aside: '11:10 (UTC+07)' },
          { label: 'Passage time', value: '51h 40m' },
          { label: 'Max wind p90', value: '31 kn', tone: 'red' },
          { label: 'Max wave', value: '2.3 m' },
          { label: 'Flags', value: <RiskPill flag="red" />, aside: '1 red · 1 amber · 1 diverge' },
          { label: 'Confidence', value: <ConfidenceDot level="moderate" withLabel /> },
        ]} />
      </Section>

      <Section title="Risk pill · disagreement badge · confidence dot">
        <div className="flex flex-wrap items-center gap-3">
          <RiskPill flag="green" /><RiskPill flag="amber" reasons={['wind p90 22 kn > 0.75×max_wind 25 kn']} /><RiskPill flag="red" reasons={['gust p90 38 kn > max_gust 35 kn']} /><RiskPill flag="unknown" /><RiskPill flag="amber" size="sm" />
          <span className="text-text-3">|</span>
          <StatusBadge status="planned" /><StatusBadge status="active" /><StatusBadge status="completed" /><StatusBadge status="archived" />
          <span className="text-text-3">|</span>
          <DisagreementBadge active speedDelta={9} dirDelta={35} primary="google_weathernext2_ensemble" comparison="ncep_gfs_global" /><DisagreementBadge active={false} />
          <span className="text-text-3">|</span>
          <ConfidenceDot level="high" withLabel /><ConfidenceDot level="moderate" withLabel triggers={['wide_ensemble_spread']} /><ConfidenceDot level="low" withLabel triggers={['no_data_marine']} />
        </div>
      </Section>

      <Section title="Field cards (value · with sub · no data hatched)">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <FieldCard label="Wind p50 / p90" value="23 / 31" unit="kn" />
          <FieldCard label="Tide (adapter)" value={0.62} unit="m LAT" sub="ebb · station TH-0421" />
          <FieldCard label="Wave / period" value={null} reason="no marine grid point within 55 km" />
          <FieldCard label="UKC estimate" value={20.0} unit="m" sub="charted+tide+swell" />
        </div>
      </Section>

      <Section title="Wind band · direction arrows · tide glyphs">
        <div className="flex flex-wrap items-center gap-4">
          <WindBand p10={8} p50={12} p90={16} limit={25} /><WindBand p10={16} p50={23} p90={31} limit={25} /><WindBand p10={null} p50={null} p90={null} />
          <DirArrow deg={245} spread={18} /><TowardArrow deg={35} />
          <span className="num text-sm">1.42 m <TideGlyph state="flood" /> 0.62 m <TideGlyph state="ebb" /> 1.95 m <TideGlyph state="high" /></span>
        </div>
      </Section>

      <Section title="Mode tabs · buttons · inputs">
        <div className="flex flex-wrap items-center gap-3">
          <ModeTabs passageId="p1" current="pro" />
          <Button size="sm">Re-check conditions</Button><Button size="sm" variant="secondary">Fetch now</Button><Button size="sm" variant="outline">Monitor</Button><Button size="sm" variant="ghost">GPX</Button><Button size="sm" variant="destructive">Delete</Button>
          <div className="w-40"><Label>Cruise speed (kn)</Label><Input type="number" defaultValue={12} /></div>
          <label className="flex items-center gap-2 text-xs">Comparison <Switch defaultChecked /></label>
        </div>
      </Section>

      <Section title="Band chart">
        <BandChart points={bandPoints} limitKn={25} etaIso={String(wps[3].eta)} comparisonLabel="ncep_gfs_global" />
      </Section>

      <Section title="Tide + swell paired chart">
        <TideSwellChart points={tidePoints} minUkcM={1.0} datum="LAT" etaIso={String(wps[4].eta)} stayEndIso={String(wps[4].planned_departure_from_here)} />
      </Section>

      <Section title="Wind rose">
        <WindRose bins={windRose(roseHours)} />
      </Section>

      <Section title="Briefing card (validated) · unavailable · none">
        <BriefingCard briefing={briefing} busy={false} error={null} onGenerate={noop} passageId="p1" tableHref="/passages/p1" />
        <BriefingCard briefing={{ ...briefing, validator_passed: false, summary_text: null, validator_result: { passed: false, violations: [{ rule: 'banned' }], attempts: 2 } } as BriefingRow} busy={false} error={null} onGenerate={noop} passageId="p1" compact />
        <BriefingCard briefing={null} busy={false} error={null} onGenerate={noop} passageId="p1" compact />
      </Section>

      <Section title="Material changes banner · disclaimer bar · departure windows">
        <MaterialChangesBanner changes={briefing.material_changes as MaterialChange[]} />
        <DisclaimerBar />
        <DepartureWindows derived={[{ start: String(wps[2].eta), end: new Date(Date.parse(String(wps[2].eta)) + 7 * 3_600_000).toISOString(), hours: 7, max_wind_p90_kn: 18, reason: 'ok' }]} sampled={72} suggested={briefing.suggested_departure_windows as { start: string; end: string; reason: string }[]} />
      </Section>

      <Section title="Stay window summary (anchorage)">
        <StayWindowView a={anch} />
      </Section>

      <Section title="Leg cards (mobile stack) · map header strip">
        <div className="max-w-sm space-y-2">
          <div className="panel overflow-hidden"><MapHeaderStrip from="1. Ao Chalong" to="5. Ao Kantiang" totalNm={70.4} legs={[{ nm: 12.9, risk: 'green' }, { nm: 25.5, risk: 'amber' }, { nm: 20.1, risk: 'red' }, { nm: 11.9, risk: 'green' }]} open={false} onToggle={noop} /></div>
          <LegCard wp={wps[3]} c={conds[3]} selected onSelect={noop} passageId="p1" utcOffsetMin={420} maxWindKn={25} />
          <LegCard wp={wps[4]} c={conds[4]} selected={false} onSelect={noop} passageId="p1" utcOffsetMin={420} maxWindKn={25} />
        </div>
      </Section>

      <Section title="Phase 5 · squall · gust provenance · depth provenance · along-leg summary">
        <div className="flex flex-wrap items-center gap-3">
          <SquallBadge risk="possible" capeJkg={640} precipPct={55} /><SquallBadge risk="likely" capeJkg={1350} precipPct={70} /><SquallBadge risk="possible" size="sm" />
          <span className="text-text-3">|</span>
          <span className="num text-sm">29 kn <GustSourceChip source="google_weathernext2_ensemble" /></span><span className="num text-sm">25 kn <GustSourceChip source="ecmwf_ifs025_ensemble" /></span><span className="num text-sm">38 kn <GustSourceChip source="estimated_x1.3" /></span>
          <span className="text-text-3">|</span>
          <DepthSourceChip source="gebco" />
          <span className="text-text-3">|</span>
          <LegAlongSummary summary={legs[2]?.summary ?? null} etaDeltaMin={70} speedLossPct={22} />
        </div>
      </Section>

      <Section title="Leg profile (conditions between waypoints) · hover a point">
        <div className="panel p-3">{legs[2] ? <LegProfile leg={legs[2]} maxWindKn={25} maxWaveM={2} utcOffsetMin={420} /> : null}</div>
      </Section>

      <Section title="Tide only (station curve, HW/LW, now, ETA marks) · point-tide response">
        <TideChart series={tidePoints.map((p) => ({ t: p.t, height: p.tide }))} datum="LAT" nowMs={NOW_MS} etaMarks={[{ t: Date.parse(String(wps[4].eta)), label: '5. ETA' }]} title="Tide at Ao Kantiang" meta="station TH-0421" />
        <div className="max-w-sm panel p-3"><TideChart bare compact series={pointTide.series.map((s) => ({ t: Date.parse(s.time), height: s.height_m }))} extremes={pointTide.extremes.map((e) => ({ t: Date.parse(e.time), height: e.height_m, type: e.type }))} datum={pointTide.datum} nowMs={NOW_MS} /></div>
      </Section>

      <Section title="Notifications (inbox rows)">
        <div className="panel p-1 max-w-lg">{(fx.notifications as unknown as NotificationRow[]).slice(0, 3).map((n) => <NotificationItem key={n.id} n={n} now={NOW_MS} onOpen={noop} dense />)}</div>
      </Section>

      <Section title="Loading skeletons (match the final layout)">
        <div className="flex flex-wrap gap-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-8 w-24" /><Skeleton className="h-5 w-16 rounded-full" /></div>
        <div className="panel overflow-hidden"><PageSkeleton variant="table" /></div>
      </Section>
    </div>
  );
}
