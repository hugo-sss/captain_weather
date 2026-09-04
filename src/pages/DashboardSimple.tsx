// Simplified mode: map first, briefing as hero card, stat tiles, "show table" always visible (PRD §9.5 screen 3).
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePassage } from '@/hooks/usePassage.ts';
import { useConditions } from '@/hooks/useConditions.ts';
import { useBriefing } from '@/hooks/useBriefing.ts';
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';
import { num, type ConfidenceLevel, type RiskFlag } from '@/types/domain.ts';
import { PassageMap } from '@/components/map/PassageMap.tsx';
import { DisclaimerBar } from '@/components/map/DisclaimerBar.tsx';
import { OverlayToggles } from '@/components/map/OverlayToggles.tsx';
import { BriefingCard } from '@/components/briefing/BriefingCard.tsx';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { ModeTabs } from '@/components/dashboard/ModeTabs.tsx';
import { fmtAge, fmtUtc } from '@/lib/time.ts';
import { worstRisk } from '../../supabase/functions/_shared/risk.ts';
import { passageConfidence } from '../../supabase/functions/_shared/confidence.ts';

export default function DashboardSimple() {
  const { id } = useParams();
  const { data, loading } = usePassage(id);
  const cond = useConditions(id);
  const br = useBriefing(id);
  const { prefs, update } = useDisplayPrefs();
  const [encStatus, setEncStatus] = useState<string | null>(null);
  const conditions = useMemo(() => cond.data?.conditions ?? [], [cond.data]);
  const byWp = useMemo(() => new Map(conditions.map((c) => [c.waypoint_id, c])), [conditions]);
  if (loading || !data) return <div className="p-4 text-text-2">{loading ? 'Loading…' : 'Passage not found.'}</div>;
  const { passage, waypoints } = data;
  const flags = conditions.map((c) => c.risk_flag as RiskFlag);
  const worst = flags.length ? worstRisk(flags) : 'unknown';
  const worstLeg = conditions.filter((c) => c.risk_flag === worst).map((c) => waypoints.find((w) => w.id === c.waypoint_id)).find(Boolean);
  const confidence = conditions.length ? passageConfidence(conditions.map((c) => c.confidence_level as ConfidenceLevel)) : null;
  const windows = (br.briefing?.suggested_departure_windows as { start: string; end: string }[] | null) ?? [];
  const tiles = [
    { label: 'Confidence', value: confidence ? <ConfidenceDot level={confidence} withLabel /> : '—' },
    { label: 'Worst leg', value: worstLeg ? <span className="flex items-center gap-2"><RiskPill flag={worst} /> <span className="text-sm">{worstLeg.sequence}. {worstLeg.name}</span></span> : <RiskPill flag={worst} /> },
    { label: 'Departure window', value: windows[0] ? <span className="num text-sm">{fmtUtc(windows[0].start)} → {fmtUtc(windows[0].end)}</span> : <span className="text-text-3 text-sm">none suggested</span> },
    { label: 'Re-check age', value: <span className="num text-sm">{cond.data?.run ? fmtAge(cond.data.run.completed_at ?? cond.data.run.created_at) : 'no run'}</span> },
  ];
  const mapWps = waypoints.map((w) => ({ id: w.id, sequence: w.sequence, name: w.name, lat: Number(w.lat), lon: Number(w.lon), is_anchorage: w.is_anchorage, risk: (byWp.get(w.id)?.risk_flag as RiskFlag | undefined) ?? null }));
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 py-2 border-b border-border bg-bg-1 flex flex-wrap items-center gap-3">
        <div><div className="text-base font-semibold leading-tight">Passage: {passage.name}</div><div className="text-[11px] text-text-3">{passage.status} · departs {fmtUtc(passage.actual_departure ?? passage.planned_departure)}</div></div>
        <ModeTabs passageId={passage.id} current="simple" />
        <Link to={`/passages/${passage.id}`} className="ml-auto text-xs text-accent">Show the table</Link>
      </div>
      <DisclaimerBar />
      <div className="relative h-[42vh] min-h-[280px]">
        <PassageMap waypoints={mapWps} showOpenSeaMap={prefs.show_openseamap} showNoaaEnc={prefs.show_noaa_enc} onEncStatus={setEncStatus} colourByRisk />
        <OverlayToggles prefs={prefs} update={update} encStatus={encStatus} />
      </div>
      <div className="p-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg border border-border bg-bg-1 p-3">
            {tiles.map((t) => <div key={t.label} className="rounded-md bg-bg-2 border border-border px-3 py-2"><div className="label">{t.label}</div><div className="mt-1">{t.value}</div></div>)}
          </div>
          <BriefingCard briefing={br.briefing} busy={br.busy} error={br.error} onGenerate={() => void br.generate(passage.status === 'active' ? 'remaining' : 'full')} passageId={passage.id} tableHref={`/passages/${passage.id}`} />
        </div>
        <div className="rounded-lg border border-border bg-bg-1 p-3 text-sm space-y-1">
          <div className="label mb-1">Legs</div>
          {waypoints.map((w) => { const c = byWp.get(w.id); return (
            <div key={w.id} className="flex items-center gap-2 py-1 border-b border-border last:border-0">
              <span className="num text-text-3 w-5">{w.sequence}</span><span className="flex-1 truncate">{w.name}</span>
              <span className="num text-xs text-text-2">{c ? `${Math.round(num(c.wind_p50_kn) ?? 0)}–${Math.round(num(c.wind_p90_kn) ?? 0)} kn` : ''}</span>
              <RiskPill flag={(c?.risk_flag ?? 'unknown') as RiskFlag} reasons={(c?.risk_reasons as string[]) ?? []} />
            </div>); })}
          <Link to={`/passages/${passage.id}`} className="block pt-2 text-xs text-accent">Full table with every number →</Link>
        </div>
      </div>
    </div>
  );
}
