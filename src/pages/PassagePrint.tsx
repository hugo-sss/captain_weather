// /passages/:id/print: an ink-friendly page for "Export PDF". White background, black text, no chrome.
// Passage header, the leg table (every column incl. along-leg maxima), each leg profile as a static chart,
// the latest briefing summary, recommended action and per-leg notes, sources with init times, and the
// SOLAS standing statement. Calls window.print() once the data is in (skip with ?noprint=1).
import { useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePassage } from '@/hooks/usePassage.ts';
import { useConditions } from '@/hooks/useConditions.ts';
import { useBriefing, briefingDisplay } from '@/hooks/useBriefing.ts';
import { useLegConditions, useLegProfiles } from '@/hooks/useLegConditions.ts';
import { num, type RiskFlag } from '@/types/domain.ts';
import { LegProfile } from '@/components/dashboard/LegProfile.tsx';
import { fmtEtaDelta, etaDeltaMinutes, RISK_RANK } from '@/lib/leg-profile.ts';
import { gustSourceChip } from '@/lib/gust-source.ts';
import { ukcBasisText } from '@/lib/gebco.ts';
import { fmtHours, fmtUtc } from '@/lib/time.ts';
import { fmtNum } from '@/lib/units.ts';

const SOLAS = 'Supplementary planning aid. Not validated for navigation decisions and not a substitute for official charts, official forecasts or a certified ECDIS. Supports, and does not replace, the master’s passage-planning responsibility under SOLAS V/34.';
const ATTRIBUTION = 'Weather data by Open-Meteo.com (CC-BY 4.0). Tides by TidesAtlas. Charts: OpenSeaMap contributors, NOAA.';

const flagWord = (f: string | null | undefined) => (f === 'red' ? 'RED' : f === 'amber' ? 'AMBER' : f === 'green' ? 'green' : 'no data');

export default function PassagePrint() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { data, loading } = usePassage(id);
  const cond = useConditions(id);
  const br = useBriefing(id);
  const run = cond.data?.run ?? null;
  const legRows = useLegConditions(run?.id ?? null, id);
  const waypoints = useMemo(() => data?.waypoints ?? [], [data]);
  const legs = useLegProfiles(legRows.rows, waypoints);
  const conditions = useMemo(() => cond.data?.conditions ?? [], [cond.data]);
  const byWp = useMemo(() => new Map(conditions.map((c) => [c.waypoint_id, c])), [conditions]);
  const legInto = useMemo(() => new Map(legs.map((l) => [l.toId, l])), [legs]);
  const printed = useRef(false);

  // Mark the document so the print rules know this page is meant for paper; the dark app pages are blanked instead.
  useEffect(() => { document.documentElement.classList.add('print-view'); return () => document.documentElement.classList.remove('print-view'); }, []);
  const ready = !loading && !!data && !cond.loading && !legRows.loading;
  useEffect(() => {
    if (!ready || printed.current || params.get('noprint') === '1') return;
    printed.current = true;
    const t = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(t);
  }, [ready, params]);

  if (loading) return <div className="print-page p-8 text-sm">Preparing the print layout…</div>;
  if (!data) return <div className="print-page p-8 text-sm">Passage not found.</div>;
  const { passage, vessel } = data;
  const totalNm = waypoints.reduce((s, w) => s + (num(w.leg_distance_nm) ?? 0), 0);
  const arrival = waypoints[waypoints.length - 1]?.eta ?? null;
  const generated = new Date().toISOString();
  const briefing = br.briefing;
  const bd = briefingDisplay(briefing);
  const perLeg = ((briefing as unknown as { per_leg_notes?: { waypoint_id?: string; sequence?: number; waypoint_name?: string; note?: string; text?: string }[] } | null)?.per_leg_notes) ?? [];
  const sources = (run?.sources_used ?? null) as Record<string, string> | null;
  const inits = {
    atmos: conditions.map((c) => c.atmos_init_time).filter(Boolean).sort().pop() ?? null,
    marine: conditions.map((c) => c.marine_init_time).filter(Boolean).sort().pop() ?? null,
    cmp: conditions.map((c) => (c.disagreement_detail as { comparison_init_time?: string } | null)?.comparison_init_time ?? null).filter(Boolean).sort().pop() ?? null,
  };
  const worst = [...conditions.map((c) => c.risk_flag as RiskFlag), ...legs.map((l) => l.summary.worstRisk)].reduce<RiskFlag>((w, f) => (RISK_RANK[f] > RISK_RANK[w] ? f : w), 'unknown');

  return (
    <div className="print-page mx-auto max-w-[1360px] p-8 text-[12px] leading-snug">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-black pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.08em] text-[#555]">Captain Passage Tool · passage plan support</div>
          <h1 className="text-[22px] font-semibold leading-tight mt-0.5">{passage.name}</h1>
          <div className="mt-1 num">{vessel?.name ?? 'no vessel'}{vessel ? ` · draft ${fmtNum(num(vessel.draft_m), 1)} m · limits wind ${fmtNum(num(vessel.max_wind_kn), 0)} kn, gust ${fmtNum(num(vessel.max_gust_kn), 0)} kn, wave ${fmtNum(num(vessel.max_wave_m), 1)} m, min UKC ${fmtNum(num(vessel.min_ukc_m), 1)} m` : ''}</div>
        </div>
        <table className="num text-[11px]"><tbody>
          <tr><td className="pr-3 text-[#555]">Departure</td><td>{fmtUtc(passage.actual_departure ?? passage.planned_departure)}{passage.actual_departure ? ' (actual)' : ' (planned)'}</td></tr>
          <tr><td className="pr-3 text-[#555]">Arrival</td><td>{arrival ? fmtUtc(arrival) : '—'} · {totalNm.toFixed(1)} nm · {arrival ? fmtHours((Date.parse(arrival) - Date.parse(passage.actual_departure ?? passage.planned_departure)) / 3_600_000) : '—'}</td></tr>
          <tr><td className="pr-3 text-[#555]">Run</td><td>{run ? `${run.kind} · ${run.trigger} · ${fmtUtc(run.completed_at ?? run.created_at)}` : 'none'}</td></tr>
          <tr><td className="pr-3 text-[#555]">Generated</td><td>{fmtUtc(generated)}</td></tr>
          <tr><td className="pr-3 text-[#555]">Worst flag</td><td className="font-semibold">{flagWord(worst)}</td></tr>
        </tbody></table>
      </header>

      <section className="mt-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] mb-1.5">Legs</h2>
        <div className="overflow-x-auto">
          <table className="print-table num w-full text-[10px]">
            <thead>
              <tr>
                <th>#</th><th className="text-left">Waypoint</th><th>ETA UTC</th><th>Planned</th><th>Δ sea state</th><th>Lead h</th>
                <th>Wind p10/50/90</th><th>Dir</th><th>Gust p90 · src</th><th>Wave m/s</th><th>Swell m/°</th><th>Tide m</th><th>Current</th><th>UKC m</th>
                <th>Cmp kn/° · models</th><th>Squall</th><th>Risk</th><th>Conf</th>
                <th>Leg max p90</th><th>Leg max Hs</th><th>Leg max cur</th><th>Leg worst</th><th>Leg squall</th><th>Loss %</th>
              </tr>
            </thead>
            <tbody>
              {waypoints.map((w) => {
                const c = byWp.get(w.id); const l = legInto.get(w.id); const d = etaDeltaMinutes(c?.eta_planned, c?.eta);
                return (
                  <tr key={w.id}>
                    <td>{w.sequence}</td><td className="text-left font-sans">{w.name ?? ''}{w.is_anchorage ? ' (anch.)' : ''}</td><td>{fmtUtc(c?.eta ?? w.eta)}</td><td>{c?.eta_planned ? fmtUtc(c.eta_planned) : '—'}</td><td>{d === null ? '—' : fmtEtaDelta(d)}</td><td>{c?.lead_time_hours === null || c?.lead_time_hours === undefined ? '—' : Math.round(Number(c.lead_time_hours))}</td>
                    <td>{c && c.wind_p50_kn !== null ? `${fmtNum(num(c.wind_p10_kn), 0)}/${fmtNum(num(c.wind_p50_kn), 0)}/${fmtNum(num(c.wind_p90_kn), 0)}` : '—'}</td><td>{c?.wind_dir_mean_deg === null || c?.wind_dir_mean_deg === undefined ? '—' : `${Math.round(num(c.wind_dir_mean_deg) ?? 0)}°`}</td><td>{fmtNum(num(c?.gust_p90_kn), 0)}<span className="font-sans text-[#555]"> {gustSourceChip(c?.gust_source)?.label ?? ''}</span></td>
                    <td>{c?.wave_height_m === null || c?.wave_height_m === undefined ? '—' : `${fmtNum(num(c.wave_height_m), 1)}/${fmtNum(num(c.wave_period_s), 0)}`}</td><td>{c?.swell_height_m === null || c?.swell_height_m === undefined ? '—' : `${fmtNum(num(c.swell_height_m), 1)}/${Math.round(num(c.swell_dir_deg) ?? 0)}`}</td>
                    <td>{c?.tide_height_m === null || c?.tide_height_m === undefined ? '—' : `${fmtNum(num(c.tide_height_m), 2)} ${c.tide_datum ?? ''} ${c.tide_state ?? ''}`}</td><td>{c?.current_speed_kn === null || c?.current_speed_kn === undefined ? '—' : `${fmtNum(num(c.current_speed_kn), 1)}→${Math.round(num(c.current_dir_deg) ?? 0)}°`}</td>
                    <td title={ukcBasisText(c?.ukc_basis, w.charted_depth_source)}>{fmtNum(num(c?.ukc_estimate_m), 1)}{w.charted_depth_source === 'gebco' ? ' *' : ''}</td>
                    <td>{c?.comparison_wind_kn === null || c?.comparison_wind_kn === undefined ? '—' : `${fmtNum(num(c.comparison_wind_kn), 0)}/${Math.round(num(c.comparison_wind_dir_deg) ?? 0)}`}<span className="font-sans"> {c?.source_disagreement ? 'DIVERGE' : c ? 'agree' : ''}</span></td>
                    <td className="font-sans">{c?.squall_risk && c.squall_risk !== 'none' ? c.squall_risk : '—'}</td><td className="font-sans font-semibold">{flagWord(c?.risk_flag)}</td><td className="font-sans">{c?.confidence_level ?? '—'}</td>
                    <td>{fmtNum(l?.summary.maxWindP90 ?? null, 0)}</td><td>{fmtNum(l?.summary.maxHs ?? null, 1)}</td><td>{fmtNum(l?.summary.maxCurrentKn ?? null, 1)}</td><td className="font-sans font-semibold">{l ? flagWord(l.summary.worstRisk) : '—'}</td><td className="font-sans">{l && l.summary.worstSquall !== 'none' ? l.summary.worstSquall : '—'}</td><td>{fmtNum(num(c?.speed_loss_pct) ?? l?.summary.meanSpeedLossPct ?? null, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-[#555] mt-1">Wind in knots (p10 / p50 / p90 of the primary ensemble), direction the wind blows from, current sets toward. Gust source: WN2, ECMWF ENS, GFS or est ×1.3 (estimated from p90 wind). UKC marked * uses a depth accepted from the GEBCO grid, not a charted sounding: verify on the chart. Leg columns are maxima over the sampled points between the previous waypoint and this one.</p>
      </section>

      {legs.length > 0 && (
        <section className="mt-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] mb-1.5">Conditions along each leg</h2>
          <div className="space-y-4">
            {legs.map((l) => (
              <div key={`${l.fromId}-${l.toId}`} className="print-leg border border-[#ccc] rounded p-2">
                <div className="flex flex-wrap items-baseline gap-x-3 mb-1 text-[11px]"><span className="font-semibold">{l.from?.sequence}. {l.from?.name} → {l.to?.sequence}. {l.to?.name}</span><span className="num text-[#555]">{l.distanceNm.toFixed(1)} nm · {l.points.length} points · worst {flagWord(l.summary.worstRisk)} · max p90 {fmtNum(l.summary.maxWindP90, 0)} kn · max Hs {fmtNum(l.summary.maxHs, 1)} m{l.summary.worstSquall !== 'none' ? ` · squall ${l.summary.worstSquall}` : ''}</span></div>
                <LegProfile leg={l} maxWindKn={num(vessel?.max_wind_kn)} maxWaveM={num(vessel?.max_wave_m)} utcOffsetMin={null} print minWidth={900} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-5 print-leg">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] mb-1.5">Briefing</h2>
        {!briefing && <p className="text-[#555]">No briefing generated for this run. The leg table is the source of truth either way.</p>}
        {briefing && bd.state !== 'ok' && <p className="text-[#555]">{bd.reason ?? 'Briefing unavailable. Raw data above.'}</p>}
        {briefing && bd.state === 'ok' && (
          <div className="space-y-2">
            <div className="num text-[10px] text-[#555]">confidence {briefing.confidence_level} · {briefing.model_used} · {briefing.prompt_version} · generated {fmtUtc(briefing.generated_at)}{briefing.is_recheck ? ' · re-check' : ''}</div>
            <p className="whitespace-pre-line">{briefing.summary_text}</p>
            {briefing.disagreement_notes && <p className="border-l-2 border-black pl-2"><span className="font-semibold">Model disagreement. </span>{briefing.disagreement_notes}</p>}
            {briefing.recommended_action && <p className="border-l-2 border-black pl-2"><span className="font-semibold">Worth considering. </span>{briefing.recommended_action}</p>}
            {perLeg.length > 0 && <ul className="list-disc pl-5">{perLeg.map((n, i) => <li key={i}><span className="font-semibold">{n.sequence !== undefined ? `${n.sequence}. ` : ''}{n.waypoint_name ?? ''}</span> {n.note ?? n.text ?? ''}</li>)}</ul>}
          </div>
        )}
      </section>

      <section className="mt-5 print-leg">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] mb-1.5">Sources</h2>
        <table className="num text-[11px]"><tbody>
          <tr><td className="pr-4 text-[#555]">Primary ensemble</td><td>{sources?.atmospheric ?? conditions[0]?.atmos_source ?? '—'}</td><td className="pl-4">init {fmtUtc(inits.atmos)}</td></tr>
          <tr><td className="pr-4 text-[#555]">Comparison</td><td>{sources?.comparison ?? conditions[0]?.comparison_source ?? '—'}</td><td className="pl-4">init {fmtUtc(inits.cmp)}</td></tr>
          <tr><td className="pr-4 text-[#555]">Marine</td><td>{sources?.marine ?? conditions.find((c) => c.marine_source)?.marine_source ?? '—'}</td><td className="pl-4">init {fmtUtc(inits.marine)}</td></tr>
          <tr><td className="pr-4 text-[#555]">Tidal</td><td>{sources?.tidal ?? conditions.find((c) => c.tidal_source)?.tidal_source ?? '—'}</td><td className="pl-4">stations {[...new Set(conditions.map((c) => c.tide_station_id).filter(Boolean))].join(', ') || '—'}</td></tr>
        </tbody></table>
        <p className="text-[10px] text-[#555] mt-1.5">{ATTRIBUTION}</p>
      </section>

      <footer className="mt-6 border-t-2 border-black pt-2 text-[10.5px]">
        <p className="font-semibold">{SOLAS}</p>
        <p className="text-[#555] mt-1 num">Printed {fmtUtc(generated)} from run {run?.id ?? '—'} · passage {passage.id}</p>
      </footer>
    </div>
  );
}
